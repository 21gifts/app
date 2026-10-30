import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { deletePushSubscription, fetchVapidPublicKey, postPushSubscription } from '@/lib/api';
import {
  closeLocalPushNotifications,
  currentPushEndpoint,
  disablePush,
  enablePush,
  isIosSafari,
  isStandaloneDisplay,
  pushRenewalPending,
  pushTagForNotification,
  pushTurnedOff,
  registerPushWorker,
  resyncPushSubscription,
  vapidPublicKeyToBytes,
} from '@/lib/push';
import { bytesToBase64Url } from '@/lib/webauthn-browser';

vi.mock('@/lib/api', () => ({
  fetchVapidPublicKey: vi.fn(),
  postPushSubscription: vi.fn(),
  deletePushSubscription: vi.fn(),
}));

const CURRENT_KEY = new Uint8Array([9, 8, 7]);

beforeEach(() => {
  vi.mocked(fetchVapidPublicKey).mockResolvedValue(bytesToBase64Url(CURRENT_KEY));
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  vi.restoreAllMocks();
  window.localStorage.clear();
});

describe('vapidPublicKeyToBytes', () => {
  it('round-trips url-safe base64 to bytes', () => {
    const bytes = new Uint8Array([1, 2, 3, 250]);
    expect(vapidPublicKeyToBytes(bytesToBase64Url(bytes))).toEqual(bytes);
  });
});

describe('isStandaloneDisplay', () => {
  it('returns true when display-mode standalone matches', () => {
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: true }));
    expect(isStandaloneDisplay()).toBe(true);
  });

  it('returns true when navigator.standalone is set', () => {
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: false }));
    Object.defineProperty(navigator, 'standalone', {
      configurable: true,
      value: true,
    });
    expect(isStandaloneDisplay()).toBe(true);
    Object.defineProperty(navigator, 'standalone', {
      configurable: true,
      value: undefined,
    });
  });

  it('returns false when neither standalone signal is set', () => {
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: false }));
    Object.defineProperty(navigator, 'standalone', {
      configurable: true,
      value: false,
    });
    expect(isStandaloneDisplay()).toBe(false);
  });
});

describe('isIosSafari', () => {
  it('detects iPhone Safari', () => {
    vi.stubGlobal('navigator', {
      userAgent:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    });
    expect(isIosSafari()).toBe(true);
  });

  it('rejects Chrome on iOS', () => {
    vi.stubGlobal('navigator', {
      userAgent:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/120.0.0.0 Mobile/15E148 Safari/604.1',
    });
    expect(isIosSafari()).toBe(false);
  });

  it('rejects non-iPhone agents', () => {
    vi.stubGlobal('navigator', {
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
    });
    expect(isIosSafari()).toBe(false);
  });

  it('rejects iPhone agents that are not Safari', () => {
    vi.stubGlobal('navigator', {
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
    });
    expect(isIosSafari()).toBe(false);
  });
});

describe('registerPushWorker', () => {
  it('registers /sw.js and returns ready', async () => {
    const registration = { scope: '/' };
    const register = vi.fn().mockResolvedValue(registration);
    vi.stubGlobal('navigator', {
      serviceWorker: {
        register,
        ready: Promise.resolve(registration),
      },
    });
    await expect(registerPushWorker()).resolves.toBe(registration);
    expect(register).toHaveBeenCalledWith('/sw.js', { scope: '/' });
  });
});

describe('enablePush', () => {
  it('subscribes and posts the subscription JSON', async () => {
    const subscribe = vi.fn().mockResolvedValue({
      toJSON: () => ({
        endpoint: 'https://push.example/sub',
        keys: { p256dh: 'p256', auth: 'auth' },
      }),
    });
    const registration = { pushManager: { subscribe } };
    vi.stubGlobal('navigator', {
      serviceWorker: {
        register: vi.fn().mockResolvedValue(registration),
        ready: Promise.resolve(registration),
      },
    });
    vi.stubGlobal('Notification', {
      requestPermission: vi.fn().mockResolvedValue('granted'),
    });
    vi.mocked(fetchVapidPublicKey).mockResolvedValue(bytesToBase64Url(new Uint8Array([9, 8, 7])));
    vi.mocked(postPushSubscription).mockResolvedValue(undefined);
    window.localStorage.setItem('21gifts-push-off', '1');

    await enablePush('sess');

    expect(window.localStorage.getItem('21gifts-push-off')).toBeNull();
    expect(subscribe).toHaveBeenCalledWith({
      userVisibleOnly: true,
      applicationServerKey: expect.any(Uint8Array),
    });
    expect(postPushSubscription).toHaveBeenCalledWith('sess', {
      endpoint: 'https://push.example/sub',
      keys: { p256dh: 'p256', auth: 'auth' },
    });
  });

  it('throws when notification permission is denied', async () => {
    const registration = { pushManager: { subscribe: vi.fn() } };
    vi.stubGlobal('navigator', {
      serviceWorker: {
        register: vi.fn().mockResolvedValue(registration),
        ready: Promise.resolve(registration),
      },
    });
    vi.stubGlobal('Notification', {
      requestPermission: vi.fn().mockResolvedValue('denied'),
    });
    vi.mocked(fetchVapidPublicKey).mockResolvedValue(bytesToBase64Url(new Uint8Array([1])));

    await expect(enablePush('sess')).rejects.toThrow('Notification permission denied');
    expect(fetchVapidPublicKey).not.toHaveBeenCalled();
    expect(registration.pushManager.subscribe).not.toHaveBeenCalled();
  });

  it('throws when the browser omits subscription keys', async () => {
    const unsubscribe = vi.fn().mockResolvedValue(true);
    const subscribe = vi.fn().mockResolvedValue({
      toJSON: () => ({ endpoint: '', keys: {} }),
      unsubscribe,
    });
    const registration = { pushManager: { subscribe } };
    vi.stubGlobal('navigator', {
      serviceWorker: {
        register: vi.fn().mockResolvedValue(registration),
        ready: Promise.resolve(registration),
      },
    });
    vi.stubGlobal('Notification', {
      requestPermission: vi.fn().mockResolvedValue('granted'),
    });
    vi.mocked(fetchVapidPublicKey).mockResolvedValue(bytesToBase64Url(new Uint8Array([9, 8, 7])));

    await expect(enablePush('sess')).rejects.toThrow('Invalid subscription');
    expect(unsubscribe).toHaveBeenCalled();
  });

  it('unsubscribes when posting the subscription fails', async () => {
    const unsubscribe = vi.fn().mockResolvedValue(true);
    const subscribe = vi.fn().mockResolvedValue({
      toJSON: () => ({
        endpoint: 'https://push.example/sub',
        keys: { p256dh: 'p256', auth: 'auth' },
      }),
      unsubscribe,
    });
    const registration = { pushManager: { subscribe } };
    vi.stubGlobal('navigator', {
      serviceWorker: {
        register: vi.fn().mockResolvedValue(registration),
        ready: Promise.resolve(registration),
      },
    });
    vi.stubGlobal('Notification', {
      requestPermission: vi.fn().mockResolvedValue('granted'),
    });
    vi.mocked(fetchVapidPublicKey).mockResolvedValue(bytesToBase64Url(new Uint8Array([9, 8, 7])));
    vi.mocked(postPushSubscription).mockRejectedValue(
      new Error('Could not save push subscription'),
    );

    await expect(enablePush('sess')).rejects.toThrow('Could not save push subscription');
    expect(unsubscribe).toHaveBeenCalled();
  });

  it('rethrows when push is not configured', async () => {
    const registration = { pushManager: { subscribe: vi.fn() } };
    vi.stubGlobal('navigator', {
      serviceWorker: {
        register: vi.fn().mockResolvedValue(registration),
        ready: Promise.resolve(registration),
      },
    });
    vi.stubGlobal('Notification', {
      requestPermission: vi.fn().mockResolvedValue('granted'),
    });
    vi.mocked(fetchVapidPublicKey).mockRejectedValue(new Error('Push is not configured'));

    await expect(enablePush('sess')).rejects.toThrow('Push is not configured');
  });

  it('skips a queued enable when disable starts first', async () => {
    const requestPermission = vi.fn().mockResolvedValue('granted');
    const subscribe = vi.fn();
    const registration = {
      pushManager: { subscribe, getSubscription: vi.fn().mockResolvedValue(null) },
    };
    vi.stubGlobal('navigator', {
      serviceWorker: {
        register: vi.fn().mockResolvedValue(registration),
        ready: Promise.resolve(registration),
        getRegistration: vi.fn().mockResolvedValue(registration),
      },
    });
    vi.stubGlobal('Notification', { requestPermission });
    vi.mocked(deletePushSubscription).mockResolvedValue(undefined);
    const enableP = enablePush('sess');
    const disableP = disablePush('sess');
    await enableP;
    await disableP;
    expect(requestPermission).not.toHaveBeenCalled();
    expect(subscribe).not.toHaveBeenCalled();
  });

  it('skips subscribe when disable starts during requestPermission', async () => {
    let releasePerm!: (value: string) => void;
    const permHold = new Promise<string>((resolve) => {
      releasePerm = resolve;
    });
    let startedPerm!: () => void;
    const permStarted = new Promise<void>((resolve) => {
      startedPerm = resolve;
    });
    const subscribe = vi.fn();
    const registration = {
      pushManager: { subscribe, getSubscription: vi.fn().mockResolvedValue(null) },
    };
    vi.stubGlobal('navigator', {
      serviceWorker: {
        register: vi.fn().mockResolvedValue(registration),
        ready: Promise.resolve(registration),
        getRegistration: vi.fn().mockResolvedValue(registration),
      },
    });
    vi.stubGlobal('Notification', {
      requestPermission: vi.fn().mockImplementation(async () => {
        startedPerm();
        return permHold;
      }),
    });
    vi.mocked(deletePushSubscription).mockResolvedValue(undefined);
    const enableP = enablePush('sess');
    await permStarted;
    const disableP = disablePush('sess');
    releasePerm('granted');
    await enableP;
    await disableP;
    expect(subscribe).not.toHaveBeenCalled();
  });
});

