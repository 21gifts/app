import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  fetchShopInvoice,
  fetchShopPayLink,
  openShopPayment,
  SHOP_PAYMENT_RECHECK_DELAY_MS,
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

/** The plain Lightning pay request (LUD-06), with no shop payment. */
const PLAIN = {
  tag: 'payRequest',
  callback: 'https://21.gifts/lnurlp/ada/invoice',
  minSendable: 1_000,
  maxSendable: 100_000_000_000,
  metadata: '[["text/plain","Ada"]]',
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

  it('calls only a real plain Lightning pay request plain', async () => {
    stubFetch(async () => Response.json(PLAIN));
    expect(await fetchShopPayLink('ada')).toEqual({ kind: 'plain' });
    stubFetch(async () => Response.json({ ...PLAIN, minSendable: 21_000, maxSendable: 21_000 }));
    expect(await fetchShopPayLink('ada')).toEqual({ kind: 'plain' });
    stubFetch(async () => Response.json({ ...PLAIN, possibleStandards: 'OpenCryptoPay' }));
    expect(await fetchShopPayLink('ada')).toEqual({ kind: 'plain' });
  });

  it('reports any other readable body as an error, so it never counts as no open amount', async () => {
    const others: unknown[] = [
      {},
      { status: 'ERROR', reason: 'Not found' },
      { possibleStandards: 'OpenCryptoPay' },
      { ...PLAIN, tag: 'withdrawRequest' },
      { ...PLAIN, callback: 7 },
      { ...PLAIN, metadata: undefined },
      { ...PLAIN, minSendable: '1000' },
      { ...PLAIN, maxSendable: null },
      { ...PLAIN, minSendable: 1.5 },
      { ...PLAIN, maxSendable: Number.MAX_SAFE_INTEGER + 1 },
      { ...PLAIN, minSendable: 0 },
      { ...PLAIN, minSendable: 2_000, maxSendable: 1_000 },
    ];
    for (const body of others) {
      stubFetch(async () => Response.json(body));
      expect(await fetchShopPayLink('ada')).toEqual({ kind: 'error' });
    }
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
  const T0 = Date.parse('2026-10-17T12:00:00.000Z');
  const call = {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ amountSats: 21 }),
    signal: expect.any(AbortSignal),
  };
  const unavailable = (): Response =>
    Response.json(
      { error: 'Stablecoin payment is unavailable', code: 'stablecoin_unavailable' },
      { status: 503 },
    );

  /** A start that never answers until its signal aborts, as a lost request does. */
  function hang(_input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    return new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => {
        reject(new DOMException('aborted', 'AbortError'));
      });
    });
  }

  /** Answers the start route with `starts` in turn and the pay link with `link`. */
  function stubStarts(
    starts: ((input: RequestInfo | URL, init?: RequestInit) => Promise<Response>)[],
    link: () => Promise<Response> = async () => Response.json(PLAIN),
  ) {
    let index = 0;
    return stubFetch(async (input, init) => {
      if (String(input).startsWith('/.well-known/lnurlp/')) {
        return link();
      }
      const next = starts[Math.min(index, starts.length - 1)] ?? hang;
      index += 1;
      return next(input, init);
    });
  }

  function linkReads(mock: { mock: { calls: unknown[][] } }): number {
    return mock.mock.calls.filter(([input]) => String(input).startsWith('/.well-known/lnurlp/'))
      .length;
  }

  function open(
    ambiguousAtMs: number | null = null,
    signal: AbortSignal = new AbortController().signal,
  ) {
    return openShopPayment('ada', 21, { ambiguousAtMs, signal });
  }

  afterEach(() => {
    vi.useRealTimers();
  });

  it('opens a payment with the entered sats', async () => {
    const mock = stubFetch(async () => Response.json(opened));
    expect(
      await openShopPayment('a da', 21, {
        ambiguousAtMs: null,
        signal: new AbortController().signal,
      }),
    ).toEqual({
      start: { kind: 'opened', ...opened },
      ambiguousAtMs: null,
    });
    expect(mock).toHaveBeenCalledTimes(1);
    expect(mock).toHaveBeenCalledWith('/pay/a%20da/payment', call);
  });

  it('shows the till charge on 409 payment_open', async () => {
    stubFetch(async () =>
      Response.json({ error: 'A payment is already open', code: 'payment_open' }, { status: 409 }),
    );
    expect(await open()).toEqual({ start: { kind: 'charge' }, ambiguousAtMs: null });
  });

  it('falls back to the invoice on a first stablecoin_unavailable or any other 4xx', async () => {
    const answers = [
      unavailable(),
      Response.json({ error: 'Enter a whole number of sats' }, { status: 400 }),
      Response.json({ error: 'Not found' }, { status: 404 }),
      Response.json({ error: 'Conflict', code: 'other' }, { status: 409 }),
      new Response('not json', { status: 409 }),
    ];
    for (const answer of answers) {
      const mock = stubFetch(async () => answer);
      expect(await open()).toEqual({ start: { kind: 'invoice' }, ambiguousAtMs: null });
      expect(mock).toHaveBeenCalledTimes(1);
      expect(linkReads(mock)).toBe(0);
    }
  });

  it('repeats an unknown outcome once and then reports failed from the end of the repeat', async () => {
    vi.useFakeTimers({ now: T0 });
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
      expect(await open()).toEqual({ start: { kind: 'failed' }, ambiguousAtMs: T0 });
      expect(mock.mock.calls).toEqual([
        ['/pay/ada/payment', call],
        ['/pay/ada/payment', call],
      ]);
    }
  });

  it('takes a success with a payment id as that payment, also without a readable window end', async () => {
    for (const expiresAt of [undefined, 'never', 7]) {
      const mock = stubFetch(async () => Response.json({ payment: 'p1', expiresAt }));
      expect(await open()).toEqual({
        start: { kind: 'opened', payment: 'p1', expiresAt: null },
        ambiguousAtMs: null,
      });
      expect(mock).toHaveBeenCalledTimes(1);
    }
  });

  it('gives up on a hanging start after the time limit, repeats once, and keeps the end of the repeat', async () => {
    vi.useFakeTimers({ now: T0 });
    const mock = stubFetch(hang);
    const started = open();
    await vi.advanceTimersByTimeAsync(SHOP_PAYMENT_START_TIMEOUT_MS - 1);
    expect(mock).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(mock).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(SHOP_PAYMENT_START_TIMEOUT_MS);
    expect(await started).toEqual({
      start: { kind: 'failed' },
      ambiguousAtMs: T0 + 2 * SHOP_PAYMENT_START_TIMEOUT_MS,
    });
    expect(SHOP_PAYMENT_START_TIMEOUT_MS).toBe(15_000);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('starts without AbortSignal.timeout, as on older Safari, and clears its timer', async () => {
    const original = Object.getOwnPropertyDescriptor(AbortSignal, 'timeout');
    Reflect.deleteProperty(AbortSignal, 'timeout');
    vi.useFakeTimers();
    try {
      expect('timeout' in AbortSignal).toBe(false);
      const mock = stubFetch(async () => Response.json(opened));
      expect((await open()).start).toEqual({ kind: 'opened', ...opened });
      expect(mock).toHaveBeenCalledWith(
        '/pay/ada/payment',
        expect.objectContaining({ method: 'POST' }),
      );
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      if (original !== undefined) {
        Object.defineProperty(AbortSignal, 'timeout', original);
      }
    }
  });

  it('takes a payment of the repeat and ends the ambiguous state', async () => {
    const mock = stubStarts([
      async () => new Response('timeout', { status: 504 }),
      async () => Response.json(opened),
    ]);
    expect(await open()).toEqual({ start: { kind: 'opened', ...opened }, ambiguousAtMs: null });
    expect(mock).toHaveBeenCalledTimes(2);
  });

  it('reloads the till charge on a 409 of the repeat and keeps the ambiguous state', async () => {
    vi.useFakeTimers({ now: T0 });
    const mock = stubStarts([
      async () => {
        throw new Error('offline');
      },
      async () =>
        Response.json(
          { error: 'A payment is already open', code: 'payment_open' },
          { status: 409 },
        ),
    ]);
    expect(await open()).toEqual({ start: { kind: 'charge' }, ambiguousAtMs: T0 });
    expect(linkReads(mock)).toBe(0);
  });

  it('waits until 20 s after the end of the lost call before a refused repeat reads the pay link', async () => {
    vi.useFakeTimers({ now: T0 });
    const mock = stubStarts([hang, async () => unavailable()]);
    const started = open();
    await vi.advanceTimersByTimeAsync(SHOP_PAYMENT_START_TIMEOUT_MS);
    expect(mock).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(SHOP_PAYMENT_RECHECK_DELAY_MS - 1);
    expect(linkReads(mock)).toBe(0);
    await vi.advanceTimersByTimeAsync(1);
    expect(await started).toEqual({
      start: { kind: 'invoice' },
      ambiguousAtMs: T0 + SHOP_PAYMENT_START_TIMEOUT_MS,
    });
    expect(linkReads(mock)).toBe(1);
    expect(SHOP_PAYMENT_RECHECK_DELAY_MS).toBe(20_000);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('reports failed when the pay link read after a refusal shows an open amount or fails', async () => {
    vi.useFakeTimers({ now: T0 });
    const links: (() => Promise<Response>)[] = [
      async () => Response.json(OPEN_AMOUNT),
      async () => new Response('busy', { status: 503 }),
      async () => Response.json({}),
    ];
    for (const link of links) {
      const mock = stubStarts(
        [async () => new Response('bad gateway', { status: 502 }), async () => unavailable()],
        link,
      );
      const started = open();
      await vi.advanceTimersByTimeAsync(SHOP_PAYMENT_RECHECK_DELAY_MS);
      expect(await started).toEqual({ start: { kind: 'failed' }, ambiguousAtMs: T0 });
      expect(linkReads(mock)).toBe(1);
      expect(mock.mock.calls.some(([input]) => String(input).includes('/invoice'))).toBe(false);
      vi.setSystemTime(T0);
    }
  });

  it('counts the wait of a later refused call from the stored end, for any amount', async () => {
    vi.useFakeTimers({ now: T0 });
    const refused = async (): Promise<Response> =>
      Response.json({ error: 'Enter a whole number of sats' }, { status: 400 });
    let mock = stubStarts([refused]);
    const elapsed = open(T0 - SHOP_PAYMENT_RECHECK_DELAY_MS);
    await vi.advanceTimersByTimeAsync(0);
    expect(await elapsed).toEqual({
      start: { kind: 'invoice' },
      ambiguousAtMs: T0 - SHOP_PAYMENT_RECHECK_DELAY_MS,
    });
    expect(mock).toHaveBeenCalledTimes(2);
    expect(linkReads(mock)).toBe(1);

    mock = stubStarts([refused]);
    const started = openShopPayment('ada', 4_000, {
      ambiguousAtMs: T0 - 5_000,
      signal: new AbortController().signal,
    });
    await vi.advanceTimersByTimeAsync(SHOP_PAYMENT_RECHECK_DELAY_MS - 5_001);
    expect(linkReads(mock)).toBe(0);
    await vi.advanceTimersByTimeAsync(1);
    expect((await started).start).toEqual({ kind: 'invoice' });
    expect(mock.mock.calls[0]).toEqual([
      '/pay/ada/payment',
      { ...call, body: JSON.stringify({ amountSats: 4_000 }) },
    ]);
  });

  it('handles a later call in the ambiguous state without a repeat', async () => {
    vi.useFakeTimers({ now: T0 });
    const earlier = T0 - 60_000;
    let mock = stubStarts([
      async () =>
        Response.json(
          { error: 'A payment is already open', code: 'payment_open' },
          { status: 409 },
        ),
    ]);
    expect(await open(earlier)).toEqual({ start: { kind: 'charge' }, ambiguousAtMs: earlier });
    mock = stubStarts([async () => Response.json(opened)]);
    expect(await open(earlier)).toEqual({
      start: { kind: 'opened', ...opened },
      ambiguousAtMs: null,
    });
    mock = stubStarts([async () => new Response('bad gateway', { status: 502 })]);
    expect(await open(earlier)).toEqual({ start: { kind: 'failed' }, ambiguousAtMs: T0 });
    expect(mock).toHaveBeenCalledTimes(1);
    expect(linkReads(mock)).toBe(0);
  });

  it('stops without a repeat or a pay-link read once the signal aborts', async () => {
    vi.useFakeTimers({ now: T0 });
    // Already aborted: nothing is sent.
    let controller = new AbortController();
    controller.abort();
    let mock = stubStarts([async () => Response.json(opened)]);
    expect(await open(null, controller.signal)).toEqual({
      start: { kind: 'aborted' },
      ambiguousAtMs: null,
    });
    expect(mock).not.toHaveBeenCalled();

    // During the first call: no repeat.
    controller = new AbortController();
    mock = stubStarts([hang]);
    let started = open(null, controller.signal);
    await vi.advanceTimersByTimeAsync(1_000);
    controller.abort();
    expect(await started).toEqual({ start: { kind: 'aborted' }, ambiguousAtMs: null });
    expect(mock).toHaveBeenCalledTimes(1);

    // During the repeat: the state stays.
    vi.setSystemTime(T0);
    controller = new AbortController();
    mock = stubStarts([async () => new Response('bad gateway', { status: 502 }), hang]);
    started = open(null, controller.signal);
    await vi.advanceTimersByTimeAsync(1_000);
    expect(mock).toHaveBeenCalledTimes(2);
    controller.abort();
    expect(await started).toEqual({ start: { kind: 'aborted' }, ambiguousAtMs: T0 });

    // During the 20 s wait: no pay-link read.
    vi.setSystemTime(T0);
    controller = new AbortController();
    mock = stubStarts([
      async () => new Response('bad gateway', { status: 502 }),
      async () => unavailable(),
    ]);
    started = open(null, controller.signal);
    await vi.advanceTimersByTimeAsync(10_000);
    controller.abort();
    expect(await started).toEqual({ start: { kind: 'aborted' }, ambiguousAtMs: T0 });
    await vi.advanceTimersByTimeAsync(SHOP_PAYMENT_RECHECK_DELAY_MS);
    expect(linkReads(mock)).toBe(0);
    expect(vi.getTimerCount()).toBe(0);

    // During the pay-link read: its answer is dropped.
    controller = new AbortController();
    const reading = controller;
    mock = stubStarts([async () => unavailable()], async () => {
      reading.abort();
      return Response.json(PLAIN);
    });
    started = open(T0 - SHOP_PAYMENT_RECHECK_DELAY_MS, controller.signal);
    await vi.advanceTimersByTimeAsync(0);
    expect(await started).toEqual({
      start: { kind: 'aborted' },
      ambiguousAtMs: T0 - SHOP_PAYMENT_RECHECK_DELAY_MS,
    });
    expect(linkReads(mock)).toBe(1);
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
