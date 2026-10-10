// @vitest-environment node
import { startSpan, type Breadcrumb, type ErrorEvent, type Event } from '@sentry/nextjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  forwardSentryEnvelope,
  SENTRY_TUNNEL_PATH,
  sentryOptions,
  traceWallet,
  type SentryInitOptions,
} from '@/lib/sentry';

vi.mock('@sentry/nextjs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@sentry/nextjs')>();
  return { ...actual, startSpan: vi.fn(actual.startSpan) };
});

const DSN = 'https://publickey@errors.example/42';
const PHRASE =
  'abandon ability able about above absent absorb abstract absurd abuse access accident';
const INVOICE = 'lnbc2500u1pvjluezpp5qqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqypq';
const HEX64 = 'ab'.repeat(32);

beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_SENTRY_DSN', DSN);
  vi.stubEnv('NEXT_PUBLIC_SENTRY_ENVIRONMENT', 'staging');
  vi.stubEnv('NEXT_PUBLIC_APP_VERSION', '123');
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

/**
 * Options with error reporting on.
 *
 * @param runtime - Runtime to build for.
 * @returns The options (fails the test when off).
 */
function on(runtime: 'browser' | 'server' = 'browser'): SentryInitOptions {
  const options = sentryOptions(runtime);
  if (options === null) {
    throw new Error('expected error reporting to be on');
  }
  return options;
}

/**
 * Scrub one string through `beforeSend` (as an exception value).
 *
 * @param value - Text to scrub.
 * @returns The scrubbed text.
 */
function scrubText(value: string): string | undefined {
  const event = on().beforeSend({ type: undefined, exception: { values: [{ value }] } });
  return event.exception?.values?.[0]?.value;
}

describe('sentryOptions', () => {
  it('is off when the DSN is unset', () => {
    vi.stubEnv('NEXT_PUBLIC_SENTRY_DSN', undefined);
    expect(sentryOptions('browser')).toBeNull();
    expect(sentryOptions('server')).toBeNull();
  });

  it('is off for the empty string entrypoint.sh substitutes', () => {
    vi.stubEnv('NEXT_PUBLIC_SENTRY_DSN', '');
    expect(sentryOptions('browser')).toBeNull();
  });

  it.each([
    ['an unsubstituted placeholder', '__NEXT_PUBLIC_SENTRY_DSN__'],
    ['a non-http scheme', 'ftp://key@errors.example/42'],
    ['a DSN without a public key', 'https://errors.example/42'],
    ['a DSN without a numeric project', 'https://key@errors.example/project'],
  ])('is off for %s', (_label, dsn) => {
    vi.stubEnv('NEXT_PUBLIC_SENTRY_DSN', dsn);
    expect(sentryOptions('browser')).toBeNull();
  });

  it('is on with a DSN: errors only, no personal data, release from the app version', () => {
    const options = on('browser');
    expect(options).toMatchObject({
      dsn: DSN,
      release: '123',
      environment: 'staging',
      tunnel: SENTRY_TUNNEL_PATH,
      tracesSampleRate: 0.1,
      traceLifecycle: 'static',
      tracePropagationTargets: [],
      sendClientReports: false,
      includeLocalVariables: false,
      dataCollection: {
        userInfo: false,
        cookies: false,
        httpBodies: [],
        urlQueryParams: false,
        stackFrameVariables: false,
      },
    });
  });

  it('routes browser reports through the same-origin tunnel only', () => {
    expect(on('browser').tunnel).toBe('/monitoring');
    expect(on('server').tunnel).toBeUndefined();
  });

  it('sends no environment name when none is set', () => {
    vi.stubEnv('NEXT_PUBLIC_SENTRY_ENVIRONMENT', '');
    expect(on()).not.toHaveProperty('environment');
  });

  it('drops session, local-variable, and console integrations and keeps browser tracing', () => {
    const names = [
      'BrowserSession',
      'BrowserTracing',
      'ProcessSession',
      'LocalVariablesAsync',
      'Console',
      'CaptureConsole',
      'ConsoleLogs',
      'GlobalHandlers',
      'Breadcrumbs',
    ];
    const kept = on().integrations(names.map((name) => ({ name })));
    expect(kept.map((item) => item.name)).toEqual([
      'BrowserTracing',
      'GlobalHandlers',
      'Breadcrumbs',
    ]);
  });

  it('adds trace headers to no request, in the browser or on the server', () => {
    expect(on('browser').tracePropagationTargets).toEqual([]);
    expect(on('server').tracePropagationTargets).toEqual([]);
  });

  it('samples 10% of browser traces when no rate is set', () => {
    vi.stubEnv('NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE', undefined);
    expect(on('browser').tracesSampleRate).toBe(0.1);
  });

  it.each([
    ['empty', '', 0.1],
    ['not a number', 'often', 0.1],
    ['above 1', '2', 0.1],
    ['0.25', '0.25', 0.25],
    ['0', '0', 0],
    ['1', '1', 1],
  ])('reads a browser sample rate that is %s', (_label, value, rate) => {
    vi.stubEnv('NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE', value);
    const options = on('browser');
    expect(options.tracesSampleRate).toBe(rate);
    expect(options.tracesSampler()).toBe(rate);
  });

  it('lets the rate decide even when the page says its server trace was not sampled', () => {
    vi.stubEnv('NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE', '0.5');
    const sampler = on('browser').tracesSampler as (context: { parentSampled: boolean }) => number;
    expect(sampler({ parentSampled: false })).toBe(0.5);
  });

  it('samples no server traces, whatever rate is set', () => {
    vi.stubEnv('NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE', '1');
    const options = on('server');
    expect(options.tracesSampleRate).toBe(0);
    expect(options.tracesSampler()).toBe(0);
    expect(options.traceLifecycle).toBe('static');
  });
});

