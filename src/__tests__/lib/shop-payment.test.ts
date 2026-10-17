import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  fetchShopInvoice,
  fetchShopPayLink,
  openShopPayment,
  type ShopPayRequest,
  waitShopPayment,
} from '@/lib/shop-payment';

const EXPIRATION = '2026-10-17T12:02:00.000Z';

/** The pay request of an open amount, as the contract's "Open amount" table writes it. */
const OPEN_AMOUNT = {
  id: 'ada',
  tag: 'payRequest',
  callback: 'https://21.gifts/lnurlp/cb/ada',
  minSendable: 21_000,
  maxSendable: 21_000,
  metadata: '[]',
  displayName: 'Ada',
  standard: 'OpenCryptoPay',
  possibleStandards: ['OpenCryptoPay'],
  displayQr: false,
  recipient: { name: 'Ada' },
  quote: { id: 'q1', expiration: EXPIRATION, payment: 'p1' },
  requestedAmount: { asset: 'BTC', amount: 0.00021 },
  transferAmounts: [
    {
      method: 'Lightning',
      minFee: 0,
      assets: [{ asset: 'BTC', amount: '0.00021' }],
      available: true,
    },
    {
      method: 'Polygon',
      minFee: 36,
      assets: [
        { asset: 'USDT', amount: '0.2' },
        { asset: 'USDC', amount: 0.21 },
      ],
      available: true,
    },
  ],
};

const REQUEST: ShopPayRequest = {
  callback: 'https://21.gifts/lnurlp/cb/ada',
  quoteId: 'q1',
  quoteExpiresAt: EXPIRATION,
  payment: 'p1',
  lines: [],
};

