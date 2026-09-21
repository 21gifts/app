import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { obtainPrfFirst } from '@/lib/prf-mnemonic';
import { rememberSessionPhrase } from '@/lib/tab-phrase';
import { usePasskeyLogin } from '@/hooks/usePasskeyLogin';
import {
  finishPasskeyAuthentication,
  finishPasskeyRegistration,
  startPasskeyAuthentication,
  startPasskeyRegistration,
  WRONG_ACCOUNT_ERROR,
  WrongAccountError,
} from '@/lib/api';
import { isInAppBrowser } from '@/lib/in-app-browser';
import { useAuthStore } from '@/stores/auth-store';

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return {
    ...actual,
    startPasskeyRegistration: vi.fn(),
    finishPasskeyRegistration: vi.fn(),
    startPasskeyAuthentication: vi.fn(),
    finishPasskeyAuthentication: vi.fn(),
  };
});

vi.mock('@/lib/in-app-browser', () => ({
  isInAppBrowser: vi.fn(() => false),
}));

vi.mock('@/lib/webauthn-browser', () => ({
  creationOptionsFromJSON: vi.fn().mockReturnValue({ challenge: new ArrayBuffer(1) }),
  requestOptionsFromJSON: vi.fn().mockReturnValue({ challenge: new ArrayBuffer(1) }),
  credentialToJSON: vi.fn().mockReturnValue({ id: 'cred' }),
}));

vi.mock('@/lib/prf-mnemonic', () => ({
  obtainPrfFirst: vi.fn().mockResolvedValue(new Uint8Array(32).fill(7)),
  mnemonicFromPrfFirst: vi
    .fn()
    .mockResolvedValue(
      'abandon ability able about above absent absorb abstract absurd abuse access accident',
    ),
}));

vi.mock('@/lib/tab-phrase', () => ({
  rememberSessionPhrase: vi.fn(),
  clearSessionPhrase: vi.fn(),
  peekSessionPhrase: vi.fn(() => null),
}));

const account = {
  id: 'acc_1',
  linkingKey: null,
  role: 'basis' as const,
  name: null,
  location: null,
  lightningAddress: null,
  lightningAddressVerified: false,
  forumLawsDismissed: false,
  createdAt: 1_700_000_000,
  rulesAgreedAt: null as number | null,
  viewKey: 'a'.repeat(64),
  aboutMe: null,
  aboutMeHasPhoto: false,
  setup: 'name' as const,
  missing: ['name', 'lightning-address', 'rules'] as ('name' | 'lightning-address' | 'rules')[],
};

const begin = { challengeId: 'ch', options: { challenge: 'aa' } };

beforeEach(() => {
  useAuthStore.setState({ session: null, account: null, wrongAccount: false });
  vi.mocked(isInAppBrowser).mockReturnValue(false);
  vi.mocked(startPasskeyRegistration).mockReset().mockResolvedValue(begin);
  vi.mocked(finishPasskeyRegistration).mockReset().mockResolvedValue({ token: 'tok', account });
  vi.mocked(startPasskeyAuthentication).mockReset().mockResolvedValue(begin);
  vi.mocked(finishPasskeyAuthentication).mockReset().mockResolvedValue({ token: 'tok', account });
  vi.mocked(rememberSessionPhrase).mockClear();
});

afterEach(cleanup);

