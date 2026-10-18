import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  fetchShopInvoice,
  fetchShopPayLink,
  openShopPayment,
  SHOP_PAYMENT_START_TIMEOUT_MS,
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
      signal: expect.any(AbortSignal),
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
      async () => Response.json({ payment: 7, expiresAt: opened.expiresAt }),
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
      const call = {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ amountSats: 21 }),
        signal: expect.any(AbortSignal),
      };
      expect(mock.mock.calls).toEqual([
        ['/pay/ada/payment', call],
        ['/pay/ada/payment', call],
      ]);
      expect(mock.mock.calls.some(([input]) => String(input).includes('/invoice'))).toBe(false);
    }
  });

  it('takes a success with a payment id as that payment, also without a readable window end', async () => {
    for (const expiresAt of [undefined, 'never', 7]) {
      const mock = stubFetch(async () => Response.json({ payment: 'p1', expiresAt }));
      expect(await openShopPayment('ada', 21)).toEqual({
        kind: 'opened',
        payment: 'p1',
        expiresAt: null,
      });
      expect(mock).toHaveBeenCalledTimes(1);
    }
  });

  it('gives up on a hanging start after the time limit, repeats once, and reports failed', async () => {
    vi.useFakeTimers();
    try {
      const mock = stubFetch(
        (_input, init) =>
          new Promise((_resolve, reject) => {
            init?.signal?.addEventListener('abort', () => {
              reject(new DOMException('aborted', 'AbortError'));
            });
          }),
      );
      const started = openShopPayment('ada', 21);
      await vi.advanceTimersByTimeAsync(SHOP_PAYMENT_START_TIMEOUT_MS - 1);
      expect(mock).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(1);
      expect(mock).toHaveBeenCalledTimes(2);
      await vi.advanceTimersByTimeAsync(SHOP_PAYMENT_START_TIMEOUT_MS);
      expect(await started).toEqual({ kind: 'failed' });
      expect(SHOP_PAYMENT_START_TIMEOUT_MS).toBe(15_000);
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('starts without AbortSignal.timeout, as on older Safari, and clears its timer', async () => {
    const original = Object.getOwnPropertyDescriptor(AbortSignal, 'timeout');
    Reflect.deleteProperty(AbortSignal, 'timeout');
    vi.useFakeTimers();
    try {
      expect('timeout' in AbortSignal).toBe(false);
      const mock = stubFetch(async () =>
        Response.json({ payment: 'p1', expiresAt: '2026-10-17T12:05:00.000Z' }),
      );
      expect(await openShopPayment('ada', 21)).toEqual({
        kind: 'opened',
        payment: 'p1',
        expiresAt: '2026-10-17T12:05:00.000Z',
      });
      expect(mock).toHaveBeenCalledWith(
        '/pay/ada/payment',
        expect.objectContaining({ method: 'POST' }),
      );
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
      if (original !== undefined) {
        Object.defineProperty(AbortSignal, 'timeout', original);
      }
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

  it('takes the 4xx or stablecoin_unavailable answer of the repeat like a first answer', async () => {
    const repeats: [() => Response, string][] = [
      [
        () =>
          Response.json(
            { error: 'Stablecoin payment is unavailable', code: 'stablecoin_unavailable' },
            { status: 503 },
          ),
        'invoice',
      ],
      [() => Response.json({ error: 'Enter a whole number of sats' }, { status: 400 }), 'invoice'],
      [
        () =>
          Response.json(
            { error: 'A payment is already open', code: 'payment_open' },
            { status: 409 },
          ),
        'charge',
      ],
    ];
    for (const [repeat, kind] of repeats) {
      let calls = 0;
      stubFetch(async () => {
        calls += 1;
        if (calls === 1) {
          throw new Error('offline');
        }
        return repeat();
      });
      expect(await openShopPayment('ada', 21)).toEqual({ kind });
      expect(calls).toBe(2);
    }
  });
});

describe('waitShopPayment', () => {
  it('returns every payment status with its DFX status', async () => {
    const bodies = [
      { status: 'Pending', paymentStatus: 'accepted' },
      { status: 'Pending', paymentStatus: 'ended' },
      { status: 'Completed', paymentStatus: 'paid' },
      { status: 'Cancelled', paymentStatus: 'ended' },
      { status: 'Expired', paymentStatus: 'ended' },
    ];
    for (const body of bodies) {
      stubFetch(async () => Response.json({ ...body, invoiceExpiresAt: EXPIRATION }));
      expect(await waitShopPayment('p1', 'open')).toEqual(body);
    }
  });

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

  it("reports a payment the api does not know as missing, only with the api's error body", async () => {
    const apiBody = {
      statusCode: 404,
      message: 'Not found',
      error: 'Not found',
      status: 'ERROR',
      reason: 'Not found',
    };
    stubFetch(async () => Response.json(apiBody, { status: 404 }));
    expect(await waitShopPayment('p1', 'open')).toBe('missing');
    stubFetch(async () => new Response('<!doctype html><h1>404</h1>', { status: 404 }));
    expect(await waitShopPayment('p1', 'open')).toBeNull();
    stubFetch(async () => Response.json({ error: 'Not found' }, { status: 404 }));
    expect(await waitShopPayment('p1', 'open')).toBeNull();
    stubFetch(async () => Response.json({ status: 'ERROR', reason: 'Other' }, { status: 404 }));
    expect(await waitShopPayment('p1', 'open')).toBeNull();
    stubFetch(async () => Response.json(null, { status: 404 }));
    expect(await waitShopPayment('p1', 'open')).toBeNull();
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