describe('resyncPushSubscription', () => {
  it('resyncs an existing subscription when permission is already granted', async () => {
    const unsubscribe = vi.fn();
    const registration = {
      pushManager: {
        getSubscription: vi.fn().mockResolvedValue({
          toJSON: () => ({
            endpoint: 'https://push.example/sub',
            keys: { p256dh: 'p256', auth: 'auth' },
          }),
          unsubscribe,
        }),
        subscribe: vi.fn(),
      },
    };
    vi.stubGlobal('navigator', {
      serviceWorker: {
        getRegistration: vi.fn().mockResolvedValue(registration),
      },
    });
    vi.stubGlobal('Notification', { permission: 'granted' });
    vi.stubGlobal('PushManager', function PushManager() {});
    vi.mocked(postPushSubscription).mockResolvedValue(undefined);
    await resyncPushSubscription('sess');
    expect(registration.pushManager.subscribe).not.toHaveBeenCalled();
    expect(postPushSubscription).toHaveBeenCalledWith('sess', {
      endpoint: 'https://push.example/sub',
      keys: { p256dh: 'p256', auth: 'auth' },
    });
    expect(unsubscribe).not.toHaveBeenCalled();
  });

  it('resync is a no-op when permission is not granted', async () => {
    vi.stubGlobal('Notification', { permission: 'default' });
    await resyncPushSubscription('sess');
    expect(postPushSubscription).not.toHaveBeenCalled();
  });

  it('resync is a no-op when serviceWorker is missing', async () => {
    vi.stubGlobal('Notification', { permission: 'granted' });
    vi.stubGlobal('navigator', {});
    await resyncPushSubscription('sess');
    expect(postPushSubscription).not.toHaveBeenCalled();
  });

  it('resync is a no-op when Notification is undefined', async () => {
    vi.stubGlobal('Notification', undefined);
    await resyncPushSubscription('sess');
    expect(postPushSubscription).not.toHaveBeenCalled();
  });

  it('resync is a no-op when PushManager is missing', async () => {
    vi.stubGlobal('Notification', { permission: 'granted' });
    vi.stubGlobal('navigator', { serviceWorker: {} });
    const original = window.PushManager;
    // @ts-expect-error coverage: missing PushManager
    delete window.PushManager;
    await resyncPushSubscription('sess');
    expect(postPushSubscription).not.toHaveBeenCalled();
    window.PushManager = original;
  });

  it('resync is a no-op when there is no local subscription', async () => {
    const registration = {
      pushManager: { getSubscription: vi.fn().mockResolvedValue(null), subscribe: vi.fn() },
    };
    vi.stubGlobal('navigator', {
      serviceWorker: {
        getRegistration: vi.fn().mockResolvedValue(registration),
      },
    });
    vi.stubGlobal('Notification', { permission: 'granted' });
    vi.stubGlobal('PushManager', function PushManager() {});
    await resyncPushSubscription('sess');
    expect(postPushSubscription).not.toHaveBeenCalled();
    expect(registration.pushManager.subscribe).not.toHaveBeenCalled();
  });

  it('resync is a no-op when the local subscription omits keys', async () => {
    const registration = {
      pushManager: {
        getSubscription: vi.fn().mockResolvedValue({
          toJSON: () => ({ endpoint: 'https://push.example/sub', keys: {} }),
        }),
      },
    };
    vi.stubGlobal('navigator', {
      serviceWorker: {
        getRegistration: vi.fn().mockResolvedValue(registration),
      },
    });
    vi.stubGlobal('Notification', { permission: 'granted' });
    vi.stubGlobal('PushManager', function PushManager() {});
    await resyncPushSubscription('sess');
    expect(postPushSubscription).not.toHaveBeenCalled();
  });

  it('resync leaves the local subscription when POST fails', async () => {
    const unsubscribe = vi.fn();
    const registration = {
      pushManager: {
        getSubscription: vi.fn().mockResolvedValue({
          toJSON: () => ({
            endpoint: 'https://push.example/sub',
            keys: { p256dh: 'p256', auth: 'auth' },
          }),
          unsubscribe,
        }),
      },
    };
    vi.stubGlobal('navigator', {
      serviceWorker: {
        getRegistration: vi.fn().mockResolvedValue(registration),
      },
    });
    vi.stubGlobal('Notification', { permission: 'granted' });
    vi.stubGlobal('PushManager', function PushManager() {});
    vi.mocked(postPushSubscription).mockRejectedValue(new Error('Push is not configured'));
    await expect(resyncPushSubscription('sess')).rejects.toThrow('Push is not configured');
    expect(unsubscribe).not.toHaveBeenCalled();
  });
});

