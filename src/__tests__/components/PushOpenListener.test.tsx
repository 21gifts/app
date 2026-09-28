import { act, cleanup, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PushOpenListener } from '@/components/PushOpenListener';
import { renderWithLocale } from '@/__tests__/render-with-locale';

const navigation = vi.hoisted(() => ({
  push: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => navigation,
}));

function stubServiceWorker(): EventTarget {
  const worker = new EventTarget();
  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value: worker,
  });
  return worker;
}

function postMessage(worker: EventTarget, data: unknown): void {
  act(() => {
    worker.dispatchEvent(new MessageEvent('message', { data }));
  });
}

function record(body: unknown): Response {
  return new Response(JSON.stringify(body));
}

function installCaches(
  match: () => Promise<Response | undefined>,
  openReject = false,
): { delete: ReturnType<typeof vi.fn> } {
  const cache = {
    keys: vi.fn(async () => [new Request('https://21.gifts/push-open/one')]),
    match: vi.fn(match),
    delete: vi.fn(async () => true),
  };
  const open = openReject
    ? vi.fn(async () => {
        throw new Error('open');
      })
    : vi.fn(async () => cache);
  Object.defineProperty(globalThis, 'caches', {
    configurable: true,
    value: { open },
  });
  return cache;
}

afterEach(() => {
  cleanup();
  navigation.push.mockReset();
  Object.defineProperty(globalThis, 'caches', { configurable: true, value: undefined });
});