describe('usePasskeyLogin', () => {
  it('does not finish registration when PRF is missing', async () => {
    vi.mocked(obtainPrfFirst).mockResolvedValueOnce(null);
    const cred = { id: 'cred', type: 'public-key' };
    vi.stubGlobal('navigator', {
      ...navigator,
      credentials: { create: vi.fn().mockResolvedValue(cred), get: vi.fn() },
    });
    const { result } = renderHook(() => usePasskeyLogin());
    await act(async () => {
      result.current.register();
    });
    expect(finishPasskeyRegistration).not.toHaveBeenCalled();
    expect(result.current.status).toBe('error');
    vi.unstubAllGlobals();
  });

  it('registers a passkey and stores the session', async () => {
    const cred = { id: 'cred', type: 'public-key' };
    vi.stubGlobal('navigator', {
      ...navigator,
      credentials: { create: vi.fn().mockResolvedValue(cred), get: vi.fn() },
    });
    const { result } = renderHook(() => usePasskeyLogin());
    await act(async () => {
      result.current.register();
    });
    expect(result.current.status).toBe('idle');
    expect(useAuthStore.getState().session).toBe('tok');
    expect(rememberSessionPhrase).toHaveBeenCalledWith(
      'abandon ability able about above absent absorb abstract absurd abuse access accident',
    );
    expect(vi.mocked(startPasskeyRegistration).mock.calls[0]?.[0]).toBeUndefined();
    vi.unstubAllGlobals();
  });

  it('register(viewKey) forwards the viewKey to startPasskeyRegistration', async () => {
    const viewKey = 'b'.repeat(64);
    const cred = { id: 'cred', type: 'public-key' };
    vi.stubGlobal('navigator', {
      ...navigator,
      credentials: { create: vi.fn().mockResolvedValue(cred), get: vi.fn() },
    });
    const { result } = renderHook(() => usePasskeyLogin());
    await act(async () => {
      result.current.register(viewKey);
    });
    expect(startPasskeyRegistration).toHaveBeenCalledWith(viewKey);
    expect(useAuthStore.getState().session).toBe('tok');
    vi.unstubAllGlobals();
  });

  it('retry after register(viewKey) resends the same viewKey', async () => {
    const viewKey = 'c'.repeat(64);
    vi.mocked(startPasskeyRegistration).mockRejectedValue(new Error('nope'));
    const { result } = renderHook(() => usePasskeyLogin());
    await act(async () => {
      result.current.register(viewKey);
    });
    expect(result.current.status).toBe('error');
    expect(startPasskeyRegistration).toHaveBeenCalledWith(viewKey);
    await act(async () => {
      result.current.retry();
    });
    expect(startPasskeyRegistration).toHaveBeenCalledTimes(2);
    expect(vi.mocked(startPasskeyRegistration).mock.calls[1]?.[0]).toBe(viewKey);
  });

  it('authenticates with a passkey', async () => {
    const cred = { id: 'cred', type: 'public-key' };
    vi.stubGlobal('navigator', {
      ...navigator,
      credentials: { create: vi.fn(), get: vi.fn().mockResolvedValue(cred) },
    });
    const { result } = renderHook(() => usePasskeyLogin());
    await act(async () => {
      result.current.authenticate();
    });
    expect(useAuthStore.getState().account?.id).toBe('acc_1');
    expect(rememberSessionPhrase).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('login uses an existing passkey without creating one', async () => {
    const cred = { id: 'cred', type: 'public-key' };
    const create = vi.fn();
    vi.stubGlobal('navigator', {
      ...navigator,
      credentials: { create, get: vi.fn().mockResolvedValue(cred) },
    });
    const { result } = renderHook(() => usePasskeyLogin());
    await act(async () => {
      result.current.login();
    });
    expect(useAuthStore.getState().account?.id).toBe('acc_1');
    expect(create).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('retries the single-button flow after an authenticate error', async () => {
    vi.mocked(startPasskeyAuthentication).mockRejectedValueOnce(new Error('nope'));
    const { result } = renderHook(() => usePasskeyLogin());
    await act(async () => {
      result.current.login();
    });
    expect(result.current.status).toBe('error');
    expect(startPasskeyRegistration).not.toHaveBeenCalled();
    const cred = { id: 'cred', type: 'public-key' };
    vi.stubGlobal('navigator', {
      ...navigator,
      credentials: {
        get: vi.fn().mockRejectedValue(new DOMException('no', 'NotAllowedError')),
        create: vi.fn().mockResolvedValue(cred),
      },
    });
    await act(async () => {
      result.current.retry();
    });
    expect(startPasskeyAuthentication).toHaveBeenCalledTimes(2);
    expect(startPasskeyRegistration).not.toHaveBeenCalled();
    expect(result.current.status).toBe('choice');
    expect(useAuthStore.getState().session).toBeNull();
    vi.unstubAllGlobals();
  });

  it('login WrongAccountError from finish does not start registration', async () => {
    const cred = { id: 'cred', type: 'public-key' };
    vi.stubGlobal('navigator', {
      ...navigator,
      credentials: { create: vi.fn(), get: vi.fn().mockResolvedValue(cred) },
    });
    vi.mocked(finishPasskeyAuthentication).mockRejectedValue(new WrongAccountError());
    const { result } = renderHook(() => usePasskeyLogin());
    await act(async () => {
      result.current.login();
    });
    expect(result.current.status).toBe('error');
    expect(result.current.error).toBe(WRONG_ACCOUNT_ERROR);
    expect(startPasskeyRegistration).not.toHaveBeenCalled();
    expect(useAuthStore.getState().session).toBeNull();
    expect(useAuthStore.getState().wrongAccount).toBe(true);
    vi.unstubAllGlobals();
  });

  it('login does not create a passkey when authenticate begin fails', async () => {
    const create = vi.fn();
    vi.stubGlobal('navigator', {
      ...navigator,
      credentials: { create, get: vi.fn() },
    });
    vi.mocked(startPasskeyAuthentication).mockRejectedValue(new Error('nope'));
    const { result } = renderHook(() => usePasskeyLogin());
    await act(async () => {
      result.current.login();
    });
    expect(result.current.status).toBe('error');
    expect(create).not.toHaveBeenCalled();
    expect(startPasskeyRegistration).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('login offers a choice when get is dismissed', async () => {
    const create = vi.fn();
    vi.stubGlobal('navigator', {
      ...navigator,
      credentials: {
        get: vi.fn().mockRejectedValue(new DOMException('no', 'NotAllowedError')),
        create,
      },
    });
    const { result } = renderHook(() => usePasskeyLogin());
    await act(async () => {
      result.current.login();
    });
    expect(result.current.status).toBe('choice');
    expect(startPasskeyRegistration).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
    expect(useAuthStore.getState().session).toBeNull();
    vi.unstubAllGlobals();
  });

  it('authenticate from choice runs get, not create', async () => {
    const cred = { id: 'cred', type: 'public-key' };
    const create = vi.fn();
    const get = vi
      .fn()
      .mockRejectedValueOnce(new DOMException('no', 'NotAllowedError'))
      .mockResolvedValueOnce(cred);
    vi.stubGlobal('navigator', {
      ...navigator,
      credentials: { create, get },
    });
    const { result } = renderHook(() => usePasskeyLogin());
    await act(async () => {
      result.current.login();
    });
    expect(result.current.status).toBe('choice');
    await act(async () => {
      result.current.authenticate();
    });
    expect(get).toHaveBeenCalledTimes(2);
    expect(create).not.toHaveBeenCalled();
    expect(startPasskeyRegistration).not.toHaveBeenCalled();
    expect(useAuthStore.getState().session).toBe('tok');
    vi.unstubAllGlobals();
  });

  it('register from choice runs create', async () => {
    const cred = { id: 'cred', type: 'public-key' };
    const create = vi.fn().mockResolvedValue(cred);
    vi.stubGlobal('navigator', {
      ...navigator,
      credentials: {
        get: vi.fn().mockRejectedValue(new DOMException('no', 'NotAllowedError')),
        create,
      },
    });
    const { result } = renderHook(() => usePasskeyLogin());
    await act(async () => {
      result.current.login();
    });
    expect(result.current.status).toBe('choice');
    await act(async () => {
      result.current.register();
    });
    expect(create).toHaveBeenCalledTimes(1);
    expect(startPasskeyRegistration).toHaveBeenCalledTimes(1);
    expect(vi.mocked(startPasskeyRegistration).mock.calls[0]?.[0]).toBeUndefined();
    expect(useAuthStore.getState().session).toBe('tok');
    vi.unstubAllGlobals();
  });

  it('returns to choice when authenticate is cancelled after a choice', async () => {
    vi.stubGlobal('navigator', {
      ...navigator,
      credentials: {
        get: vi.fn().mockRejectedValue(new DOMException('no', 'NotAllowedError')),
        create: vi.fn(),
      },
    });
    const { result } = renderHook(() => usePasskeyLogin());
    await act(async () => {
      result.current.login();
    });
    expect(result.current.status).toBe('choice');
    await act(async () => {
      result.current.authenticate();
    });
    expect(result.current.status).toBe('choice');
    expect(startPasskeyRegistration).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('returns to choice when register is cancelled after a choice', async () => {
    vi.stubGlobal('navigator', {
      ...navigator,
      credentials: {
        get: vi.fn().mockRejectedValue(new DOMException('no', 'NotAllowedError')),
        create: vi.fn().mockRejectedValue(new DOMException('no', 'NotAllowedError')),
      },
    });
    const { result } = renderHook(() => usePasskeyLogin());
    await act(async () => {
      result.current.login();
    });
    expect(result.current.status).toBe('choice');
    await act(async () => {
      result.current.register();
    });
    expect(result.current.status).toBe('choice');
    vi.unstubAllGlobals();
  });

  it('login sets unsupported when get is NotAllowedError inside an in-app browser', async () => {
    const create = vi.fn();
    vi.mocked(isInAppBrowser).mockReturnValue(true);
    vi.stubGlobal('navigator', {
      ...navigator,
      credentials: {
        get: vi.fn().mockRejectedValue(new DOMException('no', 'NotAllowedError')),
        create,
      },
    });
    const { result } = renderHook(() => usePasskeyLogin());
    await act(async () => {
      result.current.login();
    });
    expect(result.current.status).toBe('unsupported');
    expect(create).not.toHaveBeenCalled();
    expect(startPasskeyRegistration).not.toHaveBeenCalled();
    expect(useAuthStore.getState().session).toBeNull();
    vi.unstubAllGlobals();
  });

  it('login skips the passkey ceremony when isInAppBrowser is true', async () => {
    const get = vi.fn();
    vi.mocked(isInAppBrowser).mockReturnValue(true);
    vi.stubGlobal('navigator', {
      ...navigator,
      credentials: { create: vi.fn(), get },
    });
    const { result } = renderHook(() => usePasskeyLogin());
    await act(async () => {
      result.current.login();
    });
    expect(result.current.status).toBe('unsupported');
    expect(startPasskeyAuthentication).not.toHaveBeenCalled();
    expect(get).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('authenticate skips the passkey ceremony when isInAppBrowser is true', async () => {
    const get = vi.fn();
    vi.mocked(isInAppBrowser).mockReturnValue(true);
    vi.stubGlobal('navigator', {
      ...navigator,
      credentials: { create: vi.fn(), get },
    });
    const { result } = renderHook(() => usePasskeyLogin());
    await act(async () => {
      result.current.authenticate();
    });
    expect(result.current.status).toBe('unsupported');
    expect(startPasskeyAuthentication).not.toHaveBeenCalled();
    expect(get).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('register skips the passkey ceremony when isInAppBrowser is true', async () => {
    const create = vi.fn();
    vi.mocked(isInAppBrowser).mockReturnValue(true);
    vi.stubGlobal('navigator', {
      ...navigator,
      credentials: { create, get: vi.fn() },
    });
    const { result } = renderHook(() => usePasskeyLogin());
    await act(async () => {
      result.current.register();
    });
    expect(result.current.status).toBe('unsupported');
    expect(startPasskeyRegistration).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('login sets unsupported when get is NotAllowedError after entering an in-app browser', async () => {
    const create = vi.fn();
    vi.mocked(isInAppBrowser).mockReturnValueOnce(false).mockReturnValue(true);
    vi.stubGlobal('navigator', {
      ...navigator,
      credentials: {
        get: vi.fn().mockRejectedValue(new DOMException('no', 'NotAllowedError')),
        create,
      },
    });
    const { result } = renderHook(() => usePasskeyLogin());
    await act(async () => {
      result.current.login();
    });
    expect(result.current.status).toBe('unsupported');
    expect(startPasskeyRegistration).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('cancel aborts in-flight login before register starts', async () => {
    let rejectGet: (reason: unknown) => void = () => undefined;
    const create = vi.fn();
    vi.stubGlobal('navigator', {
      ...navigator,
      credentials: {
        get: vi.fn().mockImplementation(
          () =>
            new Promise((_resolve, reject) => {
              rejectGet = reject;
            }),
        ),
        create,
      },
    });
    const { result } = renderHook(() => usePasskeyLogin());
    act(() => {
      result.current.login();
    });
    act(() => {
      result.current.cancel();
    });
    await act(async () => {
      rejectGet(new DOMException('no', 'NotAllowedError'));
      await Promise.resolve();
    });
    expect(result.current.status).toBe('idle');
    expect(create).not.toHaveBeenCalled();
    expect(startPasskeyRegistration).not.toHaveBeenCalled();
    expect(useAuthStore.getState().session).toBeNull();
    vi.unstubAllGlobals();
  });

  it('returns to idle when the user cancels', async () => {
    vi.stubGlobal('navigator', {
      ...navigator,
      credentials: {
        create: vi.fn().mockRejectedValue(new DOMException('no', 'NotAllowedError')),
        get: vi.fn(),
      },
    });
    const { result } = renderHook(() => usePasskeyLogin());
    await act(async () => {
      result.current.register();
    });
    expect(result.current.status).toBe('idle');
    vi.unstubAllGlobals();
  });

  it('cancel returns to idle without finishing', async () => {
    let resolveCreate: (value: unknown) => void = () => undefined;
    vi.stubGlobal('navigator', {
      ...navigator,
      credentials: {
        create: vi.fn().mockImplementation(
          () =>
            new Promise((resolve) => {
              resolveCreate = resolve;
            }),
        ),
        get: vi.fn(),
      },
    });
    const { result } = renderHook(() => usePasskeyLogin());
    act(() => {
      result.current.register();
    });
    act(() => {
      result.current.cancel();
    });
    await act(async () => {
      resolveCreate({ id: 'cred', type: 'public-key' });
      await Promise.resolve();
    });
    expect(result.current.status).toBe('idle');
    expect(useAuthStore.getState().session).toBeNull();
    vi.unstubAllGlobals();
  });

  it('ignores a late create after unmount', async () => {
    let resolveCreate: (value: unknown) => void = () => undefined;
    vi.stubGlobal('navigator', {
      ...navigator,
      credentials: {
        create: vi.fn().mockImplementation(
          () =>
            new Promise((resolve) => {
              resolveCreate = resolve;
            }),
        ),
        get: vi.fn(),
      },
    });
    const { result, unmount } = renderHook(() => usePasskeyLogin());
    act(() => {
      result.current.register();
    });
    unmount();
    await act(async () => {
      resolveCreate({ id: 'cred', type: 'public-key' });
      await Promise.resolve();
    });
    expect(useAuthStore.getState().session).toBeNull();
    vi.unstubAllGlobals();
  });

  it('stores a non-Error rejection as a string', async () => {
    vi.mocked(startPasskeyRegistration).mockRejectedValue('plain-fail');
    const { result } = renderHook(() => usePasskeyLogin());
    await act(async () => {
      result.current.register();
    });
    expect(result.current.status).toBe('error');
    expect(result.current.error).toBe('plain-fail');
  });

  it('goes to error when create returns null', async () => {
    vi.stubGlobal('navigator', {
      ...navigator,
      credentials: { create: vi.fn().mockResolvedValue(null), get: vi.fn() },
    });
    const { result } = renderHook(() => usePasskeyLogin());
    await act(async () => {
      result.current.register();
    });
    expect(result.current.status).toBe('error');
    vi.unstubAllGlobals();
  });

  it('goes to error when get returns null', async () => {
    vi.stubGlobal('navigator', {
      ...navigator,
      credentials: { create: vi.fn(), get: vi.fn().mockResolvedValue(null) },
    });
    const { result } = renderHook(() => usePasskeyLogin());
    await act(async () => {
      result.current.authenticate();
    });
    expect(result.current.status).toBe('error');
    vi.unstubAllGlobals();
  });

  it('goes to error on a failed request', async () => {
    vi.mocked(startPasskeyRegistration).mockRejectedValue(new Error('nope'));
    const { result } = renderHook(() => usePasskeyLogin());
    await act(async () => {
      result.current.register();
    });
    expect(result.current.status).toBe('error');
  });

  it('goes to error on a failed authenticate request', async () => {
    vi.mocked(startPasskeyAuthentication).mockRejectedValue(new Error('nope'));
    const { result } = renderHook(() => usePasskeyLogin());
    await act(async () => {
      result.current.authenticate();
    });
    expect(result.current.status).toBe('error');
  });

  it('returns to idle when authenticate is cancelled', async () => {
    vi.stubGlobal('navigator', {
      ...navigator,
      credentials: {
        create: vi.fn(),
        get: vi.fn().mockRejectedValue(new DOMException('no', 'NotAllowedError')),
      },
    });
    const { result } = renderHook(() => usePasskeyLogin());
    await act(async () => {
      result.current.authenticate();
    });
    expect(result.current.status).toBe('idle');
    vi.unstubAllGlobals();
  });

  it('returns to idle when authenticate is aborted', async () => {
    vi.stubGlobal('navigator', {
      ...navigator,
      credentials: {
        create: vi.fn(),
        get: vi.fn().mockRejectedValue(new DOMException('aborted', 'AbortError')),
      },
    });
    const { result } = renderHook(() => usePasskeyLogin());
    await act(async () => {
      result.current.authenticate();
    });
    expect(result.current.status).toBe('idle');
    vi.unstubAllGlobals();
  });

  it('retries the last authenticate attempt', async () => {
    vi.mocked(startPasskeyAuthentication).mockRejectedValueOnce(new Error('nope'));
    const { result } = renderHook(() => usePasskeyLogin());
    await act(async () => {
      result.current.authenticate();
    });
    expect(result.current.status).toBe('error');
    vi.mocked(startPasskeyAuthentication).mockRejectedValueOnce(new Error('again'));
    await act(async () => {
      result.current.retry();
    });
    expect(vi.mocked(startPasskeyAuthentication)).toHaveBeenCalledTimes(2);
    expect(result.current.status).toBe('error');
  });

  it('retries authenticate by default', async () => {
    vi.mocked(startPasskeyAuthentication).mockRejectedValue(new Error('nope'));
    const { result } = renderHook(() => usePasskeyLogin());
    await act(async () => {
      result.current.retry();
    });
    expect(vi.mocked(startPasskeyAuthentication)).toHaveBeenCalled();
    expect(vi.mocked(startPasskeyRegistration)).not.toHaveBeenCalled();
  });

  it('retries register after a failed register', async () => {
    vi.mocked(startPasskeyRegistration).mockRejectedValue(new Error('nope'));
    const { result } = renderHook(() => usePasskeyLogin());
    await act(async () => {
      result.current.register();
    });
    expect(result.current.status).toBe('error');
    await act(async () => {
      result.current.retry();
    });
    expect(vi.mocked(startPasskeyRegistration)).toHaveBeenCalledTimes(2);
  });

  it('goes to error when create returns a non-passkey credential', async () => {
    vi.stubGlobal('navigator', {
      ...navigator,
      credentials: { create: vi.fn().mockResolvedValue({ type: 'password' }), get: vi.fn() },
    });
    const { result } = renderHook(() => usePasskeyLogin());
    await act(async () => {
      result.current.register();
    });
    expect(result.current.status).toBe('error');
    vi.unstubAllGlobals();
  });

  it('goes to error when get returns a non-passkey credential', async () => {
    vi.stubGlobal('navigator', {
      ...navigator,
      credentials: { create: vi.fn(), get: vi.fn().mockResolvedValue({ type: 'password' }) },
    });
    const { result } = renderHook(() => usePasskeyLogin());
    await act(async () => {
      result.current.authenticate();
    });
    expect(result.current.status).toBe('error');
    vi.unstubAllGlobals();
  });

  it('ignores a superseded register finish', async () => {
    const cred = { id: 'cred', type: 'public-key' };
    vi.stubGlobal('navigator', {
      ...navigator,
      credentials: { create: vi.fn().mockResolvedValue(cred), get: vi.fn() },
    });
    let resolveFinish!: (v: { token: string; account: typeof account }) => void;
    vi.mocked(finishPasskeyRegistration).mockReturnValueOnce(
      new Promise((resolve) => {
        resolveFinish = resolve;
      }),
    );
    const { result } = renderHook(() => usePasskeyLogin());
    await act(async () => {
      result.current.register();
    });
    vi.mocked(startPasskeyRegistration).mockRejectedValueOnce(new Error('second'));
    await act(async () => {
      result.current.register();
    });
    await act(async () => {
      resolveFinish({ token: 'tok', account });
    });
    expect(useAuthStore.getState().session).toBeNull();
    vi.unstubAllGlobals();
  });

  it('ignores a superseded authenticate finish', async () => {
    const cred = { id: 'cred', type: 'public-key' };
    vi.stubGlobal('navigator', {
      ...navigator,
      credentials: { create: vi.fn(), get: vi.fn().mockResolvedValue(cred) },
    });
    let resolveFinish!: (v: { token: string; account: typeof account }) => void;
    vi.mocked(finishPasskeyAuthentication).mockReturnValueOnce(
      new Promise((resolve) => {
        resolveFinish = resolve;
      }),
    );
    const { result } = renderHook(() => usePasskeyLogin());
    await act(async () => {
      result.current.authenticate();
    });
    vi.mocked(startPasskeyAuthentication).mockRejectedValueOnce(new Error('second'));
    await act(async () => {
      result.current.authenticate();
    });
    await act(async () => {
      resolveFinish({ token: 'tok', account });
    });
    expect(useAuthStore.getState().session).toBeNull();
    vi.unstubAllGlobals();
  });

  it('does not finish register after a newer run started during create', async () => {
    let resolveCreate!: (v: { id: string; type: string }) => void;
    vi.stubGlobal('navigator', {
      ...navigator,
      credentials: {
        create: vi.fn().mockReturnValue(
          new Promise((resolve) => {
            resolveCreate = resolve;
          }),
        ),
        get: vi.fn(),
      },
    });
    const { result } = renderHook(() => usePasskeyLogin());
    await act(async () => {
      result.current.register();
    });
    vi.mocked(startPasskeyRegistration).mockRejectedValueOnce(new Error('second'));
    await act(async () => {
      result.current.register();
    });
    await act(async () => {
      resolveCreate({ id: 'cred', type: 'public-key' });
    });
    expect(vi.mocked(finishPasskeyRegistration)).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('does not finish authenticate after a newer run started during get', async () => {
    let resolveGet!: (v: { id: string; type: string }) => void;
    vi.stubGlobal('navigator', {
      ...navigator,
      credentials: {
        create: vi.fn(),
        get: vi.fn().mockReturnValue(
          new Promise((resolve) => {
            resolveGet = resolve;
          }),
        ),
      },
    });
    const { result } = renderHook(() => usePasskeyLogin());
    await act(async () => {
      result.current.authenticate();
    });
    vi.mocked(startPasskeyAuthentication).mockRejectedValueOnce(new Error('second'));
    await act(async () => {
      result.current.authenticate();
    });
    await act(async () => {
      resolveGet({ id: 'cred', type: 'public-key' });
    });
    expect(vi.mocked(finishPasskeyAuthentication)).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('ignores a superseded register success and a late error', async () => {
    const cred = { id: 'cred', type: 'public-key' };
    vi.stubGlobal('navigator', {
      ...navigator,
      credentials: { create: vi.fn().mockResolvedValue(cred), get: vi.fn() },
    });
    let resolveBegin!: (v: typeof begin) => void;
    let rejectBegin!: (e: unknown) => void;
    vi.mocked(startPasskeyRegistration).mockReturnValueOnce(
      new Promise((resolve) => {
        resolveBegin = resolve;
      }),
    );
    vi.mocked(startPasskeyRegistration).mockReturnValueOnce(
      new Promise((_, reject) => {
        rejectBegin = reject;
      }),
    );
    const { result } = renderHook(() => usePasskeyLogin());
    act(() => {
      result.current.register();
    });
    act(() => {
      result.current.register();
    });
    await act(async () => {
      resolveBegin(begin);
    });
    await act(async () => {
      rejectBegin(new Error('late'));
    });
    expect(useAuthStore.getState().session).toBeNull();
    vi.unstubAllGlobals();
  });

  it('ignores a late register error after a newer run', async () => {
    let rejectFirst!: (e: unknown) => void;
    vi.mocked(startPasskeyRegistration).mockReturnValueOnce(
      new Promise((_, reject) => {
        rejectFirst = reject;
      }),
    );
    vi.mocked(startPasskeyRegistration).mockRejectedValueOnce(new Error('second'));
    const { result } = renderHook(() => usePasskeyLogin());
    act(() => {
      result.current.register();
    });
    await act(async () => {
      result.current.register();
    });
    await act(async () => {
      rejectFirst(new Error('late first'));
    });
    expect(result.current.status).toBe('error');
  });

  it('ignores a superseded authenticate success and a late error', async () => {
    const cred = { id: 'cred', type: 'public-key' };
    vi.stubGlobal('navigator', {
      ...navigator,
      credentials: { create: vi.fn(), get: vi.fn().mockResolvedValue(cred) },
    });
    let resolveBegin!: (v: typeof begin) => void;
    let rejectBegin!: (e: unknown) => void;
    vi.mocked(startPasskeyAuthentication).mockReturnValueOnce(
      new Promise((resolve) => {
        resolveBegin = resolve;
      }),
    );
    vi.mocked(startPasskeyAuthentication).mockReturnValueOnce(
      new Promise((_, reject) => {
        rejectBegin = reject;
      }),
    );
    const { result } = renderHook(() => usePasskeyLogin());
    act(() => {
      result.current.authenticate();
    });
    act(() => {
      result.current.authenticate();
    });
    await act(async () => {
      resolveBegin(begin);
    });
    await act(async () => {
      rejectBegin(new Error('late'));
    });
    expect(useAuthStore.getState().session).toBeNull();
    vi.unstubAllGlobals();
  });

  it('ignores a late authenticate error after a newer run', async () => {
    let rejectFirst!: (e: unknown) => void;
    vi.mocked(startPasskeyAuthentication).mockReturnValueOnce(
      new Promise((_, reject) => {
        rejectFirst = reject;
      }),
    );
    vi.mocked(startPasskeyAuthentication).mockRejectedValueOnce(new Error('second'));
    const { result } = renderHook(() => usePasskeyLogin());
    act(() => {
      result.current.authenticate();
    });
    await act(async () => {
      result.current.authenticate();
    });
    await act(async () => {
      rejectFirst(new Error('late first'));
    });
    expect(result.current.status).toBe('error');
  });

  it('omits signal on iPhone authenticate get', async () => {
    const cred = { id: 'cred', type: 'public-key' };
    const get = vi.fn().mockResolvedValue(cred);
    vi.stubGlobal('navigator', {
      ...navigator,
      credentials: { create: vi.fn(), get },
    });
    const originalUserAgent = navigator.userAgent;
    Object.defineProperty(navigator, 'userAgent', {
      configurable: true,
      value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
    });
    const { result } = renderHook(() => usePasskeyLogin());
    await act(async () => {
      result.current.authenticate();
    });
    expect(get).toHaveBeenCalledTimes(1);
    expect(get.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({ publicKey: expect.anything() }),
    );
    expect(get.mock.calls[0]?.[0]).not.toHaveProperty('signal');
    Object.defineProperty(navigator, 'userAgent', {
      configurable: true,
      value: originalUserAgent,
    });
    vi.unstubAllGlobals();
  });

  it('omits signal on iPhone register create', async () => {
    const cred = { id: 'cred', type: 'public-key' };
    const create = vi.fn().mockResolvedValue(cred);
    vi.stubGlobal('navigator', {
      ...navigator,
      credentials: { create, get: vi.fn() },
    });
    const originalUserAgent = navigator.userAgent;
    Object.defineProperty(navigator, 'userAgent', {
      configurable: true,
      value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
    });
    const { result } = renderHook(() => usePasskeyLogin());
    await act(async () => {
      result.current.register();
    });
    expect(create).toHaveBeenCalledTimes(1);
    expect(create.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({ publicKey: expect.anything() }),
    );
    expect(create.mock.calls[0]?.[0]).not.toHaveProperty('signal');
    Object.defineProperty(navigator, 'userAgent', {
      configurable: true,
      value: originalUserAgent,
    });
    vi.unstubAllGlobals();
  });

  it('omits signal on iPadOS desktop-site authenticate get', async () => {
    const cred = { id: 'cred', type: 'public-key' };
    const get = vi.fn().mockResolvedValue(cred);
    vi.stubGlobal('navigator', {
      ...navigator,
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15',
      platform: 'MacIntel',
      maxTouchPoints: 5,
      credentials: { create: vi.fn(), get },
    });
    const { result } = renderHook(() => usePasskeyLogin());
    await act(async () => {
      result.current.authenticate();
    });
    expect(get).toHaveBeenCalledTimes(1);
    expect(get.mock.calls[0]?.[0]).not.toHaveProperty('signal');
    vi.unstubAllGlobals();
  });

  it('passes signal to get on non-iOS', async () => {
    const cred = { id: 'cred', type: 'public-key' };
    const get = vi.fn().mockResolvedValue(cred);
    vi.stubGlobal('navigator', {
      ...navigator,
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/120.0.0.0',
      platform: 'MacIntel',
      maxTouchPoints: 0,
      credentials: { create: vi.fn(), get },
    });
    const { result } = renderHook(() => usePasskeyLogin());
    await act(async () => {
      result.current.authenticate();
    });
    expect(get).toHaveBeenCalledTimes(1);
    expect(get.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        publicKey: expect.anything(),
        signal: expect.any(AbortSignal),
      }),
    );
    vi.unstubAllGlobals();
  });

  it('goes to choice on iPhone after login NotAllowedError without registering', async () => {
    vi.useFakeTimers();
    const create = vi.fn();
    vi.stubGlobal('navigator', {
      ...navigator,
      credentials: {
        get: vi.fn().mockRejectedValue(new DOMException('no', 'NotAllowedError')),
        create,
      },
    });
    const originalUserAgent = navigator.userAgent;
    Object.defineProperty(navigator, 'userAgent', {
      configurable: true,
      value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
    });
    const { result } = renderHook(() => usePasskeyLogin());
    await act(async () => {
      result.current.login();
    });
    expect(result.current.status).toBe('choice');
    expect(startPasskeyRegistration).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
    await act(async () => {
      vi.advanceTimersByTime(400);
    });
    expect(result.current.status).toBe('choice');
    expect(startPasskeyRegistration).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
    Object.defineProperty(navigator, 'userAgent', {
      configurable: true,
      value: originalUserAgent,
    });
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });
});
