// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CannotReceiveError, WalletRequiredError } from '@/lib/api';
import { cancelPosCharge, createPosCharge, fetchPosState, fetchShopChargeInvoice } from '@/lib/pos';

const CHARGE = {
  id: 'c1',
  amountSats: 21,
  status: 'pending',
  createdAt: '2026-09-22T00:00:00.000Z',
  expiresAt: '2026-09-22T00:05:00.000Z',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('pos client', () => {
  it('loads, creates, and cancels a charge', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === 'POST') {
        return json({ charge: CHARGE }, 201);
      }
      if (init?.method === 'DELETE') {
        return json({ charge: null });
      }
      return json({ charge: CHARGE, history: [CHARGE] });
    });
    vi.stubGlobal('fetch', fetchMock);
    const read = { ...CHARGE, paidAt: null };
    await expect(fetchPosState('tok')).resolves.toEqual({ charge: read, history: [read] });
    await expect(createPosCharge('tok', 21)).resolves.toEqual(read);
    await expect(cancelPosCharge('tok')).resolves.toBeUndefined();
  });

  it('throws the API error string, or a status fallback', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
        if (init?.method === 'POST') {
          return json({ error: 'A payment is already open' }, 409);
        }
        if (init?.method === 'DELETE') {
          return json({ error: 'No open payment' }, 404);
        }
        return json({ error: 'nope' }, 500);
      }),
    );
    await expect(fetchPosState('tok')).rejects.toThrow('Failed to load point of sale: 500');
    await expect(createPosCharge('tok', 21)).rejects.toThrow('A payment is already open');
    await expect(cancelPosCharge('tok')).rejects.toThrow('Failed to cancel payment: 404');
  });

  it('falls back when the error body is not a string', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ error: 1 }, 400)));
    await expect(createPosCharge('tok', 21)).rejects.toThrow('Failed to create payment: 400');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('not-json', { status: 502 })));
    await expect(createPosCharge('tok', 21)).rejects.toThrow('Failed to create payment: 502');
  });

  it('rejects a create response that is not a charge', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ charge: { id: 'x' } }, 201)));
    await expect(createPosCharge('tok', 21)).rejects.toThrow();
  });

  it('throws the typed wallet errors on a 400 with a wallet code', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          json({ error: 'Set up your wallet first', code: 'wallet_required' }, 400),
        ),
    );
    await expect(createPosCharge('tok', 21)).rejects.toBeInstanceOf(WalletRequiredError);
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(json({ error: 'Cannot receive', code: 'cannot_receive' }, 400)),
    );
    await expect(createPosCharge('tok', 21)).rejects.toBeInstanceOf(CannotReceiveError);
  });

  it('reads a paid charge with its paid time', async () => {
    const paid = { ...CHARGE, status: 'paid', paidAt: '2026-09-22T00:01:00.000Z' };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ charge: paid, history: [paid] })));
    await expect(fetchPosState('tok')).resolves.toEqual({ charge: paid, history: [paid] });
  });
});

describe('fetchShopChargeInvoice', () => {
  const OPEN = {
    id: 'c1',
    amountSats: 7_000,
    status: 'pending',
    createdAt: '2026-09-22T00:00:00.000Z',
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    paidAt: null,
  };

  function shop(charge: unknown, invoice: Response | (() => Response)): ReturnType<typeof vi.fn> {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === 'POST') {
        return typeof invoice === 'function' ? invoice() : invoice;
      }
      return json({ name: 'Shop', username: 'shop', minSats: 1, maxSats: 9, charge });
    });
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
  }

  it('asks the open charge for its Spark invoice', async () => {
    const fetchMock = shop(OPEN, json({ pr: 'lnbc1', amountSats: 7_000, sparkInvoice: 'spark1' }));
    await expect(fetchShopChargeInvoice('my shop')).resolves.toEqual({
      amountSats: 7_000,
      sparkInvoice: 'spark1',
    });
    expect(fetchMock).toHaveBeenNthCalledWith(1, '/pay/my%20shop');
    expect(fetchMock).toHaveBeenNthCalledWith(2, '/pay/my%20shop/invoice', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ amountSats: 7_000 }),
    });
  });

  it('accepts a charge and an invoice without the optional fields', async () => {
    const noStatus: Partial<typeof OPEN> = { ...OPEN };
    delete noStatus.status;
    shop(noStatus, json({ pr: 'lnbc1', sparkInvoice: 'spark1' }));
    await expect(fetchShopChargeInvoice('shop')).resolves.toEqual({
      amountSats: 7_000,
      sparkInvoice: 'spark1',
    });
  });

  it.each([
    ['no charge', null],
    ['a missing charge', undefined],
    ['a paid charge', { ...OPEN, status: 'paid' }],
    ['a charge that has run out', { ...OPEN, expiresAt: new Date(Date.now() - 1).toISOString() }],
    ['a charge without a readable end', { ...OPEN, expiresAt: 'soon' }],
  ])('gives null for %s and asks for no invoice', async (_label, charge) => {
    const fetchMock = shop(charge, json({ sparkInvoice: 'spark1' }));
    await expect(fetchShopChargeInvoice('shop')).resolves.toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['no Spark invoice', json({ pr: 'lnbc1', amountSats: 7_000, sparkInvoice: null })],
    ['an answer without a Spark invoice', json({ pr: 'lnbc1', amountSats: 7_000 })],
    ['another amount', json({ pr: 'lnbc1', amountSats: 21, sparkInvoice: 'spark1' })],
    ['a refused invoice', json({ error: 'nope' }, 400)],
    ['an invoice that is not JSON', new Response('nope', { status: 200 })],
  ])('gives null for %s', async (_label, invoice) => {
    shop(OPEN, invoice);
    await expect(fetchShopChargeInvoice('shop')).resolves.toBeNull();
  });

  it('gives null when the shop cannot be read or the request fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ error: 'Not found' }, 404)));
    await expect(fetchShopChargeInvoice('shop')).resolves.toBeNull();
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')));
    await expect(fetchShopChargeInvoice('shop')).resolves.toBeNull();
  });
});