describe('resyncPushSubscription VAPID key change', () => {
  function stubRotation(options: {
    storedKey: ArrayBuffer | null;
    next?: { endpoint: string; keys: Record<string, string> };
    oldUnsubscribe?: ReturnType<typeof vi.fn>;
    nextUnsubscribe?: ReturnType<typeof vi.fn>;
  }): {
    register: ReturnType<typeof vi.fn>;
    subscribe: ReturnType<typeof vi.fn>;
    oldUnsubscribe: ReturnType<typeof vi.fn>;
    nextUnsubscribe: ReturnType<typeof vi.fn>;
  } {
    const oldUnsubscribe = options.oldUnsubscribe ?? vi.fn().mockResolvedValue(true);
    const nextUnsubscribe = options.nextUnsubscribe ?? vi.fn().mockResolvedValue(true);
    const next = options.next ?? {
      endpoint: 'https://push.example/new',
      keys: { p256dh: 'p256-new', auth: 'auth-new' },
    };
    const subscribe = vi.fn().mockResolvedValue({
      toJSON: () => next,
      unsubscribe: nextUnsubscribe,
    });
    const registration = {
      pushManager: {
        getSubscription: vi.fn().mockResolvedValue({
          endpoint: 'https://push.example/old',
          options: { applicationServerKey: options.storedKey },
          toJSON: () => ({
            endpoint: 'https://push.example/old',
            keys: { p256dh: 'p256', auth: 'auth' },
          }),
          unsubscribe: oldUnsubscribe,
        }),
        subscribe,
      },
    };
    const register = vi.fn();
    vi.stubGlobal('navigator', {
      serviceWorker: {
        register,
        getRegistration: vi.fn().mockResolvedValue(registration),
      },
    });
    vi.stubGlobal('Notification', { permission: 'granted' });
    vi.stubGlobal('PushManager', function PushManager() {});
    vi.mocked(postPushSubscription).mockResolvedValue(undefined);
    vi.mocked(deletePushSubscription).mockResolvedValue(undefined);
    return { register, subscribe, oldUnsubscribe, nextUnsubscribe };
  }

  it('re-posts the existing subscription when its key matches the current key', async () => {
    const { subscribe, oldUnsubscribe } = stubRotation({
      storedKey: new Uint8Array(CURRENT_KEY).buffer,
    });
    await resyncPushSubscription('sess');
    expect(subscribe).not.toHaveBeenCalled();
    expect(oldUnsubscribe).not.toHaveBeenCalled();
    expect(postPushSubscription).toHaveBeenCalledWith('sess', {
      endpoint: 'https://push.example/old',
      keys: { p256dh: 'p256', auth: 'auth' },
    });
    expect(deletePushSubscription).not.toHaveBeenCalled();
  });

  it('re-posts the existing subscription when the browser does not expose its key', async () => {
    const { subscribe } = stubRotation({ storedKey: null });
    await resyncPushSubscription('sess');
    expect(subscribe).not.toHaveBeenCalled();
    expect(postPushSubscription).toHaveBeenCalledTimes(1);
  });

  it('subscribes again with the current key, posts it, and deletes the old endpoint', async () => {
    const order: string[] = [];
    const { register, subscribe, oldUnsubscribe } = stubRotation({
      storedKey: new Uint8Array([1, 2, 3]).buffer,
    });
    oldUnsubscribe.mockImplementation(async () => {
      order.push('unsubscribe');
      return true;
    });
    subscribe.mockImplementation(async () => {
      order.push('subscribe');
      return {
        toJSON: () => ({
          endpoint: 'https://push.example/new',
          keys: { p256dh: 'p256-new', auth: 'auth-new' },
        }),
      };
    });
    vi.mocked(postPushSubscription).mockImplementation(async () => {
      order.push('post');
    });
    vi.mocked(deletePushSubscription).mockImplementation(async () => {
      order.push('delete');
    });
    await resyncPushSubscription('sess');
    expect(order).toEqual(['unsubscribe', 'subscribe', 'post', 'delete']);
    expect(subscribe).toHaveBeenCalledWith({
      userVisibleOnly: true,
      applicationServerKey: CURRENT_KEY,
    });
    expect(postPushSubscription).toHaveBeenCalledWith('sess', {
      endpoint: 'https://push.example/new',
      keys: { p256dh: 'p256-new', auth: 'auth-new' },
    });
    expect(deletePushSubscription).toHaveBeenCalledWith('sess', 'https://push.example/old');
    expect(register).not.toHaveBeenCalled();
  });

  it('treats a key of a different length as changed', async () => {
    const { subscribe } = stubRotation({ storedKey: new Uint8Array([9, 8]).buffer });
    await resyncPushSubscription('sess');
    expect(subscribe).toHaveBeenCalledTimes(1);
  });

  it('still subscribes again when unsubscribing the old subscription rejects', async () => {
    const { subscribe } = stubRotation({
      storedKey: new Uint8Array([1, 2, 3]).buffer,
      oldUnsubscribe: vi.fn().mockRejectedValue(new Error('gone')),
    });
    await resyncPushSubscription('sess');
    expect(subscribe).toHaveBeenCalledTimes(1);
    expect(postPushSubscription).toHaveBeenCalledTimes(1);
  });

  it('skips DELETE when the push service returns the same endpoint', async () => {
    stubRotation({
      storedKey: new Uint8Array([1, 2, 3]).buffer,
      next: { endpoint: 'https://push.example/old', keys: { p256dh: 'p2', auth: 'a2' } },
    });
    await resyncPushSubscription('sess');
    expect(postPushSubscription).toHaveBeenCalledWith('sess', {
      endpoint: 'https://push.example/old',
      keys: { p256dh: 'p2', auth: 'a2' },
    });
    expect(deletePushSubscription).not.toHaveBeenCalled();
  });

  it('ignores a failed DELETE of the old endpoint', async () => {
    stubRotation({ storedKey: new Uint8Array([1, 2, 3]).buffer });
    vi.mocked(deletePushSubscription).mockRejectedValue(new Error('offline'));
    await expect(resyncPushSubscription('sess')).resolves.toBeUndefined();
    expect(postPushSubscription).toHaveBeenCalledTimes(1);
  });

  it('keeps the new local subscription and skips DELETE when POST fails', async () => {
    const { nextUnsubscribe } = stubRotation({ storedKey: new Uint8Array([1, 2, 3]).buffer });
    vi.mocked(postPushSubscription).mockRejectedValue(new Error('Push is not configured'));
    await expect(resyncPushSubscription('sess')).rejects.toThrow('Push is not configured');
    expect(nextUnsubscribe).not.toHaveBeenCalled();
    expect(deletePushSubscription).not.toHaveBeenCalled();
  });

  it('drops a new subscription that omits keys', async () => {
    const { nextUnsubscribe } = stubRotation({
      storedKey: new Uint8Array([1, 2, 3]).buffer,
      next: { endpoint: 'https://push.example/new', keys: {} },
      nextUnsubscribe: vi.fn().mockRejectedValue(new Error('gone')),
    });
    await expect(resyncPushSubscription('sess')).rejects.toThrow('Invalid subscription');
    expect(nextUnsubscribe).toHaveBeenCalled();
    expect(postPushSubscription).not.toHaveBeenCalled();
    expect(deletePushSubscription).not.toHaveBeenCalled();
  });

  it('does not change the subscription when disable starts during the key fetch', async () => {
    let releaseKey!: (key: string) => void;
    const keyHold = new Promise<string>((resolve) => {
      releaseKey = resolve;
    });
    let startedKey!: () => void;
    const keyStarted = new Promise<void>((resolve) => {
      startedKey = resolve;
    });
    const { subscribe } = stubRotation({ storedKey: new Uint8Array([1, 2, 3]).buffer });
    vi.mocked(fetchVapidPublicKey).mockImplementation(async () => {
      startedKey();
      return keyHold;
    });
    const resyncP = resyncPushSubscription('sess');
    await keyStarted;
    const disableP = disablePush('sess');
    releaseKey(bytesToBase64Url(CURRENT_KEY));
    await resyncP;
    await disableP;
    expect(subscribe).not.toHaveBeenCalled();
    expect(postPushSubscription).not.toHaveBeenCalled();
    expect(deletePushSubscription).toHaveBeenCalledWith('sess', 'https://push.example/old');
  });

  it('finishes a renewal on the next start when subscribing again rejects', async () => {
    const { subscribe } = stubRotation({ storedKey: new Uint8Array([1, 2, 3]).buffer });
    subscribe.mockRejectedValueOnce(new Error('push service unreachable'));
    await expect(resyncPushSubscription('sess')).rejects.toThrow('push service unreachable');
    expect(window.localStorage.getItem('21gifts-push-renew')).toBe('1');
    expect(postPushSubscription).not.toHaveBeenCalled();

    const registration = {
      pushManager: {
        getSubscription: vi.fn().mockResolvedValue(null),
        subscribe: vi.fn().mockResolvedValue({
          toJSON: () => ({
            endpoint: 'https://push.example/new',
            keys: { p256dh: 'p256-new', auth: 'auth-new' },
          }),
        }),
      },
    };
    vi.stubGlobal('navigator', {
      serviceWorker: { getRegistration: vi.fn().mockResolvedValue(registration) },
    });
    await resyncPushSubscription('sess');
    expect(registration.pushManager.subscribe).toHaveBeenCalledWith({
      userVisibleOnly: true,
      applicationServerKey: CURRENT_KEY,
    });
    expect(postPushSubscription).toHaveBeenCalledWith('sess', {
      endpoint: 'https://push.example/new',
      keys: { p256dh: 'p256-new', auth: 'auth-new' },
    });
    expect(deletePushSubscription).not.toHaveBeenCalled();
    expect(window.localStorage.getItem('21gifts-push-renew')).toBeNull();
  });

  it('clears a pending renewal once the kept subscription is posted', async () => {
    window.localStorage.setItem('21gifts-push-renew', '1');
    stubRotation({ storedKey: new Uint8Array(CURRENT_KEY).buffer });
    await resyncPushSubscription('sess');
    expect(postPushSubscription).toHaveBeenCalledTimes(1);
    expect(window.localStorage.getItem('21gifts-push-renew')).toBeNull();
  });

  it('keeps and re-posts the old subscription when the renewal marker cannot be stored', async () => {
    vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    const { subscribe, oldUnsubscribe } = stubRotation({
      storedKey: new Uint8Array([1, 2, 3]).buffer,
    });
    await resyncPushSubscription('sess');
    expect(oldUnsubscribe).not.toHaveBeenCalled();
    expect(subscribe).not.toHaveBeenCalled();
    expect(postPushSubscription).toHaveBeenCalledWith('sess', {
      endpoint: 'https://push.example/old',
      keys: { p256dh: 'p256', auth: 'auth' },
    });
    expect(deletePushSubscription).not.toHaveBeenCalled();
  });

  it('still subscribes for a reported change when storage cannot be written', async () => {
    vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    vi.spyOn(window.localStorage, 'removeItem').mockImplementation(() => {
      throw new Error('quota');
    });
    const registration = {
      pushManager: {
        getSubscription: vi.fn().mockResolvedValue(null),
        subscribe: vi.fn().mockResolvedValue({
          toJSON: () => ({
            endpoint: 'https://push.example/new',
            keys: { p256dh: 'p256-new', auth: 'auth-new' },
          }),
        }),
      },
    };
    vi.stubGlobal('navigator', {
      serviceWorker: { getRegistration: vi.fn().mockResolvedValue(registration) },
    });
    vi.stubGlobal('Notification', { permission: 'granted' });
    vi.stubGlobal('PushManager', function PushManager() {});
    vi.mocked(postPushSubscription).mockResolvedValue(undefined);
    await resyncPushSubscription('sess', true);
    expect(registration.pushManager.subscribe).toHaveBeenCalledTimes(1);
    expect(postPushSubscription).toHaveBeenCalledTimes(1);
  });

  it('treats unreadable storage as no pending renewal', async () => {
    vi.spyOn(window.localStorage, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const registration = {
      pushManager: { getSubscription: vi.fn().mockResolvedValue(null), subscribe: vi.fn() },
    };
    vi.stubGlobal('navigator', {
      serviceWorker: { getRegistration: vi.fn().mockResolvedValue(registration) },
    });
    vi.stubGlobal('Notification', { permission: 'granted' });
    vi.stubGlobal('PushManager', function PushManager() {});
    await resyncPushSubscription('sess');
    expect(registration.pushManager.subscribe).not.toHaveBeenCalled();
    expect(postPushSubscription).not.toHaveBeenCalled();
  });

  it('subscribes with the current key when the worker reports a change it could not restore', async () => {
    const registration = {
      pushManager: {
        getSubscription: vi.fn().mockResolvedValue(null),
        subscribe: vi.fn().mockResolvedValue({
          toJSON: () => ({
            endpoint: 'https://push.example/new',
            keys: { p256dh: 'p256-new', auth: 'auth-new' },
          }),
        }),
      },
    };
    vi.stubGlobal('navigator', {
      serviceWorker: { getRegistration: vi.fn().mockResolvedValue(registration) },
    });
    vi.stubGlobal('Notification', { permission: 'granted' });
    vi.stubGlobal('PushManager', function PushManager() {});
    vi.mocked(postPushSubscription).mockResolvedValue(undefined);
    await resyncPushSubscription('sess', true);
    expect(registration.pushManager.subscribe).toHaveBeenCalledWith({
      userVisibleOnly: true,
      applicationServerKey: CURRENT_KEY,
    });
    expect(postPushSubscription).toHaveBeenCalledWith('sess', {
      endpoint: 'https://push.example/new',
      keys: { p256dh: 'p256-new', auth: 'auth-new' },
    });
    expect(deletePushSubscription).not.toHaveBeenCalled();
    expect(pushRenewalPending()).toBe(false);
  });

  it('keeps a reported change owed when the key fetch fails', async () => {
    const registration = {
      pushManager: { getSubscription: vi.fn().mockResolvedValue(null), subscribe: vi.fn() },
    };
    vi.stubGlobal('navigator', {
      serviceWorker: { getRegistration: vi.fn().mockResolvedValue(registration) },
    });
    vi.stubGlobal('Notification', { permission: 'granted' });
    vi.stubGlobal('PushManager', function PushManager() {});
    vi.mocked(fetchVapidPublicKey).mockRejectedValueOnce(new Error('offline'));
    await expect(resyncPushSubscription('sess', true)).rejects.toThrow('offline');
    expect(registration.pushManager.subscribe).not.toHaveBeenCalled();
    expect(pushRenewalPending()).toBe(true);
  });

  it('drops a pending renewal when notification permission is withdrawn', async () => {
    window.localStorage.setItem('21gifts-push-renew', '1');
    vi.stubGlobal('Notification', { permission: 'denied' });
    await resyncPushSubscription('sess');
    expect(window.localStorage.getItem('21gifts-push-renew')).toBeNull();
    vi.stubGlobal('Notification', { permission: 'granted' });
    expect(pushRenewalPending()).toBe(false);
    expect(postPushSubscription).not.toHaveBeenCalled();
  });

  it('does not subscribe for a worker message that arrives after Off', async () => {
    const registration = {
      pushManager: { getSubscription: vi.fn().mockResolvedValue(null), subscribe: vi.fn() },
    };
    vi.stubGlobal('navigator', {
      serviceWorker: { getRegistration: vi.fn().mockResolvedValue(registration) },
    });
    vi.stubGlobal('Notification', { permission: 'granted' });
    vi.stubGlobal('PushManager', function PushManager() {});
    await disablePush('sess');
    expect(window.localStorage.getItem('21gifts-push-off')).toBe('1');
    await resyncPushSubscription('sess', true);
    expect(fetchVapidPublicKey).not.toHaveBeenCalled();
    expect(registration.pushManager.subscribe).not.toHaveBeenCalled();
    expect(postPushSubscription).not.toHaveBeenCalled();
    expect(pushRenewalPending()).toBe(false);
  });

  it('drops a subscription the worker made after Off', async () => {
    window.localStorage.setItem('21gifts-push-off', '1');
    vi.mocked(deletePushSubscription).mockRejectedValue(new Error('offline'));
    const unsubscribe = vi.fn().mockRejectedValue(new Error('gone'));
    const registration = {
      pushManager: {
        getSubscription: vi.fn().mockResolvedValue({
          endpoint: 'https://push.example/worker',
          toJSON: () => ({
            endpoint: 'https://push.example/worker',
            keys: { p256dh: 'p256', auth: 'auth' },
          }),
          unsubscribe,
        }),
        subscribe: vi.fn(),
      },
    };
    vi.stubGlobal('navigator', {
      serviceWorker: { getRegistration: vi.fn().mockResolvedValue(registration) },
    });
    vi.stubGlobal('Notification', { permission: 'granted' });
    vi.stubGlobal('PushManager', function PushManager() {});
    await resyncPushSubscription('sess', true);
    expect(deletePushSubscription).toHaveBeenCalledWith('sess', 'https://push.example/worker');
    expect(unsubscribe).toHaveBeenCalled();
    expect(postPushSubscription).not.toHaveBeenCalled();
  });

  it('finishes an Off that a cut-off log out left behind instead of re-posting', async () => {
    window.localStorage.setItem('21gifts-push-off', '1');
    const { oldUnsubscribe, subscribe } = stubRotation({
      storedKey: new Uint8Array(CURRENT_KEY).buffer,
    });
    await resyncPushSubscription('sess');
    expect(postPushSubscription).not.toHaveBeenCalled();
    expect(deletePushSubscription).toHaveBeenCalledWith('sess', 'https://push.example/old');
    expect(oldUnsubscribe).toHaveBeenCalled();
    expect(fetchVapidPublicKey).not.toHaveBeenCalled();

    vi.mocked(deletePushSubscription).mockClear();
    await resyncPushSubscription('sess', true);
    expect(subscribe).not.toHaveBeenCalled();
    expect(postPushSubscription).not.toHaveBeenCalled();
  });

  it('treats unreadable storage as push not turned off for a worker message', async () => {
    vi.spyOn(window.localStorage, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const registration = {
      pushManager: {
        getSubscription: vi.fn().mockResolvedValue(null),
        subscribe: vi.fn().mockResolvedValue({
          toJSON: () => ({
            endpoint: 'https://push.example/new',
            keys: { p256dh: 'p256-new', auth: 'auth-new' },
          }),
        }),
      },
    };
    vi.stubGlobal('navigator', {
      serviceWorker: { getRegistration: vi.fn().mockResolvedValue(registration) },
    });
    vi.stubGlobal('Notification', { permission: 'granted' });
    vi.stubGlobal('PushManager', function PushManager() {});
    vi.mocked(postPushSubscription).mockResolvedValue(undefined);
    await resyncPushSubscription('sess', true);
    expect(registration.pushManager.subscribe).toHaveBeenCalledTimes(1);
  });

  it('finishes an Off from another tab that lands during the key fetch', async () => {
    const { subscribe, oldUnsubscribe } = stubRotation({
      storedKey: new Uint8Array(CURRENT_KEY).buffer,
    });
    vi.mocked(fetchVapidPublicKey).mockImplementation(async () => {
      window.localStorage.setItem('21gifts-push-off', '1');
      return bytesToBase64Url(CURRENT_KEY);
    });
    await resyncPushSubscription('sess');
    expect(postPushSubscription).not.toHaveBeenCalled();
    expect(subscribe).not.toHaveBeenCalled();
    expect(deletePushSubscription).toHaveBeenCalledWith('sess', 'https://push.example/old');
    expect(oldUnsubscribe).toHaveBeenCalled();
  });

  it('finishes an Off from another tab that lands while the kept subscription is posted', async () => {
    const { oldUnsubscribe } = stubRotation({ storedKey: new Uint8Array(CURRENT_KEY).buffer });
    vi.mocked(postPushSubscription).mockImplementation(async () => {
      window.localStorage.setItem('21gifts-push-off', '1');
    });
    await resyncPushSubscription('sess');
    expect(deletePushSubscription).toHaveBeenCalledWith('sess', 'https://push.example/old');
    expect(oldUnsubscribe).toHaveBeenCalled();
  });

  it('drops the new subscription when Off from another tab lands during subscribe', async () => {
    const { subscribe, nextUnsubscribe } = stubRotation({
      storedKey: new Uint8Array([1, 2, 3]).buffer,
    });
    subscribe.mockImplementation(async () => {
      window.localStorage.setItem('21gifts-push-off', '1');
      return {
        toJSON: () => ({
          endpoint: 'https://push.example/new',
          keys: { p256dh: 'p256-new', auth: 'auth-new' },
        }),
        endpoint: 'https://push.example/new',
        unsubscribe: nextUnsubscribe,
      };
    });
    await resyncPushSubscription('sess');
    expect(postPushSubscription).not.toHaveBeenCalled();
    expect(nextUnsubscribe).toHaveBeenCalled();
    expect(pushRenewalPending()).toBe(false);
  });

  it('removes the new subscription when Off from another tab lands while it is posted', async () => {
    const { subscribe, nextUnsubscribe } = stubRotation({
      storedKey: new Uint8Array([1, 2, 3]).buffer,
    });
    subscribe.mockResolvedValue({
      toJSON: () => ({
        endpoint: 'https://push.example/new',
        keys: { p256dh: 'p256-new', auth: 'auth-new' },
      }),
      endpoint: 'https://push.example/new',
      unsubscribe: nextUnsubscribe,
    });
    vi.mocked(postPushSubscription).mockImplementation(async () => {
      window.localStorage.setItem('21gifts-push-off', '1');
    });
    await resyncPushSubscription('sess');
    expect(deletePushSubscription).toHaveBeenCalledWith('sess', 'https://push.example/new');
    expect(nextUnsubscribe).toHaveBeenCalled();
    expect(deletePushSubscription).not.toHaveBeenCalledWith('sess', 'https://push.example/old');
    expect(pushRenewalPending()).toBe(false);
  });

  it('finishes an Off that lands while an old subscription is re-posted without storage', async () => {
    let off = false;
    vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    vi.spyOn(window.localStorage, 'getItem').mockImplementation((key: string) =>
      key === '21gifts-push-off' && off ? '1' : null,
    );
    const { oldUnsubscribe, subscribe } = stubRotation({
      storedKey: new Uint8Array([1, 2, 3]).buffer,
    });
    vi.mocked(postPushSubscription).mockImplementation(async () => {
      off = true;
    });
    await resyncPushSubscription('sess');
    expect(subscribe).not.toHaveBeenCalled();
    expect(deletePushSubscription).toHaveBeenCalledWith('sess', 'https://push.example/old');
    expect(oldUnsubscribe).toHaveBeenCalled();
  });

  it('is a no-op without registering a worker when none is registered', async () => {
    const register = vi.fn();
    vi.stubGlobal('navigator', {
      serviceWorker: { register, getRegistration: vi.fn().mockResolvedValue(undefined) },
    });
    vi.stubGlobal('Notification', { permission: 'granted' });
    vi.stubGlobal('PushManager', function PushManager() {});
    await resyncPushSubscription('sess');
    expect(register).not.toHaveBeenCalled();
    expect(fetchVapidPublicKey).not.toHaveBeenCalled();
    expect(postPushSubscription).not.toHaveBeenCalled();
  });
});

describe('disablePush', () => {
  it('deletes the endpoint then unsubscribes', async () => {
    const unsubscribe = vi.fn().mockResolvedValue(true);
    const subscription = { endpoint: 'https://push.example/sub', unsubscribe };
    const registration = {
      pushManager: { getSubscription: vi.fn().mockResolvedValue(subscription) },
    };
    vi.stubGlobal('navigator', {
      serviceWorker: {
        getRegistration: vi.fn().mockResolvedValue(registration),
      },
    });
    vi.mocked(deletePushSubscription).mockResolvedValue(undefined);

    await disablePush('sess');

    expect(deletePushSubscription).toHaveBeenCalledWith('sess', 'https://push.example/sub');
    expect(unsubscribe).toHaveBeenCalled();
  });

  it('does not register a worker on log out when none is registered', async () => {
    const register = vi.fn();
    const getRegistration = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { serviceWorker: { register, getRegistration } });

    await disablePush('sess');

    expect(getRegistration).toHaveBeenCalled();
    expect(register).not.toHaveBeenCalled();
    expect(deletePushSubscription).not.toHaveBeenCalled();
  });

  it('clears a pending key renewal', async () => {
    window.localStorage.setItem('21gifts-push-renew', '1');
    vi.stubGlobal('navigator', {
      serviceWorker: { getRegistration: vi.fn().mockResolvedValue(undefined) },
    });
    await disablePush('sess');
    expect(window.localStorage.getItem('21gifts-push-renew')).toBeNull();
  });

  it('clears a pending key renewal before an in-flight resync settles', async () => {
    let releaseKey!: (key: string) => void;
    const keyHold = new Promise<string>((resolve) => {
      releaseKey = resolve;
    });
    let startedKey!: () => void;
    const keyStarted = new Promise<void>((resolve) => {
      startedKey = resolve;
    });
    window.localStorage.setItem('21gifts-push-renew', '1');
    const registration = {
      pushManager: { getSubscription: vi.fn().mockResolvedValue(null), subscribe: vi.fn() },
    };
    vi.stubGlobal('navigator', {
      serviceWorker: { getRegistration: vi.fn().mockResolvedValue(registration) },
    });
    vi.stubGlobal('Notification', { permission: 'granted' });
    vi.stubGlobal('PushManager', function PushManager() {});
    vi.mocked(fetchVapidPublicKey).mockImplementation(async () => {
      startedKey();
      return keyHold;
    });
    const resyncP = resyncPushSubscription('sess');
    await keyStarted;
    const disableP = disablePush('sess');
    expect(pushRenewalPending()).toBe(false);
    releaseKey(bytesToBase64Url(CURRENT_KEY));
    await resyncP;
    await disableP;
    expect(registration.pushManager.subscribe).not.toHaveBeenCalled();
    expect(pushRenewalPending()).toBe(false);
  });

  it('no-ops when this browser has no service worker', async () => {
    vi.stubGlobal('navigator', {});
    await expect(disablePush('sess')).resolves.toBeUndefined();
    expect(deletePushSubscription).not.toHaveBeenCalled();
  });

  it('no-ops when there is no subscription', async () => {
    const registration = {
      pushManager: { getSubscription: vi.fn().mockResolvedValue(null) },
    };
    vi.stubGlobal('navigator', {
      serviceWorker: {
        getRegistration: vi.fn().mockResolvedValue(registration),
      },
    });

    await disablePush('sess');
    expect(deletePushSubscription).not.toHaveBeenCalled();
  });

  it('still unsubscribes locally when DELETE rejects', async () => {
    const unsubscribe = vi.fn().mockResolvedValue(true);
    const subscription = { endpoint: 'https://push.example/sub', unsubscribe };
    const registration = {
      pushManager: { getSubscription: vi.fn().mockResolvedValue(subscription) },
    };
    vi.stubGlobal('navigator', {
      serviceWorker: {
        getRegistration: vi.fn().mockResolvedValue(registration),
      },
    });
    vi.mocked(deletePushSubscription).mockRejectedValue(new Error('offline'));

    await expect(disablePush('sess')).rejects.toThrow('offline');
    expect(unsubscribe).toHaveBeenCalled();
  });

  it('waits for an in-flight resync POST before DELETE', async () => {
    let releasePost!: () => void;
    const postHold = new Promise<void>((resolve) => {
      releasePost = resolve;
    });
    let startedPost!: () => void;
    const postStarted = new Promise<void>((resolve) => {
      startedPost = resolve;
    });
    const order: string[] = [];
    const unsubscribe = vi.fn().mockResolvedValue(true);
    const registration = {
      pushManager: {
        getSubscription: vi.fn().mockResolvedValue({
          endpoint: 'https://push.example/sub',
          toJSON: () => ({
            endpoint: 'https://push.example/sub',
            keys: { p256dh: 'p256', auth: 'auth' },
          }),
          unsubscribe,
        }),
      },
    };
    vi.stubGlobal('navigator', {
      serviceWorker: {
        getRegistration: vi.fn().mockResolvedValue(registration),
      },
    });
    vi.stubGlobal('Notification', { permission: 'granted' });
    vi.stubGlobal('PushManager', function PushManager() {});
    vi.mocked(postPushSubscription).mockImplementation(async () => {
      order.push('post');
      startedPost();
      await postHold;
    });
    vi.mocked(deletePushSubscription).mockImplementation(async () => {
      order.push('delete');
    });
    const resyncP = resyncPushSubscription('sess');
    await postStarted;
    const disableP = disablePush('sess');
    releasePost();
    await resyncP;
    await disableP;
    expect(order).toEqual(['post', 'delete']);
  });

  it('skips a queued resync when disable starts first', async () => {
    const unsubscribe = vi.fn().mockResolvedValue(true);
    const registration = {
      pushManager: {
        getSubscription: vi.fn().mockResolvedValue({
          endpoint: 'https://push.example/sub',
          toJSON: () => ({
            endpoint: 'https://push.example/sub',
            keys: { p256dh: 'p256', auth: 'auth' },
          }),
          unsubscribe,
        }),
      },
    };
    vi.stubGlobal('navigator', {
      serviceWorker: {
        getRegistration: vi.fn().mockResolvedValue(registration),
      },
    });
    vi.stubGlobal('Notification', { permission: 'granted' });
    vi.stubGlobal('PushManager', function PushManager() {});
    vi.mocked(postPushSubscription).mockResolvedValue(undefined);
    vi.mocked(deletePushSubscription).mockResolvedValue(undefined);
    const resyncP = resyncPushSubscription('sess');
    const disableP = disablePush('sess');
    await resyncP;
    await disableP;
    expect(postPushSubscription).not.toHaveBeenCalled();
    expect(deletePushSubscription).toHaveBeenCalled();
  });

  it('skips POST when disable starts during getSubscription', async () => {
    let releaseGet!: () => void;
    const getHold = new Promise<void>((resolve) => {
      releaseGet = resolve;
    });
    let startedGet!: () => void;
    const getStarted = new Promise<void>((resolve) => {
      startedGet = resolve;
    });
    const unsubscribe = vi.fn().mockResolvedValue(true);
    const registration = {
      pushManager: {
        getSubscription: vi.fn().mockImplementation(async () => {
          startedGet();
          await getHold;
          return {
            endpoint: 'https://push.example/sub',
            toJSON: () => ({
              endpoint: 'https://push.example/sub',
              keys: { p256dh: 'p256', auth: 'auth' },
            }),
            unsubscribe,
          };
        }),
      },
    };
    vi.stubGlobal('navigator', {
      serviceWorker: {
        getRegistration: vi.fn().mockResolvedValue(registration),
      },
    });
    vi.stubGlobal('Notification', { permission: 'granted' });
    vi.stubGlobal('PushManager', function PushManager() {});
    vi.mocked(postPushSubscription).mockResolvedValue(undefined);
    vi.mocked(deletePushSubscription).mockResolvedValue(undefined);
    const resyncP = resyncPushSubscription('sess');
    await getStarted;
    const disableP = disablePush('sess');
    releaseGet();
    await resyncP;
    await disableP;
    expect(postPushSubscription).not.toHaveBeenCalled();
  });
});

function installNavigator(value: unknown): () => void {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value });
  return () => {
    if (descriptor === undefined) {
      delete (globalThis as { navigator?: unknown }).navigator;
      return;
    }
    Object.defineProperty(globalThis, 'navigator', descriptor);
  };
}