describe('PushOpenListener', () => {
  it('renders nothing without a service worker and does not throw', () => {
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: undefined,
    });
    expect(() => {
      const { container } = renderWithLocale(<PushOpenListener />);
      expect(container.firstChild).toBeNull();
    }).not.toThrow();
  });

  it('pushes a same-origin path from 21gifts-push-open', () => {
    const worker = stubServiceWorker();
    renderWithLocale(<PushOpenListener />);
    postMessage(worker, { type: '21gifts-push-open', url: '/messages/note-1' });
    expect(navigation.push).toHaveBeenCalledTimes(1);
    expect(navigation.push).toHaveBeenCalledWith('/messages/note-1');
  });

  it('pushes a same-origin query that contains a url', () => {
    const worker = stubServiceWorker();
    renderWithLocale(<PushOpenListener />);
    postMessage(worker, {
      type: '21gifts-push-open',
      url: '/messages/n1?return=https://21.gifts/welcome',
    });
    expect(navigation.push).toHaveBeenCalledWith('/messages/n1?return=https://21.gifts/welcome');
  });

  it('acks the worker after following the path', async () => {
    const worker = stubServiceWorker();
    const channel = new MessageChannel();
    const acked = new Promise<void>((resolve) => {
      channel.port1.onmessage = () => resolve();
    });
    renderWithLocale(<PushOpenListener />);
    act(() => {
      worker.dispatchEvent(
        new MessageEvent('message', {
          data: { type: '21gifts-push-open', url: '/messages/note-1', id: 'c1' },
          ports: [channel.port2],
        }),
      );
    });
    await acked;
    expect(navigation.push).toHaveBeenCalledWith('/messages/note-1');
  });

  it('still follows a message when nothing is stored', async () => {
    const worker = stubServiceWorker();
    installCaches(async () => undefined);
    renderWithLocale(<PushOpenListener />);
    postMessage(worker, { type: '21gifts-push-open', url: '/messages/note-1', id: 'gone' });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(navigation.push).toHaveBeenCalledWith('/messages/note-1');
  });

  it('drops only the click it followed', async () => {
    stubServiceWorker();
    const at = Date.now() - 1_000;
    const newer = { url: 'https://21.gifts/push-open/new' };
    const older = { url: 'https://21.gifts/push-open/old' };
    const deleted: string[] = [];
    const cache = {
      keys: vi.fn(async () => [newer, older]),
      match: vi.fn(async (request: { url?: string }) => {
        const label = String(request.url ?? '');
        if (label.includes('/new')) {
          return record({ url: '/messages/new', at: at + 10, id: 'new' });
        }
        return record({ url: '/messages/old', at, id: 'old' });
      }),
      delete: vi.fn(async (key: string) => {
        deleted.push(key);
        return true;
      }),
    };
    Object.defineProperty(globalThis, 'caches', {
      configurable: true,
      value: { open: async () => cache },
    });
    renderWithLocale(<PushOpenListener />);
    await waitFor(() => {
      expect(navigation.push).toHaveBeenCalledWith('/messages/new');
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(deleted.some((key) => key.endsWith('/new'))).toBe(true);
    expect(deleted.some((key) => key.endsWith('/old'))).toBe(false);
  });

  it('pushes a path with search or hash', () => {
    const worker = stubServiceWorker();
    renderWithLocale(<PushOpenListener />);
    postMessage(worker, { type: '21gifts-push-open', url: '/messages?c=c-1' });
    postMessage(worker, { type: '21gifts-push-open', url: '/messages/note-1#reply' });
    expect(navigation.push).toHaveBeenCalledWith('/messages?c=c-1');
    expect(navigation.push).toHaveBeenCalledWith('/messages/note-1#reply');
    expect(navigation.push).toHaveBeenCalledTimes(2);
  });

  it('ignores a path the URL parser rejects', () => {
    const worker = stubServiceWorker();
    const RealURL = globalThis.URL;
    globalThis.URL = class extends RealURL {
      constructor(url: string | URL, base?: string | URL) {
        if (typeof url === 'string' && url.startsWith('/explode')) {
          throw new TypeError('bad url');
        }
        super(url, base);
      }
    } as unknown as typeof URL;
    try {
      renderWithLocale(<PushOpenListener />);
      postMessage(worker, { type: '21gifts-push-open', url: '/explode' });
      expect(navigation.push).not.toHaveBeenCalled();
    } finally {
      globalThis.URL = RealURL;
    }
  });

  it('ignores a path the URL parser assigns to another origin', () => {
    const worker = stubServiceWorker();
    const RealURL = globalThis.URL;
    globalThis.URL = class extends RealURL {
      constructor(url: string | URL, base?: string | URL) {
        super(url, base);
        if (typeof url === 'string' && url.startsWith('/foreign')) {
          Object.defineProperty(this, 'origin', { value: 'https://evil.example' });
        }
      }
    } as unknown as typeof URL;
    try {
      renderWithLocale(<PushOpenListener />);
      postMessage(worker, { type: '21gifts-push-open', url: '/foreign' });
      expect(navigation.push).not.toHaveBeenCalled();
    } finally {
      globalThis.URL = RealURL;
    }
  });

  it('ignores messages that are not a same-origin in-app path', () => {
    const worker = stubServiceWorker();
    renderWithLocale(<PushOpenListener />);
    postMessage(worker, null);
    postMessage(worker, { type: 'other', url: '/messages/note-1' });
    postMessage(worker, { type: '21gifts-push-open', url: '//evil' });
    postMessage(worker, { type: '21gifts-push-open', url: 'https://example.com' });
    postMessage(worker, { type: '21gifts-push-open', url: '' });
    postMessage(worker, { type: '21gifts-push-open', url: '\\evil' });
    postMessage(worker, { type: '21gifts-push-open' });
    postMessage(worker, 'nope');
    postMessage(worker, {});

    postMessage(worker, { type: '21gifts-push-open', url: '/a\\b' });
    expect(navigation.push).not.toHaveBeenCalled();
  });

  it('opens a fresh stored path and ignores unsafe or stale records', async () => {
    const now = Date.now();
    const rejected: unknown[] = [
      null,
      'x',
      {},
      { url: '/messages/a' },
      { at: now },
      { url: 1, at: now },
      { url: '/messages/a', at: 'now' },
      { url: '/messages/a', at: now - 60_001 },
      { url: '/messages/a', at: now + 5_000 },
      { url: '//evil', at: now },
    ];
    stubServiceWorker();
    installCaches(async () => record({ url: '/messages/note-9', at: now }));
    renderWithLocale(<PushOpenListener />);
    await waitFor(() => {
      expect(navigation.push).toHaveBeenCalledWith('/messages/note-9');
    });

    for (const body of rejected) {
      cleanup();
      navigation.push.mockClear();
      stubServiceWorker();
      installCaches(async () => record(body));
      renderWithLocale(<PushOpenListener />);
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });
      expect(navigation.push).not.toHaveBeenCalled();
    }

    cleanup();
    navigation.push.mockClear();
    stubServiceWorker();
    installCaches(async () => {
      return { json: async () => ({ url: '/messages/a', at: Number.NaN }) } as Response;
    });
    renderWithLocale(<PushOpenListener />);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(navigation.push).not.toHaveBeenCalled();
  });

  it('does nothing when the cache is missing, empty, or unreadable', async () => {
    stubServiceWorker();
    Object.defineProperty(globalThis, 'caches', { configurable: true, value: undefined });
    renderWithLocale(<PushOpenListener />);
    await act(async () => {
      await Promise.resolve();
    });
    expect(navigation.push).not.toHaveBeenCalled();

    cleanup();
    stubServiceWorker();
    installCaches(async () => undefined);
    renderWithLocale(<PushOpenListener />);
    await act(async () => {
      await Promise.resolve();
    });
    expect(navigation.push).not.toHaveBeenCalled();

    cleanup();
    stubServiceWorker();
    installCaches(async () => new Response('nope'));
    renderWithLocale(<PushOpenListener />);
    await act(async () => {
      await Promise.resolve();
    });
    expect(navigation.push).not.toHaveBeenCalled();

    cleanup();
    stubServiceWorker();
    installCaches(async () => record({ url: '/messages/a', at: Date.now() }), true);
    renderWithLocale(<PushOpenListener />);
    await act(async () => {
      await Promise.resolve();
    });
    expect(navigation.push).not.toHaveBeenCalled();
  });

  it('opens a stored path again when the page becomes visible', async () => {
    stubServiceWorker();
    const at = Date.now();
    installCaches(async () => record({ url: '/messages/note-9', at }));
    let visibility: DocumentVisibilityState = 'visible';
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => visibility,
    });
    renderWithLocale(<PushOpenListener />);
    await waitFor(() => {
      expect(navigation.push).toHaveBeenCalledTimes(1);
    });
    navigation.push.mockClear();

    visibility = 'hidden';
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(navigation.push).not.toHaveBeenCalled();

    visibility = 'visible';
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await waitFor(() => {
      expect(navigation.push).toHaveBeenCalledWith('/messages/note-9');
    });
  });

  it('opens a stored path when a frozen page is restored', async () => {
    stubServiceWorker();
    const at = Date.now();
    installCaches(async () => record({ url: '/messages/note-9', at }));
    renderWithLocale(<PushOpenListener />);
    await waitFor(() => {
      expect(navigation.push).toHaveBeenCalledTimes(1);
    });
    navigation.push.mockClear();

    const ignored = new Event('pageshow');
    act(() => {
      window.dispatchEvent(ignored);
    });
    const fresh = new Event('pageshow');
    Object.defineProperty(fresh, 'persisted', { value: false });
    act(() => {
      window.dispatchEvent(fresh);
    });
    expect(navigation.push).not.toHaveBeenCalled();

    const restored = new Event('pageshow');
    Object.defineProperty(restored, 'persisted', { value: true });
    act(() => {
      window.dispatchEvent(restored);
    });
    await waitFor(() => {
      expect(navigation.push).toHaveBeenCalledWith('/messages/note-9');
    });
  });

  it('still opens when dropping the stored path fails', async () => {
    stubServiceWorker();
    const at = Date.now();
    const cache = installCaches(async () => record({ url: '/messages/note-9', at, id: 'drop' }));
    cache.delete.mockRejectedValue(new Error('delete'));
    renderWithLocale(<PushOpenListener />);
    await waitFor(() => {
      expect(navigation.push).toHaveBeenCalledWith('/messages/note-9');
    });
  });

  it('does not open a stored path that resolves after unmount', async () => {
    stubServiceWorker();
    let resolveMatch: ((value: Response) => void) | undefined;
    installCaches(
      () =>
        new Promise((resolve) => {
          resolveMatch = resolve;
        }),
    );
    const view = renderWithLocale(<PushOpenListener />);
    view.unmount();
    await act(async () => {
      resolveMatch?.(record({ url: '/messages/late', at: Date.now() }));
      await Promise.resolve();
    });
    expect(navigation.push).not.toHaveBeenCalled();
  });

  it('removes the listener on unmount', () => {
    const worker = stubServiceWorker();
    const { unmount } = renderWithLocale(<PushOpenListener />);
    unmount();
    postMessage(worker, { type: '21gifts-push-open', url: '/messages/note-1' });
    expect(navigation.push).not.toHaveBeenCalled();
  });
});
