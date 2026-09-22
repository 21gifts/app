// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cancelPosCharge, createPosCharge, fetchPosState } from '@/lib/pos';

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
    await expect(fetchPosState('tok')).resolves.toEqual({ charge: CHARGE, history: [CHARGE] });
    await expect(createPosCharge('tok', 21)).resolves.toEqual(CHARGE);
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
});