describe('pushTurnedOff', () => {
  it('reads the Off flag that disablePush stores and enablePush removes', () => {
    expect(pushTurnedOff()).toBe(false);
    window.localStorage.setItem('21gifts-push-off', '1');
    expect(pushTurnedOff()).toBe(true);
  });
});

describe('pushRenewalPending', () => {
  it('reads the renewal marker while permission is granted', () => {
    vi.stubGlobal('Notification', { permission: 'granted' });
    expect(pushRenewalPending()).toBe(false);
    window.localStorage.setItem('21gifts-push-renew', '1');
    expect(pushRenewalPending()).toBe(true);
  });

  it('ignores a stored marker once notifications are blocked', () => {
    window.localStorage.setItem('21gifts-push-renew', '1');
    vi.stubGlobal('Notification', { permission: 'denied' });
    expect(pushRenewalPending()).toBe(false);
    vi.stubGlobal('Notification', undefined);
    expect(pushRenewalPending()).toBe(false);
  });
});

describe('pushTagForNotification', () => {
  it('returns null for a proposal', () => {
    expect(
      pushTagForNotification({ type: 'moderator_proposal', parentId: 'p', replyId: 'r' }),
    ).toBeNull();
  });

  it('tags a heart by replyId', () => {
    expect(pushTagForNotification({ type: 'heart', parentId: 'p', replyId: 'r1' })).toBe(
      'heart:r1',
    );
  });
});

