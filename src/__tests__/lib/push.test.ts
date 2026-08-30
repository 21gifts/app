import { afterEach, describe, expect, it, vi } from 'vitest';
import { deletePushSubscription, fetchVapidPublicKey, postPushSubscription } from '@/lib/api';
import {
  disablePush,
  enablePush,
  isIosSafari,
  isStandaloneDisplay,
  registerPushWorker,
  vapidPublicKeyToBytes,
} from '@/lib/push';
import { bytesToBase64Url } from '@/lib/webauthn-browser';

vi.mock('@/lib/api', () => ({
  fetchVapidPublicKey: vi.fn(),
  postPushSubscription: vi.fn(),
  deletePushSubscription: vi.fn(),
}));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
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

    await enablePush('sess');

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
    expect(registration.pushManager.subscribe).not.toHaveBeenCalled();
  });

  it('throws when the browser omits subscription keys', async () => {
    const subscribe = vi.fn().mockResolvedValue({
      toJSON: () => ({ endpoint: '', keys: {} }),
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
  });

  it('rethrows when push is not configured', async () => {
    const registration = { pushManager: { subscribe: vi.fn() } };
    vi.stubGlobal('navigator', {
      serviceWorker: {
        register: vi.fn().mockResolvedValue(registration),
        ready: Promise.resolve(registration),
      },
    });
    vi.mocked(fetchVapidPublicKey).mockRejectedValue(new Error('Push is not configured'));

    await expect(enablePush('sess')).rejects.toThrow('Push is not configured');
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
        register: vi.fn().mockResolvedValue(registration),
        ready: Promise.resolve(registration),
      },
    });
    vi.mocked(deletePushSubscription).mockResolvedValue(undefined);

    await disablePush('sess');

    expect(deletePushSubscription).toHaveBeenCalledWith('sess', 'https://push.example/sub');
    expect(unsubscribe).toHaveBeenCalled();
  });

  it('no-ops when there is no subscription', async () => {
    const registration = {
      pushManager: { getSubscription: vi.fn().mockResolvedValue(null) },
    };
    vi.stubGlobal('navigator', {
      serviceWorker: {
        register: vi.fn().mockResolvedValue(registration),
        ready: Promise.resolve(registration),
      },
    });

    await disablePush('sess');
    expect(deletePushSubscription).not.toHaveBeenCalled();
  });
});
