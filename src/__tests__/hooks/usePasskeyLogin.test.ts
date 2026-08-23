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

  it('retries register by default', async () => {
    vi.mocked(startPasskeyRegistration).mockRejectedValue(new Error('nope'));
    const { result } = renderHook(() => usePasskeyLogin());
    await act(async () => {
      result.current.retry();
    });
    expect(vi.mocked(startPasskeyRegistration)).toHaveBeenCalled();
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