describe('currentPushEndpoint', () => {
  it('returns undefined when navigator is missing', async () => {
    const restoreNavigator = installNavigator(undefined);
    try {
      await expect(currentPushEndpoint()).resolves.toBeUndefined();
    } finally {
      restoreNavigator();
    }
  });

  it('returns undefined when this browser has no service worker', async () => {
    const restoreNavigator = installNavigator({});
    try {
      await expect(currentPushEndpoint()).resolves.toBeUndefined();
    } finally {
      restoreNavigator();
    }
  });

  it('returns undefined when the lookup throws', async () => {
    const restoreNavigator = installNavigator({
      serviceWorker: { getRegistration: vi.fn().mockRejectedValue(new Error('no worker')) },
    });
    try {
      await expect(currentPushEndpoint()).resolves.toBeUndefined();
    } finally {
      restoreNavigator();
    }
  });

  it('returns undefined for an empty endpoint', async () => {
    const restoreNavigator = installNavigator({
      serviceWorker: {
        getRegistration: vi.fn().mockResolvedValue({
          pushManager: { getSubscription: vi.fn().mockResolvedValue({ endpoint: '' }) },
        }),
      },
    });
    try {
      await expect(currentPushEndpoint()).resolves.toBeUndefined();
    } finally {
      restoreNavigator();
    }
  });

  it('returns undefined when the subscription has no endpoint', async () => {
    const restoreNavigator = installNavigator({
      serviceWorker: {
        getRegistration: vi.fn().mockResolvedValue({
          pushManager: { getSubscription: vi.fn().mockResolvedValue(null) },
        }),
      },
    });
    try {
      await expect(currentPushEndpoint()).resolves.toBeUndefined();
    } finally {
      restoreNavigator();
    }
  });

  it('returns the subscription endpoint', async () => {
    const restoreNavigator = installNavigator({
      serviceWorker: {
        getRegistration: vi.fn().mockResolvedValue({
          pushManager: {
            getSubscription: vi.fn().mockResolvedValue({ endpoint: 'https://push.example/sub' }),
          },
        }),
      },
    });
    try {
      await expect(currentPushEndpoint()).resolves.toBe('https://push.example/sub');
    } finally {
      restoreNavigator();
    }
  });

  it('returns undefined when getRegistration is undefined and ready never settles', async () => {
    const restoreNavigator = installNavigator({
      serviceWorker: {
        ready: new Promise(() => undefined),
        getRegistration: vi.fn().mockResolvedValue(undefined),
      },
    });
    try {
      await expect(currentPushEndpoint()).resolves.toBeUndefined();
    } finally {
      restoreNavigator();
    }
  });
});