describe('beforeSendTransaction scrubber', () => {
  /**
   * Scrub one transaction through `beforeSendTransaction`.
   *
   * @param event - Transaction fields besides `type`.
   * @returns The scrubbed transaction.
   */
  function scrubTransaction(event: Event): Event {
    return on().beforeSendTransaction({ ...event, type: 'transaction' });
  }

  it('removes the query string and fragment from the transaction name', () => {
    expect(scrubTransaction({ transaction: `/pl/?lightning=${INVOICE}#top` }).transaction).toBe(
      '/pl/',
    );
  });

  it('removes queries and fragments from span descriptions and span URLs', () => {
    const scrubbed = scrubTransaction({
      transaction: '/pl/',
      request: { url: 'https://app.example/pl/?lightning=x' },
      spans: [
        {
          span_id: '1',
          trace_id: 'a'.repeat(32),
          start_timestamp: 1,
          status: 'ok',
          description: 'GET /pl/?lightning=LNURL1DP68GURN8GHJ7MRWW4EXCTNXD9SHG6NPVCHXXMMD',
          data: {
            url: 'https://app.example/pl/?lightning=x#frag',
            'http.url': 'https://app.example/gifts?after=7',
            'url.full': '/wallet/payment?id=p1',
            'http.query': '?lightning=x',
            'url.query': 'id=p1',
            'http.fragment': '#frag',
            'http.response.status_code': 200,
          },
        },
      ],
    });
    expect(scrubbed.spans?.[0]?.description).toBe('GET /pl/');
    expect(scrubbed.spans?.[0]?.data).toEqual({
      url: 'https://app.example/pl/',
      'http.url': 'https://app.example/gifts',
      'url.full': '/wallet/payment',
      'http.query': '[Filtered]',
      'url.query': '[Filtered]',
      'http.fragment': '[Filtered]',
      'http.response.status_code': 200,
    });
  });

  it('redacts secrets and secret-bearing keys anywhere in a transaction', () => {
    const scrubbed = scrubTransaction({
      transaction: 'wallet.send',
      user: { id: 'acc_1', username: 'ada' },
      request: {
        url: 'https://app.example/wallet?id=1',
        query_string: 'id=1',
        cookies: { session: 'x' },
        headers: { Authorization: 'Bearer abc', 'User-Agent': 'phone' },
      },
      contexts: {
        trace: {
          trace_id: 'a'.repeat(32),
          span_id: 'b'.repeat(16),
          data: { invoice: INVOICE, token: 'secret', route: 'spark', note: PHRASE, key: HEX64 },
        },
      },
      spans: [
        {
          span_id: '2',
          trace_id: 'a'.repeat(32),
          start_timestamp: 1,
          status: 'ok',
          description: `pay ${INVOICE}`,
          data: { mnemonic: PHRASE, prf: 'bytes', bytes: new Uint8Array([1]) as unknown as string },
        },
      ],
      measurements: { lcp: { value: 1200, unit: 'millisecond' } },
    });
    expect(scrubbed).not.toHaveProperty('user');
    expect(scrubbed.request).toEqual({
      url: 'https://app.example/wallet',
      headers: { 'User-Agent': 'phone' },
    });
    expect(scrubbed.contexts?.trace?.data).toEqual({
      invoice: '[Filtered]',
      token: '[Filtered]',
      route: 'spark',
      note: '[Filtered]',
      key: '[Filtered]',
    });
    expect(scrubbed.contexts?.trace?.trace_id).toBe('a'.repeat(32));
    expect(scrubbed.spans?.[0]?.description).toBe('pay [Filtered]');
    expect(scrubbed.spans?.[0]?.data).toEqual({
      mnemonic: '[Filtered]',
      prf: '[Filtered]',
      bytes: '[Filtered]',
    });
    expect(scrubbed.measurements).toEqual({ lcp: { value: 1200, unit: 'millisecond' } });
  });

  /**
   * A finished span for these tests.
   *
   * @param id - Span id.
   * @param fields - Description and data.
   * @returns The span.
   */
  function span(
    id: string,
    fields: { description?: string; data?: Record<string, string | number | boolean> },
  ): NonNullable<Event['spans']>[number] {
    return {
      span_id: id,
      trace_id: 'a'.repeat(32),
      start_timestamp: 1,
      status: 'ok',
      data: fields.data ?? {},
      ...(fields.description === undefined ? {} : { description: fields.description }),
    };
  }

  it('drops spans that reach another origin and keeps the page origin', () => {
    const scrubbed = scrubTransaction({
      transaction: 'wallet.prepare',
      request: { url: 'https://app.example/welcome' },
      spans: [
        span('own', {
          description: 'GET https://app.example/gifts',
          data: { 'url.full': 'https://app.example/gifts' },
        }),
        span('relative', { description: 'POST /messages/7/invoice' }),
        span('lnurl', {
          description: 'GET https://payee.example/.well-known/lnurlp/alice',
          data: { 'url.full': 'https://payee.example/.well-known/lnurlp/alice' },
        }),
        span('chain', { description: 'GET https://chain.example/api/address/x' }),
        span('http-url', { data: { 'http.url': 'http://app.example:8080/x' } }),
        span('url', { data: { url: 'https://cdn.example/a.js' } }),
        span('resource', {
          description: '/_next/a.js',
          data: { 'http.request.same_origin': false },
        }),
        span('older', { description: '/_next/b.js', data: { 'url.same_origin': false } }),
        span('own-resource', {
          description: '/_next/c.js',
          data: { 'http.request.same_origin': true },
        }),
        span('broken', { description: 'GET https://[bad/x' }),
        span('number', { data: { 'url.full': 7 } }),
      ],
    });
    expect(scrubbed.spans?.map((item) => item.span_id)).toEqual([
      'own',
      'relative',
      'own-resource',
      'number',
    ]);
  });

  it('drops every span with an absolute URL when the page origin is unknown', () => {
    const scrubbed = scrubTransaction({
      transaction: 'wallet.connect',
      spans: [
        span('absolute', { description: 'GET https://app.example/gifts' }),
        span('relative', { description: 'GET /gifts' }),
        span('plain', {}),
      ],
    });
    expect(scrubbed.spans?.map((item) => item.span_id)).toEqual(['relative', 'plain']);
  });

  it('removes web-vital element descriptors from the trace and its spans', () => {
    const scrubbed = scrubTransaction({
      transaction: '/welcome',
      request: { url: 'https://app.example/welcome' },
      contexts: {
        trace: {
          trace_id: 'a'.repeat(32),
          span_id: 'b'.repeat(16),
          data: {
            'lcp.element': 'body > img[alt="Photo by Ada"]',
            'lcp.url': 'https://app.example/messages/7/photo',
            'lcp.id': 'hero',
            'lcp.size': 24_000,
            'cls.source.1': 'div.card > p[title="Ada"]',
            'url.template': '/welcome',
          },
        },
      },
      spans: [
        span('vital', {
          description: 'Main UI thread blocked',
          data: { 'browser.web_vital.lcp.element': 'img', 'browser.web_vital.cls.source.2': 'p' },
        }),
      ],
    });
    expect(scrubbed.contexts?.trace?.data).toEqual({
      'lcp.size': 24_000,
      'url.template': '/welcome',
    });
    expect(scrubbed.spans?.[0]?.data).toEqual({});
  });

  it('drops breadcrumbs, so click labels such as typed amount digits are not sent', () => {
    const crumbs: Breadcrumb[] = ['2', '1', '0'].map((digit) => ({
      category: 'ui.click',
      message: `button[aria-label="${digit}"]`,
    }));
    const scrubbed = scrubTransaction({ transaction: 'wallet.prepare', breadcrumbs: crumbs });
    expect(scrubbed).not.toHaveProperty('breadcrumbs');
    expect(on().beforeSend({ type: undefined, breadcrumbs: crumbs }).breadcrumbs).toHaveLength(3);
  });

  it('keeps only the sampling context and span count of the processing metadata', () => {
    const scrubbed = scrubTransaction({
      transaction: '/legal',
      sdkProcessingMetadata: {
        capturedSpanScope: { client: { options: { dsn: DSN } } },
        dynamicSamplingContext: { trace_id: 'a'.repeat(32), transaction: '/pl/?lightning=x' },
        spanCountBeforeProcessing: 4,
      } as unknown as NonNullable<Event['sdkProcessingMetadata']>,
    });
    expect(scrubbed.sdkProcessingMetadata).toEqual({
      dynamicSamplingContext: { trace_id: 'a'.repeat(32), transaction: '/pl/' },
      spanCountBeforeProcessing: 4,
    });
    expect(
      scrubTransaction({ transaction: 'x', sdkProcessingMetadata: {} }).sdkProcessingMetadata,
    ).toEqual({});
  });

  it('leaves a transaction without spans or trace data intact', () => {
    expect(scrubTransaction({ transaction: '/legal', contexts: {} })).toEqual({
      transaction: '/legal',
      type: 'transaction',
      contexts: {},
    });
  });
});

