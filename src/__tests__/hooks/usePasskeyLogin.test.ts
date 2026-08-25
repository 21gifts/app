import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { usePasskeyLogin } from '@/hooks/usePasskeyLogin';
import {
  finishPasskeyAuthentication,
  finishPasskeyRegistration,
  startPasskeyAuthentication,
  startPasskeyRegistration,
} from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';

vi.mock('@/lib/api', () => ({
  startPasskeyRegistration: vi.fn(),
  finishPasskeyRegistration: vi.fn(),
  startPasskeyAuthentication: vi.fn(),
  finishPasskeyAuthentication: vi.fn(),
}));

vi.mock('@/lib/webauthn-browser', () => ({
  creationOptionsFromJSON: vi.fn().mockReturnValue({ challenge: new ArrayBuffer(1) }),
  requestOptionsFromJSON: vi.fn().mockReturnValue({ challenge: new ArrayBuffer(1) }),
  credentialToJSON: vi.fn().mockReturnValue({ id: 'cred' }),
}));

const account = {
  id: 'acc_1',
  linkingKey: null,
  role: 'basis' as const,
  name: null,
  lightningAddress: null,
  lightningAddressVerified: false,
  createdAt: 1_700_000_000,
};

const begin = { challengeId: 'ch', options: { challenge: 'aa' } };

beforeEach(() => {
  useAuthStore.setState({ session: null, account: null });
  vi.mocked(startPasskeyRegistration).mockReset().mockResolvedValue(begin);
  vi.mocked(finishPasskeyRegistration).mockReset().mockResolvedValue({ token: 'tok', account });
  vi.mocked(startPasskeyAuthentication).mockReset().mockResolvedValue(begin);
  vi.mocked(finishPasskeyAuthentication).mockReset().mockResolvedValue({ token: 'tok', account });
});

afterEach(cleanup);

describe('usePasskeyLogin', () => {
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
    vi.unstubAllGlobals();
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
    expect(startPasskeyRegistration).toHaveBeenCalledTimes(1);
    expect(useAuthStore.getState().session).toBe('tok');
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

  it('login creates a passkey when get is dismissed', async () => {
    const cred = { id: 'cred', type: 'public-key' };
    vi.stubGlobal('navigator', {
      ...navigator,
      credentials: {
        get: vi.fn().mockRejectedValue(new DOMException('no', 'NotAllowedError')),
        create: vi.fn().mockResolvedValue(cred),
      },
    });
    const { result } = renderHook(() => usePasskeyLogin());
    await act(async () => {
      result.current.login();
    });
    expect(useAuthStore.getState().session).toBe('tok');
    expect(startPasskeyRegistration).toHaveBeenCalledTimes(1);
    vi.unstubAllGlobals();
  });

  it('cancel aborts in-flight login before register starts', async () => {
    let resolveGet: (value: unknown) => void = () => undefined;
    const create = vi.fn();
    vi.stubGlobal('navigator', {
      ...navigator,
      credentials: {
        get: vi.fn().mockImplementation(
          () =>
            new Promise((resolve) => {
              resolveGet = resolve;
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
      resolveGet({ id: 'cred', type: 'public-key' });
      await Promise.resolve();
    });
    expect(result.current.status).toBe('idle');
    expect(create).not.toHaveBeenCalled();
    expect(startPasskeyRegistration).not.toHaveBeenCalled();
    expect(useAuthStore.getState().session).toBeNull();
    vi.unstubAllGlobals();
  });

  it('login goes to error when fallback create fails', async () => {
    vi.stubGlobal('navigator', {
      ...navigator,
      credentials: {
        get: vi.fn().mockRejectedValue(new DOMException('no', 'NotAllowedError')),
        create: vi.fn().mockResolvedValue(null),
      },
    });
    const { result } = renderHook(() => usePasskeyLogin());
    await act(async () => {
      result.current.login();
    });
    expect(result.current.status).toBe('error');
    expect(startPasskeyRegistration).toHaveBeenCalled();
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
});