describe('closeLocalPushNotifications', () => {
  it('does nothing for an empty tag list', async () => {
    await expect(closeLocalPushNotifications([])).resolves.toBeUndefined();
  });

  it('does nothing when navigator is missing', async () => {
    const restoreNavigator = installNavigator(undefined);
    try {
      await expect(closeLocalPushNotifications(['forum_post:m1'])).resolves.toBeUndefined();
    } finally {
      restoreNavigator();
    }
  });

  it('does nothing when this browser has no service worker', async () => {
    const restoreNavigator = installNavigator({});
    try {
      await expect(closeLocalPushNotifications(['forum_post:m1'])).resolves.toBeUndefined();
    } finally {
      restoreNavigator();
    }
  });

  it('does nothing when notifications cannot be listed', async () => {
    const restoreNavigator = installNavigator({
      serviceWorker: { getRegistration: vi.fn().mockResolvedValue({}) },
    });
    try {
      await expect(closeLocalPushNotifications(['forum_post:m1'])).resolves.toBeUndefined();
    } finally {
      restoreNavigator();
    }
  });

  it('does nothing when listing notifications throws', async () => {
    const restoreNavigator = installNavigator({
      serviceWorker: {
        getRegistration: vi.fn().mockResolvedValue({
          getNotifications: vi.fn().mockRejectedValue(new Error('no')),
        }),
      },
    });
    try {
      await expect(closeLocalPushNotifications(['forum_post:m1'])).resolves.toBeUndefined();
    } finally {
      restoreNavigator();
    }
  });

  it('closes only the named tag', async () => {
    const closeHit = vi.fn();
    const closeMiss = vi.fn();
    const restoreNavigator = installNavigator({
      serviceWorker: {
        getRegistration: vi.fn().mockResolvedValue({
          getNotifications: vi.fn().mockResolvedValue([
            { tag: 'forum_post:m1', close: closeHit },
            { tag: 'forum_post:other', close: closeMiss },
          ]),
        }),
      },
    });
    try {
      await closeLocalPushNotifications(['forum_post:m1']);
      expect(closeHit).toHaveBeenCalledTimes(1);
      expect(closeMiss).not.toHaveBeenCalled();
    } finally {
      restoreNavigator();
    }
  });

  it('ignores a shown note whose tag is not a string', async () => {
    const close = vi.fn();
    const restoreNavigator = installNavigator({
      serviceWorker: {
        getRegistration: vi.fn().mockResolvedValue({
          getNotifications: vi.fn().mockResolvedValue([{ tag: 1, close }]),
        }),
      },
    });
    try {
      await closeLocalPushNotifications(['forum_post:m1']);
      expect(close).not.toHaveBeenCalled();
    } finally {
      restoreNavigator();
    }
  });

  it('does nothing when getRegistration is undefined and ready never settles', async () => {
    const getNotifications = vi.fn();
    const restoreNavigator = installNavigator({
      serviceWorker: {
        ready: new Promise(() => undefined),
        getRegistration: vi.fn().mockResolvedValue(undefined),
      },
    });
    try {
      await expect(closeLocalPushNotifications(['forum_post:m1'])).resolves.toBeUndefined();
      expect(getNotifications).not.toHaveBeenCalled();
    } finally {
      restoreNavigator();
    }
  });
});
