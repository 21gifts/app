import { describe, expect, it, vi } from 'vitest';
import {
  fetchPayRequest,
  openShopPayment,
  payRequestUrl,
  readPayRequest,
  stablecoinAmounts,
} from '@/lib/shop-payment';

const ADA = 'LNURL1DP68GURN8GHJ7V339ENKJEN5WVHJUAM9D3KZ66MWDAMKUTMVDE6HYMRS9ASKGCGMXDMGQ';

describe('payRequestUrl', () => {
  it('returns the decoded pay link and does not add a query', () => {
    expect(payRequestUrl(ADA, 'localhost')).toBe('https://21.gifts/.well-known/lnurlp/ada');
    expect(payRequestUrl(ADA, 'dev.21.gifts')).toBeNull();
  });
});

describe('stablecoinAmounts', () => {
  it('keeps offered USDT and USDC and skips Lightning and unavailable rows', () => {
    expect(
      stablecoinAmounts({
        transferAmounts: [
          {
            method: 'Lightning',
            minFee: 0,
            available: true,
            assets: [{ asset: 'BTC', amount: '0.00000021' }],
          },
          {
            method: 'ethereum',
            available: true,
            assets: [
              { asset: 'USDT', amount: '1.25' },
              { asset: 'USDC', amount: '1.25' },
            ],
          },
          { method: 'tron', available: false, assets: [{ asset: 'USDT', amount: '9' }] },
          { method: '', available: true, assets: [{ asset: 'USDT', amount: '1' }] },
          { method: 'solana', available: true, assets: [{ asset: 'BTC', amount: '1' }] },
        ],
      }),
    ).toEqual([
      { method: 'ethereum', asset: 'USDT', amount: '1.25' },
      { method: 'ethereum', asset: 'USDC', amount: '1.25' },
    ]);
    expect(stablecoinAmounts(null)).toEqual([]);
    expect(stablecoinAmounts({ transferAmounts: 'nope' })).toEqual([]);
  });
});

describe('readPayRequest', () => {
  it('keeps the first offered amount on a chain and the quote expiry string', () => {
    expect(
      readPayRequest({
        quote: { expiration: '2026-10-11T12:00:00.000Z' },
        transferAmounts: [
          {
            method: 'ethereum',
            available: true,
            assets: [
              { asset: 'USDT', amount: '1.25' },
              { asset: 'USDT', amount: '9' },
            ],
          },
        ],
      }),
    ).toEqual({
      amounts: [{ method: 'ethereum', asset: 'USDT', amount: '1.25' }],
      expiresAt: '2026-10-11T12:00:00.000Z',
    });
    expect(readPayRequest({ quote: { expiration: 'nope' } })).toEqual({
      amounts: [],
      expiresAt: null,
    });
    expect(readPayRequest(null)).toEqual({ amounts: [], expiresAt: null });
  });
});

describe('openShopPayment', () => {
  it('reads an opened payment, a conflict, and any other answer as unavailable', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      Response.json({ payment: '8d1c1b9a-6c0e-4f1a-9c2d-111111111111' }),
    );
    vi.stubGlobal('fetch', fetchMock);
    await expect(openShopPayment('ada', 21)).resolves.toBe('opened');
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/pay/ada/payment');
    expect((fetchMock.mock.calls[0]?.[1] as RequestInit).body).toBe(
      JSON.stringify({ amountSats: 21 }),
    );

    fetchMock.mockResolvedValueOnce(new Response(null, { status: 409 }));
    await expect(openShopPayment('ada', 22)).resolves.toBe('conflict');

    fetchMock.mockResolvedValueOnce(new Response(null, { status: 503 }));
    await expect(openShopPayment('ada', 21)).resolves.toBe('unavailable');

    fetchMock.mockResolvedValueOnce(Response.json({ name: 'Ada' }));
    await expect(openShopPayment('ada', 21)).resolves.toBe('unavailable');

    fetchMock.mockRejectedValueOnce(new Error('offline'));
    await expect(openShopPayment('ada', 21)).resolves.toBe('unavailable');
    vi.unstubAllGlobals();
  });
});

describe('fetchPayRequest', () => {
  it('fetches the url unchanged and returns no amounts on failure', async () => {
    const decoded = 'https://21.gifts/.well-known/lnurlp/ada';
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      expect(String(input)).toBe(decoded);
      expect(String(input)).not.toContain('timeout');
      return Response.json({
        quote: { expiration: '2026-10-11T12:00:00.000Z' },
        transferAmounts: [
          { method: 'ethereum', available: true, assets: [{ asset: 'USDT', amount: '1.25' }] },
        ],
      });
    });
    vi.stubGlobal('fetch', fetchMock);
    await expect(fetchPayRequest(decoded)).resolves.toEqual({
      amounts: [{ method: 'ethereum', asset: 'USDT', amount: '1.25' }],
      expiresAt: '2026-10-11T12:00:00.000Z',
    });
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 404 }));
    await expect(fetchPayRequest(decoded)).resolves.toEqual({ amounts: [], expiresAt: null });
    vi.unstubAllGlobals();
  });
});