describe('traceWallet', () => {
  beforeEach(() => {
    vi.mocked(startSpan).mockClear();
  });

  it('starts a wallet span of its own with a fixed name and no attributes by default', async () => {
    await expect(traceWallet('wallet.connect', async () => 'connected')).resolves.toBe('connected');
    expect(startSpan).toHaveBeenCalledWith(
      { name: 'wallet.connect', op: 'wallet', attributes: {}, parentSpan: null },
      expect.any(Function),
    );
  });

  it('passes the fixed route or prompt attribute on', async () => {
    await traceWallet('wallet.send', async () => undefined, { route: 'spark' });
    await traceWallet('wallet.passkey', async () => undefined, { prompt: 'login' });
    expect(vi.mocked(startSpan).mock.calls.map(([options]) => options.attributes)).toEqual([
      { route: 'spark' },
      { prompt: 'login' },
    ]);
  });

  it('passes a rejection on unchanged', async () => {
    const error = new Error('connect failed');
    await expect(
      traceWallet('wallet.connect', async () => {
        throw error;
      }),
    ).rejects.toBe(error);
  });
});

describe('beforeSend scrubber', () => {
  it('redacts a 12-word recovery phrase', () => {
    expect(scrubText(`restore failed: ${PHRASE}`)).toBe('restore failed: [Filtered]');
  });

  it('redacts a 24-word phrase written as a quoted list', () => {
    const words = `${PHRASE} ${PHRASE}`.split(' ');
    expect(scrubText(JSON.stringify(words))).toBe('["[Filtered]"]');
  });

  it('redacts a phrase in upper or title case', () => {
    expect(scrubText(PHRASE.toUpperCase())).toBe('[Filtered]');
    const title = PHRASE.split(' ')
      .map((word) => word[0]?.toUpperCase() + word.slice(1))
      .join(' ');
    expect(scrubText(title)).toBe('[Filtered]');
  });

  it('keeps an ordinary short message', () => {
    expect(scrubText('Failed to fetch the forum feed')).toBe('Failed to fetch the forum feed');
  });

  it.each([
    ['a BOLT11 mainnet invoice', INVOICE],
    ['a BOLT11 testnet invoice', 'lntb1500n1pvjluezpp5qqqsyqcyq5rqwzqfqqqsyqcyq5'],
    [
      'a bech32 LNURL',
      'lnurl1dp68gurn8ghj7um9wfmxjcm99e3k7mf0v9cxj0m385ekvcenxc6r2c35xvukxefcv5mkvv34x5ekzd3ev56nyd3hxqurzepexejxxepnxscrvwfnv9nxzcn9xq6xyefhvgcxxcmyxymnserxfq5fns',
    ],
    ['an upper-case LNURL', 'LNURL1DP68GURN8GHJ7UM9WFMXJCM99E3K7MF0V9CXJ0M385EKVCENXC6R2C35'],
    ['a Spark address', 'spark1pgss9qf0yp5y0sv5v8wtlm7mn0q7cfhjvcq5m4mq4dg9xr0p0c4mr7xmgaqh8a'],
    ['a Spark regtest address', 'sparkrt1pgss9qf0yp5y0sv5v8wtlm7mn0q7cfhjvcq5m4mq4dg9xr0p0c'],
    ['64 hex digits', HEX64],
  ])('redacts %s', (_label, secret) => {
    expect(scrubText(`pay ${secret} failed`)).toBe('pay [Filtered] failed');
  });

  it('keeps the lnurlp path segment of a lightning address URL', () => {
    expect(scrubText('GET /.well-known/lnurlp/alice')).toBe('GET /.well-known/lnurlp/alice');
  });

  it('redacts base-chain addresses but not trace ids', () => {
    const address = 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq';
    expect(scrubText(`pay ${address} now`)).toBe('pay [Filtered] now');
    expect(scrubText(`pay ${address.toUpperCase()}`)).toBe('pay [Filtered]');
    expect(scrubText('trace bc1aaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')).toBe(
      'trace bc1aaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    );
  });

  it('redacts bearer tokens', () => {
    expect(scrubText('Authorization: Bearer sess-abc.def')).toBe(
      'Authorization: Bearer [Filtered]',
    );
  });

  it('redacts the stored session token next to its storage key', () => {
    expect(scrubText('21gifts.session=sess-e2e; theme=dark')).toBe(
      '21gifts.session=[Filtered]; theme=dark',
    );
  });

  it('removes query strings and fragments from URLs and paths', () => {
    expect(scrubText('load https://21.gifts/pay?invoice=x#y and /me?token=z failed')).toBe(
      'load https://21.gifts/pay and /me failed',
    );
  });

  it('redacts values under secret-bearing keys, at any depth', () => {
    const event = on().beforeSend({
      type: undefined,
      extra: {
        mnemonic: 'a',
        recoveryPhrase: 'b',
        words: ['c'],
        seed: 'd',
        sessionToken: 'e',
        apiSecret: 'f',
        prf: 'g',
        prfFirst: 'g2',
        invoice: 'h',
        pr: 'i',
        '21gifts.session': 'j',
        Authorization: 'k',
        nested: { inner: { password: 'l', amount: 21 } },
        kept: 'safe',
        flag: true,
      },
    });
    expect(event.extra).toEqual({
      mnemonic: '[Filtered]',
      recoveryPhrase: '[Filtered]',
      words: '[Filtered]',
      seed: '[Filtered]',
      sessionToken: '[Filtered]',
      apiSecret: '[Filtered]',
      prf: '[Filtered]',
      prfFirst: '[Filtered]',
      invoice: '[Filtered]',
      pr: '[Filtered]',
      '21gifts.session': '[Filtered]',
      Authorization: '[Filtered]',
      nested: { inner: { password: '[Filtered]', amount: 21 } },
      kept: 'safe',
      flag: true,
    });
  });

  it('redacts an array of 12 phrase words but keeps other arrays', () => {
    const event = on().beforeSend({
      type: undefined,
      extra: {
        list: PHRASE.split(' '),
        other: ['one', 'two'],
        mixed: [...PHRASE.split(' ', 11), 7],
      },
    });
    expect(event.extra).toEqual({
      list: '[Filtered]',
      other: ['one', 'two'],
      mixed: [...PHRASE.split(' ', 11), 7],
    });
  });

  it('redacts raw bytes and upper-case phrase word arrays', () => {
    const event = on().beforeSend({
      type: undefined,
      extra: { bytes: new Uint8Array([1, 2, 3]), list: PHRASE.toUpperCase().split(' ') },
    });
    expect(event.extra).toEqual({ bytes: '[Filtered]', list: '[Filtered]' });
  });

  it('replaces values nested too deep to inspect', () => {
    let deep: Record<string, unknown> = { leaf: 'x' };
    for (let index = 0; index < 15; index += 1) {
      deep = { next: deep };
    }
    const event = on().beforeSend({ type: undefined, extra: deep });
    expect(JSON.stringify(event.extra)).toContain('"[Filtered]"');
    expect(JSON.stringify(event.extra)).not.toContain('leaf');
  });

  it('removes the user, cookies, body, query string, and all but two headers', () => {
    const event = on('server').beforeSend({
      type: undefined,
      user: { id: 'acc_1', username: 'Ada', ip_address: '203.0.113.9' },
      request: {
        method: 'POST',
        url: 'https://21.gifts/view/' + HEX64 + '?k=v',
        cookies: { session: 'x' },
        data: { pr: INVOICE },
        query_string: 'k=v',
        env: { REMOTE_ADDR: '203.0.113.9' },
        headers: {
          'User-Agent': 'Mozilla/5.0',
          Referer: 'https://21.gifts/me?tab=wallet',
          Authorization: 'Bearer abc',
          Cookie: 'a=b',
          'X-Forwarded-For': '203.0.113.9',
        },
      },
    });
    expect(event.user).toBeUndefined();
    expect(event.request).toEqual({
      method: 'POST',
      url: 'https://21.gifts/view/[Filtered]',
      headers: { 'User-Agent': 'Mozilla/5.0', Referer: 'https://21.gifts/me' },
    });
  });

  it('keeps a request block without method, URL, or headers empty', () => {
    const event = on('server').beforeSend({ type: undefined, request: {} });
    expect(event.request).toEqual({ headers: {} });
  });

  it('removes stack frame variables', () => {
    const event = on('server').beforeSend({
      type: undefined,
      exception: {
        values: [
          { value: 'x', stacktrace: { frames: [{ function: 'pay', vars: { invoice: INVOICE } }] } },
          { value: 'y' },
        ],
      },
    });
    expect(event.exception?.values?.[0]?.stacktrace?.frames).toEqual([{ function: 'pay' }]);
  });

  it('filters the breadcrumbs attached to the event', () => {
    const breadcrumbs: Breadcrumb[] = [
      { category: 'console', message: PHRASE },
      { category: 'navigation', data: { from: '/a?x=1', to: '/b#y' } },
    ];
    const event = on().beforeSend({ type: undefined, breadcrumbs });
    expect(event.breadcrumbs).toEqual([{ category: 'navigation', data: { from: '/a', to: '/b' } }]);
  });

  it('leaves an event without request, breadcrumbs, or exception intact', () => {
    const event: ErrorEvent = { type: undefined, message: 'plain', level: 'error' };
    expect(on().beforeSend(event)).toEqual(event);
  });
});

describe('beforeBreadcrumb scrubber', () => {
  it('drops console breadcrumbs', () => {
    expect(on().beforeBreadcrumb({ category: 'console', message: 'hello' })).toBeNull();
  });

  it.each(['fetch', 'xhr', 'http'])(
    'keeps only method, path, and status of a %s breadcrumb',
    (category) => {
      expect(
        on().beforeBreadcrumb({
          type: 'http',
          category,
          level: 'info',
          timestamp: 1,
          message: 'body',
          data: {
            method: 'POST',
            url: `https://21.gifts/pay/${HEX64}?invoice=${INVOICE}`,
            status_code: 200,
            request_body_size: 10,
            response_body_size: 20,
          },
        }),
      ).toEqual({
        type: 'http',
        category,
        level: 'info',
        timestamp: 1,
        data: { method: 'POST', url: '/pay/[Filtered]', status_code: 200 },
      });
    },
  );

  it('keeps a relative request URL as its path', () => {
    expect(
      on().beforeBreadcrumb({ category: 'fetch', data: { url: '/me?x=1', method: 'GET' } }),
    ).toEqual({ category: 'fetch', data: { method: 'GET', url: '/me' } });
  });

  it('keeps an empty request breadcrumb without data', () => {
    expect(on().beforeBreadcrumb({ category: 'xhr' })).toEqual({ category: 'xhr', data: {} });
  });

  it('scrubs other breadcrumbs', () => {
    expect(on().beforeBreadcrumb({ category: 'ui.click', message: `copied ${INVOICE}` })).toEqual({
      category: 'ui.click',
      message: 'copied [Filtered]',
    });
  });

  it('scrubs a breadcrumb without category', () => {
    expect(on().beforeBreadcrumb({ message: `key ${HEX64}` })).toEqual({
      message: 'key [Filtered]',
    });
  });
});

describe('forwardSentryEnvelope', () => {
  /**
   * Envelope as the browser SDK posts it to the tunnel.
   *
   * @param header - Envelope header.
   * @returns POST request to the tunnel.
   */
  function envelope(header: string): Request {
    return new Request('http://localhost/monitoring', {
      method: 'POST',
      body: `${header}\n{"type":"event"}\n{"message":"x"}`,
    });
  }

  it('answers 404 and sends nothing while error reporting is off', async () => {
    vi.stubEnv('NEXT_PUBLIC_SENTRY_DSN', '');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const response = await forwardSentryEnvelope(envelope(JSON.stringify({ dsn: DSN })));
    expect(response.status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('forwards an envelope for the configured project and passes the status on', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{"id":"1"}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const response = await forwardSentryEnvelope(
      envelope(JSON.stringify({ dsn: DSN, sent_at: 'now' })),
    );
    expect(response.status).toBe(200);
    expect(await response.text()).toBe('');
    expect(fetchMock).toHaveBeenCalledWith('https://errors.example/api/42/envelope/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-sentry-envelope' },
      body: expect.any(Uint8Array),
    });
  });

  it('keeps a DSN path prefix and port in the envelope URL', async () => {
    vi.stubEnv('NEXT_PUBLIC_SENTRY_DSN', 'http://key@errors.example:9000/sentry/7');
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 429 }));
    vi.stubGlobal('fetch', fetchMock);
    const response = await forwardSentryEnvelope(
      envelope(JSON.stringify({ dsn: 'http://key@errors.example:9000/sentry/7' })),
    );
    expect(response.status).toBe(429);
    expect(fetchMock.mock.calls[0]?.[0]).toBe('http://errors.example:9000/sentry/api/7/envelope/');
  });

  it.each([
    ['another host', JSON.stringify({ dsn: 'https://publickey@elsewhere.example/42' })],
    ['another project', JSON.stringify({ dsn: 'https://publickey@errors.example/43' })],
    ['no DSN in the header', JSON.stringify({ sent_at: 'now' })],
    ['a DSN that is not text', JSON.stringify({ dsn: 42 })],
    ['a header that is not an object', 'null'],
    ['a header that is not JSON', 'not json'],
  ])('refuses an envelope for %s', async (_label, header) => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    expect((await forwardSentryEnvelope(envelope(header))).status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('refuses an envelope that is a header line only without a DSN', async () => {
    vi.stubGlobal('fetch', vi.fn());
    const request = new Request('http://localhost/monitoring', { method: 'POST', body: '{}' });
    expect((await forwardSentryEnvelope(request)).status).toBe(400);
  });

  it.each([
    ['without a newline', ''],
    ['followed by blank lines', '\n\n'],
  ])('refuses an envelope that is a header line only, %s', async (_label, rest) => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const request = new Request('http://localhost/monitoring', {
      method: 'POST',
      body: `${JSON.stringify({ dsn: DSN })}${rest}`,
    });
    expect((await forwardSentryEnvelope(request)).status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  /**
   * POST of an envelope with the configured DSN and these lines after its header.
   *
   * @param lines - Item headers and payloads.
   * @returns POST request to the tunnel.
   */
  function items(...lines: string[]): Request {
    return new Request('http://localhost/monitoring', {
      method: 'POST',
      body: [JSON.stringify({ dsn: DSN }), ...lines].join('\n'),
    });
  }

  it.each([
    ['a transaction', items('{"type":"transaction"}', '{"spans":[]}')],
    ['an error and a transaction', items('{"type":"event"}', '{}', '{"type":"transaction"}', '{}')],
    ['an item with a length', items('{"type":"transaction","length":2}', '{}', '')],
    ['a length that ends the envelope', items('{"type":"event","length":2}', '{}')],
    ['an item without a payload', items('{"type":"event"}')],
  ])('forwards an envelope with %s', async (_label, request) => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    expect((await forwardSentryEnvelope(request)).status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['a session', items('{"type":"session"}', '{}')],
    ['a client report', items('{"type":"client_report"}', '{}')],
    ['a standalone span', items('{"type":"span"}', '{}')],
    ['a replay', items('{"type":"replay_event"}', '{}')],
    ['a profile', items('{"type":"profile"}', '{}')],
    ['a log', items('{"type":"log"}', '{}')],
    ['feedback', items('{"type":"feedback"}', '{}')],
    [
      'an attachment after an error',
      items('{"type":"event"}', '{}', '{"type":"attachment","length":1}', 'x'),
    ],
    ['an item header that is not JSON', items('not json', '{}')],
    ['an item header without a type', items('{"length":2}', '{}')],
    ['an item header that is null', items('null', '{}')],
    ['a length past the end', items('{"type":"event","length":99}', '{}')],
    ['a negative length', items('{"type":"event","length":-1}', '{}')],
    ['a fractional length', items('{"type":"event","length":1.5}', '{}')],
  ])('refuses an envelope with %s', async (_label, request) => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    expect((await forwardSentryEnvelope(request)).status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('refuses an envelope larger than 1 MiB', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const request = new Request('http://localhost/monitoring', {
      method: 'POST',
      body: `${JSON.stringify({ dsn: DSN })}\n${'x'.repeat(1024 * 1024)}`,
    });
    expect((await forwardSentryEnvelope(request)).status).toBe(413);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('refuses a declared size above 1 MiB without reading the body', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const request = new Request('http://localhost/monitoring', {
      method: 'POST',
      headers: { 'Content-Length': String(1024 * 1024 + 1) },
      body: new ReadableStream({}),
      duplex: 'half',
    } as RequestInit);
    expect((await forwardSentryEnvelope(request)).status).toBe(413);
    expect(request.bodyUsed).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('stops reading a streamed body once it passes 1 MiB', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    let sent = 0;
    const chunk = new Uint8Array(256 * 1024);
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        sent += 1;
        controller.enqueue(chunk);
      },
    });
    const request = new Request('http://localhost/monitoring', {
      method: 'POST',
      body,
      duplex: 'half',
    } as RequestInit);
    expect((await forwardSentryEnvelope(request)).status).toBe(413);
    expect(sent).toBeLessThan(10);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('refuses a POST without a body', async () => {
    vi.stubGlobal('fetch', vi.fn());
    const request = new Request('http://localhost/monitoring', { method: 'POST' });
    expect((await forwardSentryEnvelope(request)).status).toBe(400);
  });

  it('forwards an envelope that arrives in several chunks', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const text = `${JSON.stringify({ dsn: DSN })}\n{"type":"event"}\n{}`;
    const bytes = new TextEncoder().encode(text);
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(bytes.subarray(0, 10));
        controller.enqueue(bytes.subarray(10));
        controller.close();
      },
    });
    const request = new Request('http://localhost/monitoring', {
      method: 'POST',
      body,
      duplex: 'half',
    } as RequestInit);
    expect((await forwardSentryEnvelope(request)).status).toBe(200);
    const sentBody = fetchMock.mock.calls[0]?.[1]?.body as Uint8Array;
    expect(new TextDecoder().decode(sentBody)).toBe(text);
  });

  it('answers 502 when the Sentry server cannot be reached', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('fetch failed')));
    expect((await forwardSentryEnvelope(envelope(JSON.stringify({ dsn: DSN })))).status).toBe(502);
  });
});