function stubFetch(handler: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>) {
  const mock = vi.fn(handler);
  vi.stubGlobal('fetch', mock);
  return mock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('fetchShopPayLink', () => {
  it('reads an OpenCryptoPay pay request on this origin without timeout', async () => {
    const mock = stubFetch(async () => Response.json(OPEN_AMOUNT));
    expect(await fetchShopPayLink('a da')).toEqual({
      kind: 'payment',
      request: {
        callback: 'https://21.gifts/lnurlp/cb/ada',
        quoteId: 'q1',
        quoteExpiresAt: EXPIRATION,
        payment: 'p1',
        lines: [
          { method: 'Polygon', asset: 'USDT', amount: '0.2' },
          { method: 'Polygon', asset: 'USDC', amount: '0.21' },
        ],
      },
    });
    expect(mock).toHaveBeenCalledWith('/.well-known/lnurlp/a%20da', { cache: 'no-store' });
  });

  it('accepts OpenCryptoPay named only in possibleStandards and skips unusable entries', async () => {
    stubFetch(async () =>
      Response.json({
        ...OPEN_AMOUNT,
        standard: 'Lightning',
        transferAmounts: [
          null,
          { method: 7, assets: [] },
          { method: 'Ethereum', available: false, assets: [{ asset: 'USDT', amount: '1' }] },
          { method: 'Arbitrum', assets: 'USDT' },
          {
            method: 'Arbitrum',
            assets: [null, { asset: 1, amount: '1' }, { asset: 'USDT', amount: null }],
          },
          { method: 'Arbitrum', assets: [{ asset: 'USDT', amount: '1.5' }] },
        ],
      }),
    );
    const link = await fetchShopPayLink('ada');
    expect(link.kind === 'payment' ? link.request.lines : null).toEqual([
      { method: 'Arbitrum', asset: 'USDT', amount: '1.5' },
    ]);
  });

  it('reads a pay request without transferAmounts as Lightning only', async () => {
    stubFetch(async () => Response.json({ ...OPEN_AMOUNT, transferAmounts: undefined }));
    const link = await fetchShopPayLink('ada');
    expect(link.kind === 'payment' ? link.request.lines : null).toEqual([]);
  });

  it('calls the plain Lightning pay request plain', async () => {
    stubFetch(async () =>
      Response.json({ tag: 'payRequest', callback: 'https://21.gifts/lnurlp/ada/invoice' }),
    );
    expect(await fetchShopPayLink('ada')).toEqual({ kind: 'plain' });
    stubFetch(async () => Response.json({ possibleStandards: 'OpenCryptoPay' }));
    expect(await fetchShopPayLink('ada')).toEqual({ kind: 'plain' });
  });

  it('reports an error status, a non-object body, a failed request, and a broken quote', async () => {
    stubFetch(async () => new Response('busy', { status: 503 }));
    expect(await fetchShopPayLink('ada')).toEqual({ kind: 'error' });
    stubFetch(async () => Response.json(null));
    expect(await fetchShopPayLink('ada')).toEqual({ kind: 'error' });
    stubFetch(async () => new Response('not json', { status: 200 }));
    expect(await fetchShopPayLink('ada')).toEqual({ kind: 'error' });
    stubFetch(async () => {
      throw new Error('offline');
    });
    expect(await fetchShopPayLink('ada')).toEqual({ kind: 'error' });
    const broken: unknown[] = [
      { callback: 1 },
      { quote: null },
      { quote: { ...OPEN_AMOUNT.quote, id: 1 } },
      { quote: { ...OPEN_AMOUNT.quote, payment: 1 } },
      { quote: { ...OPEN_AMOUNT.quote, expiration: 1 } },
      { quote: { ...OPEN_AMOUNT.quote, expiration: 'never' } },
    ];
    for (const patch of broken) {
      stubFetch(async () => Response.json({ ...OPEN_AMOUNT, ...(patch as object) }));
      expect(await fetchShopPayLink('ada')).toEqual({ kind: 'error' });
    }
  });
});

describe('fetchShopInvoice', () => {
  it("reads the BOLT11 from the callback's Lightning detail", async () => {
    const mock = stubFetch(async () => Response.json({ pr: 'lnbc210n1shop' }));
    expect(await fetchShopInvoice(REQUEST)).toBe('lnbc210n1shop');
    const url = mock.mock.calls[0]?.[0] as URL;
    expect(url.toString()).toBe(
      'https://21.gifts/lnurlp/cb/ada?quote=q1&method=Lightning&asset=BTC',
    );
    expect(mock.mock.calls[0]?.[1]).toEqual({ cache: 'no-store' });
  });

  it('returns null for an error, an empty or missing pr, a failed request, or a bad callback', async () => {
    stubFetch(async () => new Response('expired', { status: 404 }));
    expect(await fetchShopInvoice(REQUEST)).toBeNull();
    stubFetch(async () => Response.json({ pr: '' }));
    expect(await fetchShopInvoice(REQUEST)).toBeNull();
    stubFetch(async () => Response.json({ pr: 7 }));
    expect(await fetchShopInvoice(REQUEST)).toBeNull();
    stubFetch(async () => Response.json(null));
    expect(await fetchShopInvoice(REQUEST)).toBeNull();
    stubFetch(async () => {
      throw new Error('offline');
    });
    expect(await fetchShopInvoice(REQUEST)).toBeNull();
    const mock = stubFetch(async () => Response.json({ pr: 'lnbc' }));
    expect(await fetchShopInvoice({ ...REQUEST, callback: 'not a url' })).toBeNull();
    expect(mock).not.toHaveBeenCalled();
  });
});

describe('openShopPayment', () => {
  const opened = { payment: 'p1', expiresAt: '2026-10-17T12:05:00.000Z' };

  it('opens a payment with the entered sats', async () => {
    const mock = stubFetch(async () => Response.json(opened));
    expect(await openShopPayment('a da', 21)).toEqual({ kind: 'opened', ...opened });
    expect(mock).toHaveBeenCalledTimes(1);
    expect(mock).toHaveBeenCalledWith('/pay/a%20da/payment', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ amountSats: 21 }),
    });
  });

  it('shows the till charge on 409 payment_open', async () => {
    stubFetch(async () =>
      Response.json({ error: 'A payment is already open', code: 'payment_open' }, { status: 409 }),
    );
    expect(await openShopPayment('ada', 21)).toEqual({ kind: 'charge' });
  });

  it('falls back to the invoice on stablecoin_unavailable and on any other 4xx', async () => {
    const answers = [
      Response.json(
        { error: 'Stablecoin payment is unavailable', code: 'stablecoin_unavailable' },
        { status: 503 },
      ),
      Response.json({ error: 'Enter a whole number of sats' }, { status: 400 }),
      Response.json({ error: 'Not found' }, { status: 404 }),
      Response.json({ error: 'Conflict', code: 'other' }, { status: 409 }),
      new Response('not json', { status: 409 }),
    ];
    for (const answer of answers) {
      const mock = stubFetch(async () => answer);
      expect(await openShopPayment('ada', 21)).toEqual({ kind: 'invoice' });
      expect(mock).toHaveBeenCalledTimes(1);
    }
  });

  it('repeats an unknown outcome once and then reports failed', async () => {
    const unknowns: (() => Promise<Response>)[] = [
      async () => new Response('bad gateway', { status: 502 }),
      async () => new Response('not json', { status: 503 }),
      async () => Response.json({ code: 'other' }, { status: 503 }),
      async () => Response.json({ payment: '', expiresAt: opened.expiresAt }),
      async () => Response.json({ payment: 'p1', expiresAt: 'never' }),
      async () => Response.json({ payment: 'p1' }),
      async () => Response.json({ expiresAt: opened.expiresAt }),
      async () => Response.json(null),
      async () => new Response('not json', { status: 200 }),
      async () => new Response(null, { status: 304 }),
      async () => {
        throw new Error('offline');
      },
    ];
    for (const answer of unknowns) {
      const mock = stubFetch(answer);
      expect(await openShopPayment('ada', 21)).toEqual({ kind: 'failed' });
      expect(mock).toHaveBeenCalledTimes(2);
    }
  });

  it('takes the answer of the repeat', async () => {
    let calls = 0;
    stubFetch(async () => {
      calls += 1;
      return calls === 1 ? new Response('timeout', { status: 504 }) : Response.json(opened);
    });
    expect(await openShopPayment('ada', 21)).toEqual({ kind: 'opened', ...opened });
    expect(calls).toBe(2);
  });
});

