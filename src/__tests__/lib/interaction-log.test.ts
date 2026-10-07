import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

vi.unmock('@/lib/interaction-log');

type SentEvent = { name: string; at: string; path: string; props: Record<string, unknown> };
type SentRequest = {
  method: string;
  headers: Record<string, string>;
  body: string;
  keepalive: boolean;
};

const MNEMONIC =
  'abandon ability able about above absent absorb abstract absurd abuse access accident';

type Module = typeof import('@/lib/interaction-log');
let mod: Module;
let useAuthStore: typeof import('@/stores/auth-store').useAuthStore;
let fetchMock: Mock;

/**
 * Every request sent so far.
 *
 * @returns The requests, in order.
 */
function requests(): SentRequest[] {
  return fetchMock.mock.calls.map(([url, init]) => {
    expect(url).toBe('/me/events');
    return init as SentRequest;
  });
}

/**
 * Every event sent so far.
 *
 * @returns The events, in order.
 */
function posted(): SentEvent[] {
  return requests().flatMap(
    (request) => (JSON.parse(request.body) as { events: SentEvent[] }).events,
  );
}

/**
 * Makes the next answers succeed, fail with a status, or fail on the network.
 *
 * @param outcome - `ok`, an error status, or a network error.
 */
function answer(outcome: 'ok' | number | Error): void {
  fetchMock.mockImplementation(() => {
    if (outcome instanceof Error) {
      return Promise.reject(outcome);
    }
    return Promise.resolve({ ok: outcome === 'ok', status: outcome === 'ok' ? 204 : outcome });
  });
}

