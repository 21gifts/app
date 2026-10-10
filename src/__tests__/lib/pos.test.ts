// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CannotReceiveError, WalletRequiredError } from '@/lib/api';
import { logInteraction } from '@/lib/interaction-log';
import {
  cancelPosCharge,
  createPosCharge,
  fetchMemberSparkInvoice,
  fetchPosState,
  fetchShopChargeInvoice,
} from '@/lib/pos';

vi.mock('@/lib/interaction-log', () => ({ logInteraction: vi.fn() }));

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
    expect(logInteraction).toHaveBeenCalledWith(
      'pos_charge_created',
      { chargeId: 'c1', amountSats: 21 },
      'tok',
    );
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

  function shop(
    charge: unknown,
    invoice: Response | (() => Response),
    second: unknown = charge,
  ): ReturnType<typeof vi.fn> {
    let reads = 0;
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === 'POST') {
        return typeof invoice === 'function' ? invoice() : invoice;
      }
      reads += 1;
      const shown = reads === 1 ? charge : second;
      return json({ name: 'Shop', username: 'shop', minSats: 1, maxSats: 9, charge: shown });
    });
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
  }

  it('asks the open charge for its Spark invoice and checks it is still open', async () => {
    const fetchMock = shop(OPEN, json({ pr: 'lnbc1', amountSats: 7_000, sparkInvoice: 'spark1' }));
    await expect(fetchShopChargeInvoice('my shop')).resolves.toEqual({
      kind: 'invoice',
      amountSats: 7_000,
      sparkInvoice: 'spark1',
    });
    expect(fetchMock).toHaveBeenNthCalledWith(1, '/pay/my%20shop');
    expect(fetchMock).toHaveBeenNthCalledWith(2, '/pay/my%20shop/invoice', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ amountSats: 7_000 }),
    });
    expect(fetchMock).toHaveBeenNthCalledWith(3, '/pay/my%20shop');
  });

  it('accepts a charge and an invoice without the optional fields', async () => {
    const noStatus: Partial<typeof OPEN> = { ...OPEN };
    delete noStatus.status;
    delete noStatus.id;
    shop(noStatus, json({ pr: 'lnbc1', sparkInvoice: 'spark1' }));
    await expect(fetchShopChargeInvoice('shop')).resolves.toEqual({
      kind: 'invoice',
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
  ])('gives none for %s and asks for no invoice', async (_label, charge) => {
    const fetchMock = shop(charge, json({ sparkInvoice: 'spark1' }));
    await expect(fetchShopChargeInvoice('shop')).resolves.toEqual({ kind: 'none' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('gives none when the charge closed before the second read', async () => {
    shop(OPEN, json({ pr: 'lnbc1', amountSats: 7_000, sparkInvoice: 'spark1' }), {
      ...OPEN,
      status: 'paid',
    });
    await expect(fetchShopChargeInvoice('shop')).resolves.toEqual({ kind: 'none' });
  });

  it.each([
    ['another charge', { ...OPEN, id: 'c2' }],
    ['another amount', { ...OPEN, amountSats: 21 }],
    ['another end', { ...OPEN, expiresAt: new Date(Date.now() + 120_000).toISOString() }],
  ])('falls back when the second read shows %s', async (_label, second) => {
    shop(OPEN, json({ pr: 'lnbc1', amountSats: 7_000, sparkInvoice: 'spark1' }), second);
    await expect(fetchShopChargeInvoice('shop')).resolves.toEqual({ kind: 'fallback' });
  });

  it.each([
    ['no Spark invoice', json({ pr: 'lnbc1', amountSats: 7_000, sparkInvoice: null })],
    ['an answer without a Spark invoice', json({ pr: 'lnbc1', amountSats: 7_000 })],
    ['another amount', json({ pr: 'lnbc1', amountSats: 21, sparkInvoice: 'spark1' })],
    ['a refused invoice', json({ error: 'nope' }, 400)],
    ['an invoice that is not JSON', new Response('nope', { status: 200 })],
  ])('falls back for %s and reads the charge once', async (_label, invoice) => {
    const fetchMock = shop(OPEN, invoice);
    await expect(fetchShopChargeInvoice('shop')).resolves.toEqual({ kind: 'fallback' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('falls back when the shop cannot be read or the request fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ error: 'Not found' }, 404)));
    await expect(fetchShopChargeInvoice('shop')).resolves.toEqual({ kind: 'fallback' });
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')));
    await expect(fetchShopChargeInvoice('shop')).resolves.toEqual({ kind: 'fallback' });
  });

  it('falls back when the second read fails', async () => {
    let reads = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
        if (init?.method === 'POST') {
          return json({ pr: 'lnbc1', amountSats: 7_000, sparkInvoice: 'spark1' });
        }
        reads += 1;
        return reads === 1 ? json({ charge: OPEN }) : json({ error: 'busy' }, 503);
      }),
    );
    await expect(fetchShopChargeInvoice('shop')).resolves.toEqual({ kind: 'fallback' });
  });
});

describe('fetchMemberSparkInvoice', () => {
  it('asks for a Spark invoice of the amount with the message', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(json({ pr: 'lnbc1', amountSats: 2_100, sparkInvoice: 'spark1member' }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(fetchMemberSparkInvoice('al ice', 2_100, 'Thanks')).resolves.toBe('spark1member');
    expect(fetchMock).toHaveBeenCalledWith('/pay/al%20ice/invoice', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ amountSats: 2_100, comment: 'Thanks' }),
    });
  });

  it('sends no message when it is empty and accepts an answer without the amount', async () => {
    const fetchMock = vi.fn().mockResolvedValue(json({ pr: 'lnbc1', sparkInvoice: 'spark1' }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(fetchMemberSparkInvoice('alice', 21, '')).resolves.toBe('spark1');
    expect(fetchMock).toHaveBeenCalledWith('/pay/alice/invoice', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ amountSats: 21 }),
    });
  });

  it.each([
    ['no Spark invoice', json({ pr: 'lnbc1', amountSats: 21, sparkInvoice: null })],
    ['an answer without a Spark invoice', json({ pr: 'lnbc1', amountSats: 21 })],
    ['another amount', json({ pr: 'lnbc1', amountSats: 7_000, sparkInvoice: 'spark1' })],
    ['a refused invoice', json({ error: 'Invalid amount' }, 400)],
    ['an answer that is not JSON', new Response('nope', { status: 200 })],
  ])('gives null for %s', async (_label, answer) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(answer));
    await expect(fetchMemberSparkInvoice('alice', 21, '')).resolves.toBeNull();
  });

  it('gives null when the request fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')));
    await expect(fetchMemberSparkInvoice('alice', 21, '')).resolves.toBeNull();
  });
});
