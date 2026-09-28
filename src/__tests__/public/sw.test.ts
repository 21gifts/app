import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { describe, expect, it, vi } from 'vitest';

const source = readFileSync('public/sw.js', 'utf8');

describe('service worker Sunday push', () => {
  it('drops a public push on the device Sunday and still shows a private message', () => {
    const guard = source.indexOf("payload.type !== 'conversation'");
    const show = source.indexOf('showNotification');
    expect(source).toContain('function isDeviceSunday()');
    expect(source).toContain("weekday: 'short'");
    expect(source).toContain("tag: 'sunday-quiet'");
    expect(guard).toBeGreaterThan(-1);
    expect(show).toBeGreaterThan(guard);
  });
});

describe('service worker notification click', () => {
  it('posts 21gifts-push-open before navigate', () => {
    expect(source).toContain('21gifts-push-open');
    expect(source).toContain('postMessage');
    const click = source.indexOf("addEventListener('notificationclick'");
    expect(click).toBeGreaterThan(-1);
    expect(source).toContain(".open('21gifts-push-open')");
    expect(source).toContain('client.focused === true');
    expect(source).toContain('focused.then(deliver, deliver)');
    expect(source).toContain('encodeURIComponent(id)');
    const remembered = source.indexOf('rememberPushOpen(path)', click);
    const focus = source.indexOf('client.focus()', click);
    const post = source.indexOf('client.postMessage', click);
    const nav = source.indexOf('client.navigate', click);
    expect(remembered).toBeGreaterThan(click);
    expect(focus).toBeGreaterThan(remembered);
    expect(post).toBeGreaterThan(focus);
    expect(nav).toBeGreaterThan(post);
  });
});

type ClickListener = (event: {
  notification: { close: () => void; data?: { url?: string } };
  waitUntil: (pending: Promise<unknown>) => void;
}) => void;

function bootWorker(clients: unknown): { click: ClickListener; put: ReturnType<typeof vi.fn> } {
  const listeners: Record<string, ClickListener> = {};
  const put = vi.fn(async () => undefined);
  const sandbox = {
    self: {
      location: { origin: 'https://21.gifts' },
      addEventListener(type: string, fn: ClickListener) {
        listeners[type] = fn;
      },
      clients,
      skipWaiting() {},
      registration: {},
    },
    caches: { open: async () => ({ put, match: async () => undefined, delete: async () => true }) },
    URL,
    Response,
    MessageChannel,
    Promise,
    setTimeout,
    clearTimeout,
    Date,
    Intl,
  };
  vm.createContext(sandbox);
  vm.runInContext(readFileSync('public/sw.js', 'utf8'), sandbox);
  const click = listeners['notificationclick'];
  if (click === undefined) {
    throw new Error('notificationclick was not registered');
  }
  return { click, put };
}

async function clickNotification(click: ClickListener, url: string): Promise<void> {
  let pending: Promise<unknown> = Promise.resolve();
  click({
    notification: { close() {}, data: { url } },
    waitUntil(next) {
      pending = next;
    },
  });
  await pending;
}

describe('service worker notification click behavior', () => {
  it('posts the note to the focused window and navigates', async () => {
    const posted: unknown[] = [];
    const navigate = vi.fn(async () => ({ focus: async () => undefined }));
    const openWindow = vi.fn(async () => null);
    const client = {
      url: 'https://21.gifts/welcome',
      focused: true,
      focus: () => Promise.resolve(),
      postMessage(data: unknown, ports?: MessagePort[]) {
        posted.push(data);
        ports?.[0]?.postMessage('ack');
      },
      navigate,
    };
    const other = {
      url: 'https://21.gifts/wallet',
      focused: false,
      focus: () => Promise.resolve(),
      postMessage() {},
    };
    const { click, put } = bootWorker({
      matchAll: async () => [other, client],
      openWindow,
    });
    await clickNotification(click, '/messages/note-1');
    expect(posted).toEqual([
      expect.objectContaining({ type: '21gifts-push-open', url: '/messages/note-1' }),
    ]);
    expect(navigate).toHaveBeenCalledWith('https://21.gifts/messages/note-1');
    expect(openWindow).not.toHaveBeenCalled();
    expect(put).toHaveBeenCalled();
  });

  it('still posts when focus fails, and opens a window when the page does not answer', async () => {
    const openWindow = vi.fn(async () => null);
    const client = {
      url: 'https://21.gifts/welcome',
      focused: true,
      focus: () => Promise.reject(new Error('focus')),
      postMessage() {},
    };
    const { click } = bootWorker({
      matchAll: async () => [client],
      openWindow,
    });
    await clickNotification(click, 'https://evil.example/phish');
    expect(openWindow).toHaveBeenCalledWith('https://21.gifts/welcome');
  });

  it('opens a window when no page is open', async () => {
    const openWindow = vi.fn(async () => null);
    const { click } = bootWorker({
      matchAll: async () => [],
      openWindow,
    });
    await clickNotification(click, '/messages?c=c-1');
    expect(openWindow).toHaveBeenCalledWith('https://21.gifts/messages?c=c-1');
  });
});