describe('waitShopPayment', () => {
  it('asks without since first and with the last status after', async () => {
    const mock = stubFetch(async () => Response.json({ status: 'Pending', paymentStatus: 'open' }));
    expect(await waitShopPayment('p 1', null)).toEqual({
      status: 'Pending',
      paymentStatus: 'open',
    });
    expect(mock).toHaveBeenLastCalledWith('/lnurlp/wait/p%201', { cache: 'no-store' });
    const controller = new AbortController();
    await waitShopPayment('p1', 'open', controller.signal);
    expect(mock).toHaveBeenLastCalledWith('/lnurlp/wait/p1?since=open', {
      cache: 'no-store',
      signal: controller.signal,
    });
  });

  it('returns null for an error, an unknown status, a bad body, or a failed request', async () => {
    stubFetch(async () => new Response('slow down', { status: 429 }));
    expect(await waitShopPayment('p1', null)).toBeNull();
    stubFetch(async () => Response.json({ status: 'Pending', paymentStatus: 'refunding' }));
    expect(await waitShopPayment('p1', null)).toBeNull();
    stubFetch(async () => Response.json({ status: 1, paymentStatus: 'open' }));
    expect(await waitShopPayment('p1', null)).toBeNull();
    stubFetch(async () => Response.json(null));
    expect(await waitShopPayment('p1', null)).toBeNull();
    stubFetch(async () => {
      throw new Error('aborted');
    });
    expect(await waitShopPayment('p1', null)).toBeNull();
  });
});
