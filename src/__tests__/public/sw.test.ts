import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { describe, expect, it, vi } from 'vitest';

const source = readFileSync('public/sw.js', 'utf8');

describe('service worker Sunday push', () => {
  it('drops a public push on the device Sunday and still shows a private message', () => {
    const guard = source.indexOf("payload.type !== 'conversation'");
    const show = source.indexOf('showNotification', guard);
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

type PushListener = (event: {
  data: { json: () => unknown };
  waitUntil: (pending: Promise<unknown>) => void;
}) => void;

interface PushNotification {
  tag: string;
  close: ReturnType<typeof vi.fn>;
}

interface PushNotificationOptions {
  tag?: string;
  [key: string]: unknown;
}

function bootPushWorker(day: 'Thu' | 'Sun'): {
  push: PushListener;
  showNotification: ReturnType<typeof vi.fn>;
  getNotifications: ReturnType<typeof vi.fn>;
  setAppBadge: ReturnType<typeof vi.fn>;
  forumClose: ReturnType<typeof vi.fn>;
  otherClose: ReturnType<typeof vi.fn>;
} {
  const listeners: Record<string, PushListener> = {};
  const forumClose = vi.fn();
  const otherClose = vi.fn();
  const notifications: PushNotification[] = [
    { tag: 'forum_post:m1', close: forumClose },
    { tag: 'forum_post:m2', close: otherClose },
  ];
  const showNotification = vi.fn(async (_title: string, options: PushNotificationOptions) => {
    notifications.push({ tag: options.tag ?? '', close: vi.fn() });
  });
  const getNotifications = vi.fn(async ({ tag }: { tag: string }) =>
    notifications.filter((notification) => notification.tag === tag),
  );
  const setAppBadge = vi.fn(async (_count: number) => undefined);
  const sandbox = {
    self: {
      location: { origin: 'https://21.gifts' },
      addEventListener(type: string, fn: PushListener) {
        listeners[type] = fn;
      },
      clients: { claim: async () => undefined },
      navigator: { setAppBadge },
      registration: { showNotification, getNotifications },
      skipWaiting() {},
    },
    caches: { open: async () => ({ put: async () => undefined }) },
    URL,
    Response,
    MessageChannel,
    Promise,
    setTimeout,
    clearTimeout,
    Date,
    Intl: {
      DateTimeFormat: function DateTimeFormat() {
        return { format: () => day };
      },
    },
  };
  vm.createContext(sandbox);
  vm.runInContext(readFileSync('public/sw.js', 'utf8'), sandbox);
  const push = listeners['push'];
  if (push === undefined) {
    throw new Error('push was not registered');
  }
  return { push, showNotification, getNotifications, setAppBadge, forumClose, otherClose };
}

async function pushPayload(push: PushListener, payload: unknown): Promise<void> {
  let pending: Promise<unknown> = Promise.resolve();
  push({
    data: { json: () => payload },
    waitUntil(next) {
      pending = next;
    },
  });
  await pending;
}

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

describe('service worker dismiss push behavior', () => {
  const payload = {
    type: 'dismiss',
    title: 'Ada replied',
    tags: ['forum_post:m1'],
    unreadCount: 0,
  };

  it('closes matching notifications and acknowledges a dismiss on Thursday', async () => {
    const worker = bootPushWorker('Thu');
    await pushPayload(worker.push, payload);

    expect(worker.getNotifications).toHaveBeenCalledWith({ tag: 'forum_post:m1' });
    expect(worker.forumClose).toHaveBeenCalledTimes(1);
    expect(worker.otherClose).not.toHaveBeenCalled();
    expect(worker.showNotification).toHaveBeenCalledWith(
      '21.gifts',
      expect.objectContaining({ tag: 'dismiss-ack' }),
    );
    expect(worker.showNotification.mock.calls.map(([title]) => title)).not.toContain('Ada replied');
    expect(worker.setAppBadge).toHaveBeenCalledWith(0);
    expect(worker.setAppBadge).not.toHaveBeenCalledWith(1);
    expect(worker.showNotification.mock.calls.map(([, options]) => options.tag)).not.toContain(
      'sunday-quiet',
    );
  });

  it('handles a dismiss before the Sunday quiet branch', async () => {
    const worker = bootPushWorker('Sun');
    await pushPayload(worker.push, payload);

    expect(worker.getNotifications).toHaveBeenCalledWith({ tag: 'forum_post:m1' });
    expect(worker.forumClose).toHaveBeenCalledTimes(1);
    expect(worker.showNotification.mock.calls.map(([, options]) => options.tag)).toContain(
      'dismiss-ack',
    );
    expect(worker.showNotification.mock.calls.map(([, options]) => options.tag)).not.toContain(
      'sunday-quiet',
    );
    expect(worker.showNotification.mock.calls.map(([title]) => title)).not.toContain('Ada replied');
  });
});

describe('service worker notification click behavior', () => {
  it('navigates a window that does not answer, when it can', async () => {
    const focusNavigated = vi.fn(async () => undefined);
    const navigate = vi.fn(async () => ({ focus: focusNavigated }));
    const openWindow = vi.fn(async () => null);
    const client = {
      url: 'https://21.gifts/welcome',
      focused: true,
      focus: () => Promise.resolve(),
      postMessage() {},
      navigate,
    };
    const { click } = bootWorker({
      matchAll: async () => [client],
      openWindow,
    });
    await clickNotification(click, '/messages/note-1');
    expect(navigate).toHaveBeenCalledWith('https://21.gifts/messages/note-1');
    expect(focusNavigated).toHaveBeenCalled();
    expect(openWindow).not.toHaveBeenCalled();
  });

  it('posts the note to the focused window and does not navigate it again', async () => {
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
    expect(navigate).not.toHaveBeenCalled();
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

  it('treats a backslash or a protocol-relative url as welcome', async () => {
    const posted: unknown[] = [];
    const client = {
      url: 'https://21.gifts/wallet',
      focused: true,
      focus: () => Promise.resolve(),
      postMessage(data: unknown, ports?: MessagePort[]) {
        posted.push(data);
        ports?.[0]?.postMessage('ack');
      },
      navigate: vi.fn(async () => undefined),
    };
    const { click } = bootWorker({
      matchAll: async () => [client],
      openWindow: async () => null,
    });
    await clickNotification(click, '/foo\\bar');
    await clickNotification(click, '//21.gifts/messages/x');
    expect(posted).toEqual([
      expect.objectContaining({ url: '/welcome' }),
      expect.objectContaining({ url: '/welcome' }),
    ]);
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
