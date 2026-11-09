import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchPaymentSenders } from '@/lib/wallet/payment-sender';

const payment = { id: 'p1', invoice: 'spark1example', paymentHash: null };
const sender = { id: 'p1', accountId: 'acc_e2e', username: 'alice' };

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('fetchPaymentSenders', () => {
  it('sends only the requested identifiers and filters invalid rows', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({
        senders: [
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
    await expect(fetchPaymentSenders('session', [payment])).resolves.toEqual([sender]);
    expect(fetchMock).toHaveBeenCalledWith('/me/wallet/senders', {
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
      .mockResolvedValueOnce(Response.json({ senders: {} }))
      .mockResolvedValueOnce(new Response('invalid'));
    vi.stubGlobal('fetch', fetchMock);
    for (let i = 0; i < 5; i += 1) {
      await expect(fetchPaymentSenders('session', [payment])).resolves.toEqual([]);
    }
  });
});
