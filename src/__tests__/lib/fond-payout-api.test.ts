// @vitest-environment node
import { afterEach, describe, expect, it, vi, type Mock } from 'vitest';
import { fetchFondPayouts, postFondPayoutInvoice } from '@/lib/api';

const PAYOUTS = {
  payouts: [{ id: 'row-1', kind: 'daily', status: 'owed', utcDay: '2026-11-10' }],
};

const INVOICE = {
  id: 'row-1',
  bolt11: 'lnbc1invoice',
  paymentHash: 'aa'.repeat(32),
  sparkInvoice: 'spark1invoice',
};

afterEach(() => {
  vi.unstubAllGlobals();
});

/**
 * Stubs `fetch` with one JSON answer.
 *
 * @param status - HTTP status.
 * @param body - JSON body.
 * @returns The fetch mock.
 */
function stubFetch(status: number, body: unknown): Mock {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('fetchFondPayouts', () => {
  it('reads the list with Bearer auth', async () => {
    const fetchMock = stubFetch(200, PAYOUTS);
    await expect(fetchFondPayouts('sess')).resolves.toEqual({
      ok: true,
      payouts: PAYOUTS.payouts,
    });
    expect(fetchMock).toHaveBeenCalledWith('/fond/payouts', {
      headers: { Authorization: 'Bearer sess' },
    });
  });

  it('returns a status failure with the api error text', async () => {
    stubFetch(403, { error: 'Fond only' });
    await expect(fetchFondPayouts('sess')).resolves.toEqual({
      ok: false,
      status: 403,
      error: 'Fond only',
    });
  });

  it('returns a null error for a body that is not the error envelope', async () => {
    stubFetch(500, { detail: 'no' });
    await expect(fetchFondPayouts('sess')).resolves.toEqual({
      ok: false,
      status: 500,
      error: null,
    });
  });

  it('treats a network failure as status 0', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    await expect(fetchFondPayouts('sess')).resolves.toEqual({
      ok: false,
      status: 0,
      error: null,
    });
  });

  it('returns a failure for a success body that fails the schema', async () => {
    stubFetch(200, { payouts: [{ id: 'row-1', kind: 'other', status: 'owed', utcDay: '' }] });
    await expect(fetchFondPayouts('sess')).resolves.toEqual({
      ok: false,
      status: 200,
      error: null,
    });
  });

  it('returns a failure for a success body that is not JSON', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.reject(new SyntaxError('bad json')),
      }),
    );
    await expect(fetchFondPayouts('sess')).resolves.toEqual({
      ok: false,
      status: 200,
      error: null,
    });
  });
});

describe('postFondPayoutInvoice', () => {
  it('posts the encoded id with Bearer auth and no body', async () => {
    const fetchMock = stubFetch(200, INVOICE);
    await expect(postFondPayoutInvoice('sess', 'a/b')).resolves.toEqual({
      ok: true,
      invoice: INVOICE,
    });
    expect(fetchMock).toHaveBeenCalledWith('/fond/payouts/a%2Fb/invoice', {
      method: 'POST',
      headers: { Authorization: 'Bearer sess' },
    });
  });

  it('returns the 409 status and error text', async () => {
    stubFetch(409, { error: 'Invoice in progress' });
    await expect(postFondPayoutInvoice('sess', 'row-1')).resolves.toEqual({
      ok: false,
      status: 409,
      error: 'Invoice in progress',
    });
  });

  it('returns a failure for an invoice body that fails the schema', async () => {
    stubFetch(200, { ...INVOICE, bolt11: '' });
    await expect(postFondPayoutInvoice('sess', 'row-1')).resolves.toEqual({
      ok: false,
      status: 200,
      error: null,
    });
  });

  it('requires the Spark invoice field, which may be null', async () => {
    stubFetch(200, { ...INVOICE, sparkInvoice: null });
    await expect(postFondPayoutInvoice('sess', 'row-1')).resolves.toEqual({
      ok: true,
      invoice: { ...INVOICE, sparkInvoice: null },
    });
    stubFetch(200, {
      id: INVOICE.id,
      bolt11: INVOICE.bolt11,
      paymentHash: INVOICE.paymentHash,
    });
    await expect(postFondPayoutInvoice('sess', 'row-1')).resolves.toEqual({
      ok: false,
      status: 200,
      error: null,
    });
  });
});