beforeEach(async () => {
  vi.resetModules();
  fetchMock = vi.fn();
  answer('ok');
  vi.stubGlobal('fetch', fetchMock);
  mod = await import('@/lib/interaction-log');
  useAuthStore = (await import('@/stores/auth-store')).useAuthStore;
  useAuthStore.setState({ session: 'sess' });
  window.history.replaceState(null, '', '/wallet?visual=x#y');
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('logInteraction', () => {
  it('queues an event with time, path without query, and props', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-07T12:00:00.000Z'));
    mod.logInteraction('screen_view');
    mod.logInteraction('gift_sent', { amountSats: 21, messageId: 'm1', onchain: false, x: null });
    await mod.flushInteractions();
    expect(fetchMock).toHaveBeenCalledWith('/me/events', {
      method: 'POST',
      headers: { Authorization: 'Bearer sess', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        events: [
          { name: 'screen_view', at: '2026-10-07T12:00:00.000Z', path: '/wallet', props: {} },
          {
            name: 'gift_sent',
            at: '2026-10-07T12:00:00.000Z',
            path: '/wallet',
            props: { amountSats: 21, messageId: 'm1', onchain: false, x: null },
          },
        ],
      }),
      keepalive: true,
    });
  });

  it('keeps nothing without a session', async () => {
    useAuthStore.setState({ session: null });
    mod.logInteraction('screen_view');
    useAuthStore.setState({ session: 'sess' });
    await mod.flushInteractions();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('replaces the access key of a public profile path', async () => {
    window.history.replaceState(null, '', `/view/${'a'.repeat(64)}`);
    mod.logInteraction('screen_view');
    window.history.replaceState(null, '', '/view-key/abc/activity');
    mod.logInteraction('screen_view');
    await mod.flushInteractions();
    expect(posted().map((event) => event.path)).toEqual([
      '/view/[key]',
      '/view-key/[key]/activity',
    ]);
  });

  it('never keeps a secret, a long text, or an unusable prop', async () => {
    mod.logInteraction('search', {
      query: 'coffee',
      mnemonic: 'x',
      recoveryPhrase: 'x',
      seed: 'x',
      prfOutput: 'x',
      preimage: 'x',
      sessionToken: 'x',
      privateKey: 'x',
      'bad key': 'x',
      words: MNEMONIC,
      hash: 'f'.repeat(64),
      auth: 'Bearer abc',
      long: 'x'.repeat(201),
      big: Number.POSITIVE_INFINITY,
      count: 3,
    });
    await mod.flushInteractions();
    expect(posted()[0]?.props).toEqual({ query: 'coffee', count: 3 });
    expect(JSON.stringify(requests().map((request) => request.body))).not.toContain(MNEMONIC);
  });

  it('drops an event it cannot build instead of throwing', async () => {
    const location = window.location;
    Object.defineProperty(window, 'location', { configurable: true, value: {} });
    expect(() => {
      mod.logInteraction('gift_sent', { amountSats: 1 });
    }).not.toThrow();
    Object.defineProperty(window, 'location', { configurable: true, value: location });
    await mod.flushInteractions();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('writes no browser storage', async () => {
    const setItem = vi.spyOn(window.localStorage, 'setItem');
    const setSession = vi.spyOn(Storage.prototype, 'setItem');
    mod.logInteraction('search', { query: 'coffee' });
    await mod.flushInteractions();
    expect(setItem).not.toHaveBeenCalled();
    expect(setSession).not.toHaveBeenCalled();
    setItem.mockRestore();
    setSession.mockRestore();
  });

  it('keeps at most twelve props', async () => {
    const props = Object.fromEntries(Array.from({ length: 20 }, (_, i) => [`k${String(i)}`, i]));
    mod.logInteraction('search', props);
    await mod.flushInteractions();
    expect(Object.keys(posted()[0]?.props ?? {})).toHaveLength(12);
  });

  it('sends a full batch at once, in batches of 50', async () => {
    for (let i = 0; i < mod.INTERACTION_BATCH_SIZE; i += 1) {
      mod.logInteraction('screen_view');
    }
    await vi.waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
    expect(posted()).toHaveLength(50);
  });

  it('keeps the newest 500 events while the api cannot be reached', async () => {
    answer(new Error('offline'));
    for (let i = 0; i < 520; i += 1) {
      mod.logInteraction('search', { n: i });
    }
    await vi.waitFor(async () => {
      await mod.flushInteractions();
      expect(fetchMock.mock.calls.length).toBeGreaterThan(0);
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
    fetchMock.mockClear();
    answer('ok');
    await mod.flushInteractions();
    const sent = posted();
    expect(sent).toHaveLength(500);
    expect(sent[0]?.props).toEqual({ n: 20 });
    expect(sent.at(-1)?.props).toEqual({ n: 519 });
  });
});

describe('flushInteractions', () => {
  it('puts a failed batch back and sends it next time', async () => {
    mod.logInteraction('login');
    answer(503);
    await mod.flushInteractions();
    answer('ok');
    await mod.flushInteractions();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(posted().map((event) => event.name)).toEqual(['login', 'login']);
  });

  it('drops the queue when the member signed out', async () => {
    mod.logInteraction('login');
    useAuthStore.setState({ session: null });
    await mod.flushInteractions();
    useAuthStore.setState({ session: 'sess' });
    await mod.flushInteractions();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('runs one flush at a time', async () => {
    let release: () => void = () => undefined;
    fetchMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          release = () => {
            resolve({ ok: true, status: 204 });
          };
        }),
    );
    mod.logInteraction('login');
    const first = mod.flushInteractions();
    await mod.flushInteractions();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    release();
    await first;
  });
});

describe('session binding and batch size', () => {
  it('drops events of another member before queuing a new one', async () => {
    mod.logInteraction('login');
    useAuthStore.setState({ session: 'other' });
    mod.logInteraction('screen_view');
    await mod.flushInteractions();
    expect(requests().map((request) => request.headers['Authorization'])).toEqual(['Bearer other']);
    expect(posted().map((event) => event.name)).toEqual(['screen_view']);
  });

  it('never sends queued events with a session they were not recorded under', async () => {
    mod.logInteraction('login');
    useAuthStore.setState({ session: 'other' });
    await mod.flushInteractions();
    useAuthStore.setState({ session: 'sess' });
    await mod.flushInteractions();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('stops after the batch in flight when another member signs in, and drops it on failure', async () => {
    let fail: () => void = () => undefined;
    fetchMock.mockImplementationOnce(
      () =>
        new Promise((_resolve, reject) => {
          fail = () => {
            reject(new Error('offline'));
          };
        }),
    );
    for (let i = 0; i < 49; i += 1) {
      mod.logInteraction('screen_view');
    }
    const first = mod.flushInteractions();
    useAuthStore.setState({ session: 'other' });
    mod.logInteraction('login');
    fail();
    await first;
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await mod.flushInteractions();
    expect(requests().map((request) => request.headers['Authorization'])).toEqual([
      'Bearer sess',
      'Bearer other',
    ]);
    expect(
      posted()
        .slice(49)
        .map((event) => event.name),
    ).toEqual(['login']);
  });

  it('keeps each request body under the keepalive limit', async () => {
    const props = Object.fromEntries(
      Array.from({ length: 12 }, (_, i) => [`k${String(i)}`, 'x'.repeat(200)]),
    );
    for (let i = 0; i < 49; i += 1) {
      mod.logInteraction('search', props);
    }
    await mod.flushInteractions();
    expect(fetchMock.mock.calls.length).toBeGreaterThan(1);
    expect(posted()).toHaveLength(49);
    for (const request of requests()) {
      expect(request.body.length).toBeLessThanOrEqual(61_000);
    }
  });
});

describe('startInteractionLog', () => {
  it('flushes on the timer and when the page hides, each request kept alive', async () => {
    vi.useFakeTimers();
    const stop = mod.startInteractionLog();
    mod.logInteraction('screen_view');
    await vi.advanceTimersByTimeAsync(mod.INTERACTION_FLUSH_MS);
    expect(requests().map((request) => request.keepalive)).toEqual([true]);
    mod.logInteraction('screen_view');
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
    document.dispatchEvent(new Event('visibilitychange'));
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
    document.dispatchEvent(new Event('visibilitychange'));
    await vi.advanceTimersByTimeAsync(0);
    mod.logInteraction('screen_view');
    window.dispatchEvent(new Event('pagehide'));
    await vi.advanceTimersByTimeAsync(0);
    expect(requests().map((request) => request.keepalive)).toEqual([true, true, true]);
    stop();
    mod.logInteraction('screen_view');
    window.dispatchEvent(new Event('pagehide'));
    document.dispatchEvent(new Event('visibilitychange'));
    await vi.advanceTimersByTimeAsync(mod.INTERACTION_FLUSH_MS);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
  });
});
