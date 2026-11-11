// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GET } from '@/app/fonds/[username]/summary/route';

const SUMMARY = {
  username: 'tondo-fond',
  receivedSats: 210_000,
  paidOutSats: 21_000,
  feesSats: 210,
  balanceSats: 189_000,
  balanceSyncedAt: '2026-11-11T10:00:00.000Z',
  payoutsPaid: 3,
  payoutsPaidUsd: '3.00',
};

/**
 * Installs a fetch that answers with `status` and `body`.
 *
 * @param status - Upstream status.
 * @param body - Raw upstream text.
 * @returns The fetch mock.
 */
function stubUpstream(status: number, body: string): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn().mockResolvedValue(new Response(body, { status }));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

/**
 * Calls the route's GET for one handle.
 *
 * @param username - Path handle.
 * @returns The route response.
 */
async function callGet(username: string): Promise<Response> {
  return GET(new Request(`http://localhost/fonds/${username}/summary`), {
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

describe('GET /fonds/[username]/summary', () => {
  it('forwards /fond/summary and answers 200 no-store for the same handle', async () => {
    const fetchMock = stubUpstream(200, JSON.stringify(SUMMARY));
    const response = await callGet('tondo-fond');
    expect((fetchMock.mock.calls[0]?.[0] as URL).pathname).toBe('/fond/summary');
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toEqual(SUMMARY);
  });

  it('answers 404 when the api body names another handle', async () => {
    stubUpstream(200, JSON.stringify({ ...SUMMARY, username: 'other-fond' }));
    const response = await callGet('tondo-fond');
    expect(response.status).toBe(404);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toEqual({ error: 'Not found' });
  });

  it('answers 502 when the 200 body is not JSON', async () => {
    stubUpstream(200, 'not json');
    const response = await callGet('tondo-fond');
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({
      error: 'Upstream api returned an invalid Fond summary',
    });
  });

  it('answers 502 when the 200 body fails the schema', async () => {
    stubUpstream(200, JSON.stringify({ ...SUMMARY, username: '' }));
    const response = await callGet('tondo-fond');
    expect(response.status).toBe(502);
  });

  it('passes a 503 error through unchanged', async () => {
    stubUpstream(503, JSON.stringify({ error: 'Fond unavailable' }));
    const response = await callGet('tondo-fond');
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: 'Fond unavailable' });
  });
});
