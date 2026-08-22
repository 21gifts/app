// @vitest-environment node
import { describe, expect, it, vi, type Mock } from 'vitest';
import { formatMsatAsSats, requestDonateInvoice, satsToMsat, type FetchFn } from '@/lib/lnurl-pay';

const CALLBACK = 'https://walletofsatoshi.com/lnurlp/callback';
const PR = 'lnbc10n1ptest';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('satsToMsat', () => {
  it('converts a positive integer sat amount', () => {
    expect(satsToMsat(21)).toBe(21_000);
  });

  it('rejects zero, non-integers, and non-finite values', () => {
    expect(() => satsToMsat(0)).toThrow('Amount must be a positive whole number of sats');
    expect(() => satsToMsat(1.5)).toThrow('Amount must be a positive whole number of sats');
    expect(() => satsToMsat(Number.NaN)).toThrow('Amount must be a positive whole number of sats');
  });
});

describe('formatMsatAsSats', () => {
  it('uses the singular for one sat', () => {
    expect(formatMsatAsSats(1000)).toBe('1 sat');
  });

  it('uses the plural for whole sats above one', () => {
    expect(formatMsatAsSats(2000)).toBe('2 sats');
  });

  it('keeps a decimal when the amount is not a whole sat', () => {
    expect(formatMsatAsSats(1500)).toBe('1.5 sats');
  });
});

describe('requestDonateInvoice', () => {
  it('returns pr and sets the amount query with redirect: error', async () => {
    let seenInit: RequestInit | undefined;
    const fetchImpl: FetchFn = async (input, init) => {
      seenInit = init;
      expect(String(input)).toBe(`${CALLBACK}?amount=21000`);
      return jsonResponse({ pr: PR });
    };

    await expect(
      requestDonateInvoice({ callback: CALLBACK, amountMsat: 21_000, fetchImpl }),
    ).resolves.toBe(PR);
    expect(seenInit).toEqual({ redirect: 'error' });
  });

  it('rejects a non-https callback', async () => {
    const fetchImpl: FetchFn = async () => {
      throw new Error('fetch must not be called');
    };
    await expect(
      requestDonateInvoice({
        callback: 'http://walletofsatoshi.com/cb',
        amountMsat: 1000,
        fetchImpl,
      }),
    ).rejects.toThrow('Invoice callback must be https');
  });

  it('rejects an unparseable callback', async () => {
    await expect(requestDonateInvoice({ callback: 'not a url', amountMsat: 1000 })).rejects.toThrow(
      'Invoice callback must be https',
    );
  });

  it('rejects a non-positive integer amount', async () => {
    await expect(requestDonateInvoice({ callback: CALLBACK, amountMsat: 0 })).rejects.toThrow(
      'Amount must be a positive whole number of millisatoshis',
    );
    await expect(requestDonateInvoice({ callback: CALLBACK, amountMsat: 1.5 })).rejects.toThrow(
      'Amount must be a positive whole number of millisatoshis',
    );
    await expect(
      requestDonateInvoice({ callback: CALLBACK, amountMsat: Number.NaN }),
    ).rejects.toThrow('Amount must be a positive whole number of millisatoshis');
  });

  it('collapses a thrown fetch to the unreachable message', async () => {
    const fetchImpl: FetchFn = async () => {
      throw new Error('network down');
    };
    await expect(
      requestDonateInvoice({ callback: CALLBACK, amountMsat: 1000, fetchImpl }),
    ).rejects.toThrow('Could not fetch the invoice from the Lightning Address');
  });

  it('collapses a non-ok response', async () => {
    const fetchImpl: FetchFn = async () => jsonResponse({}, 502);
    await expect(
      requestDonateInvoice({ callback: CALLBACK, amountMsat: 1000, fetchImpl }),
    ).rejects.toThrow('Could not fetch the invoice from the Lightning Address');
  });

  it('collapses bad JSON', async () => {
    const fetchImpl: FetchFn = async () =>
      new Response('nope', { status: 200, headers: { 'content-type': 'text/plain' } });
    await expect(
      requestDonateInvoice({ callback: CALLBACK, amountMsat: 1000, fetchImpl }),
    ).rejects.toThrow('Could not fetch the invoice from the Lightning Address');
  });

  it('collapses a payload missing pr', async () => {
    const fetchImpl: FetchFn = async () => jsonResponse({});
    await expect(
      requestDonateInvoice({ callback: CALLBACK, amountMsat: 1000, fetchImpl }),
    ).rejects.toThrow('Could not fetch the invoice from the Lightning Address');
  });

  it('uses globalThis.fetch when no fetchImpl is given', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ pr: PR })) as Mock;
    vi.stubGlobal('fetch', fetchMock);
    try {
      await expect(requestDonateInvoice({ callback: CALLBACK, amountMsat: 1000 })).resolves.toBe(
        PR,
      );
      expect(fetchMock).toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
