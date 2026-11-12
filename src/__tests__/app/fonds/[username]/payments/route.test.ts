// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GET } from '@/app/fonds/[username]/payments/route';

const SUMMARY = {
  username: 'tondo-fond',
  receivedSats: 210_000,
  paidOutSats: 21_000,
  feesSats: 210,
  balanceSats: 210_000,
  balanceSyncedAt: '2026-11-11T10:00:00.000Z',
  payoutsPaid: 3,
  payoutsPaidUsd: '3.00',
};

const PAYMENTS = {
  payments: [
    {
      id: 'payment-1',
      amountSats: 21_000,
      feeSats: 0,
      paidAt: '2026-11-11T10:00:00.000Z',
      direction: 'in',
      storedFiat: null,
      storedFee: null,
      counterparty: null,
    },
  ],
  next: 'cursor-2',
};

/**
 * Installs a fetch that answers by upstream path.
 *
 * @param answers - Path-to-response map.
 * @returns The fetch mock.
 */
function stubUpstream(answers: Record<string, Response>): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn((input: URL | string) => {
    const url = input instanceof URL ? input : new URL(input);
    const response = answers[url.pathname];
    return Promise.resolve(response ?? new Response('missing', { status: 500 }));
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

/**
 * Calls the route GET for one handle.
 *
 * @param username - Path handle.
 * @param search - Optional payments query string.
 * @returns The route response.
 */
async function callGet(username: string, search = ''): Promise<Response> {
  return GET(new Request(`http://localhost/fonds/${username}/payments${search}`), {
    params: Promise.resolve({ username }),
  });
}

beforeEach(() => {
  process.env.NEXT_PUBLIC_API_URL = 'https://api.test';
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.NEXT_PUBLIC_API_URL;
});

describe('GET /fonds/[username]/payments', () => {
  it('forwards the matching Fond and its before cursor to /fond/payments', async () => {
    const fetchMock = stubUpstream({
      '/fond/summary': new Response(JSON.stringify(SUMMARY), { status: 200 }),
      '/fond/payments': new Response(JSON.stringify(PAYMENTS), {
        status: 200,
        headers: { 'cache-control': 'no-store' },
      }),
    });
    const response = await callGet('tondo-fond', '?before=a%2Fb');
    expect(fetchMock.mock.calls[0]?.[0].pathname).toBe('/fond/summary');
    expect(fetchMock.mock.calls[0]?.[0].search).toBe('');
    expect(fetchMock.mock.calls[1]?.[0].pathname).toBe('/fond/payments');
    expect(fetchMock.mock.calls[1]?.[0].search).toBe('?before=a%2Fb');
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toEqual(PAYMENTS);
  });

  it('answers 404 without reading payments when the summary names another handle', async () => {
    const fetchMock = stubUpstream({
      '/fond/summary': new Response(JSON.stringify({ ...SUMMARY, username: 'other-fond' }), {
        status: 200,
      }),
    });
    const response = await callGet('tondo-fond');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(response.status).toBe(404);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toEqual({ error: 'Not found' });
  });

  it('answers 404 without reading payments when the api summary is 404', async () => {
    const fetchMock = stubUpstream({
      '/fond/summary': new Response(JSON.stringify({ error: 'Not found' }), { status: 404 }),
    });
    const response = await callGet('tondo-fond');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: 'Not found' });
  });

  it('passes a summary failure other than 404 through unchanged', async () => {
    stubUpstream({
      '/fond/summary': new Response(JSON.stringify({ error: 'Unavailable' }), { status: 503 }),
    });
    const response = await callGet('tondo-fond');
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: 'Unavailable' });
  });

  it('answers 502 when the summary body is not JSON or fails the schema', async () => {
    stubUpstream({ '/fond/summary': new Response('not json', { status: 200 }) });
    const notJson = await callGet('tondo-fond');
    expect(notJson.status).toBe(502);
    expect(await notJson.json()).toEqual({
      error: 'Upstream api returned an invalid Fond summary',
    });

    stubUpstream({
      '/fond/summary': new Response(JSON.stringify({ ...SUMMARY, username: '' }), { status: 200 }),
    });
    expect((await callGet('tondo-fond')).status).toBe(502);
  });

  it.each([400, 503])('passes the payments %i response through unchanged', async (status) => {
    stubUpstream({
      '/fond/summary': new Response(JSON.stringify(SUMMARY), { status: 200 }),
      '/fond/payments': new Response(JSON.stringify({ error: 'payments failed' }), { status }),
    });
    const response = await callGet('tondo-fond');
    expect(response.status).toBe(status);
    expect(await response.json()).toEqual({ error: 'payments failed' });
  });
});
