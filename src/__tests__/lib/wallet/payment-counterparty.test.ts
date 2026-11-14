import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  fetchPaymentCounterparties,
  isSparkPaymentRequest,
} from '@/lib/wallet/payment-counterparty';

const payment = { id: 'p1', direction: 'in' as const };
const sender = { id: 'p1', accountId: 'acc_e2e', username: 'alice' };

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('fetchPaymentCounterparties', () => {
  it('sends only the requested identifiers and filters invalid rows', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({
        counterparties: [
          sender,
          null,
          {},
          { ...sender, username: ' ' },
          { ...sender, accountId: '' },
          { ...sender, id: '' },
        ],
      }),
    );
    vi.stubGlobal('fetch', fetchMock);
    await expect(fetchPaymentCounterparties('session', [payment])).resolves.toEqual([sender]);
    expect(fetchMock).toHaveBeenCalledWith('/me/wallet/counterparties', {
      method: 'POST',
      headers: { Authorization: 'Bearer session', 'Content-Type': 'application/json' },
      body: JSON.stringify({ payments: [payment] }),
    });
  });

  it('treats errors and invalid bodies as no matches', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(new Response('', { status: 503 }))
      .mockResolvedValueOnce(Response.json(null))
      .mockResolvedValueOnce(Response.json({ counterparties: {} }))
      .mockResolvedValueOnce(new Response('invalid'));
    vi.stubGlobal('fetch', fetchMock);
    for (let i = 0; i < 5; i += 1) {
      await expect(fetchPaymentCounterparties('session', [payment])).resolves.toEqual([]);
    }
  });
});

describe('isSparkPaymentRequest', () => {
  it.each(['spark1abc', 'sparkrt1abc', 'sp1abc', 'sprt1abc', 'spt1abc', 'SPARK1ABC'])(
    'recognises %s',
    (value) => expect(isSparkPaymentRequest(value)).toBe(true),
  );
  it.each(['lnbc1abc', 'xspark1abc', ''])('rejects %s', (value) => {
    expect(isSparkPaymentRequest(value)).toBe(false);
  });
});
