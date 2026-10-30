import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { usePreviousWallets } from '@/hooks/usePreviousWallets';
import { fetchPreviousWallets } from '@/lib/api';
import type { Account, PreviousWallet } from '@/lib/api-types';
import { useAuthStore } from '@/stores/auth-store';

vi.mock('@/lib/api', () => ({ fetchPreviousWallets: vi.fn() }));

const account: Account = {
  id: 'acc_1',
  linkingKey: null,
  role: 'basis',
  name: 'Ada',
  username: 'ada',
  location: null,
  lightningAddress: null,
  lightningAddressVerified: false,
  forumLawsDismissed: false,
  createdAt: 1_700_000_000,
  rulesAgreedAt: 1_700_000_001,
  viewKey: 'a'.repeat(64),
  aboutMe: null,
  aboutMeHasPhoto: false,
  setup: null,
  missing: [],
  sparkWalletVerified: true,
};

const WALLET: PreviousWallet = {
  sparkPubkey: `02${'a'.repeat(64)}`,
  sparkAddress: 'spark1old',
  replacedAt: 1_767_268_800_000,
  balanceSats: 1_234,
};

/**
 * A promise with its settle functions.
 *
 * @returns The promise, `resolve`, and `reject`.
 */
function deferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason: unknown) => void;
} {
  let resolve: (value: T) => void = () => undefined;
  let reject: (reason: unknown) => void = () => undefined;
  const promise = new Promise<T>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
}

beforeEach(() => {
  vi.mocked(fetchPreviousWallets).mockReset();
  useAuthStore.setState({ session: 'sess', account });
});

afterEach(() => {
  cleanup();
  useAuthStore.setState({ session: null, account: null });
});

describe('usePreviousWallets', () => {
  it('reads the list once with the session and is ready with it', async () => {
    vi.mocked(fetchPreviousWallets).mockResolvedValue([WALLET]);
    const { result, rerender } = renderHook(() => usePreviousWallets());
    expect(result.current.status).toBe('loading');
    expect(result.current.wallets).toEqual([]);
    await waitFor(() => {
      expect(result.current.status).toBe('ready');
    });
    expect(result.current.wallets).toEqual([WALLET]);
    rerender();
    expect(fetchPreviousWallets).toHaveBeenCalledTimes(1);
    expect(fetchPreviousWallets).toHaveBeenCalledWith('sess');
  });

  it.each([
    ['no session', { session: null }],
    ['no verified wallet', { account: { ...account, sparkWalletVerified: false } }],
    ['an older api without the field', { account: { ...account, sparkWalletVerified: undefined } }],
    ['no account', { account: null }],
  ])('reads nothing and is ready and empty with %s', (_label, state) => {
    useAuthStore.setState(state);
    const { result } = renderHook(() => usePreviousWallets());
    expect(result.current.status).toBe('ready');
    expect(result.current.wallets).toEqual([]);
    expect(fetchPreviousWallets).not.toHaveBeenCalled();
  });

  it('reports an error and reads again on retry', async () => {
    vi.mocked(fetchPreviousWallets)
      .mockRejectedValueOnce(new Error('Previous wallets are unavailable'))
      .mockResolvedValueOnce([]);
    const { result } = renderHook(() => usePreviousWallets());
    await waitFor(() => {
      expect(result.current.status).toBe('error');
    });
    expect(result.current.wallets).toEqual([]);
    act(() => {
      result.current.retry();
    });
    expect(result.current.status).toBe('loading');
    await waitFor(() => {
      expect(result.current.status).toBe('ready');
    });
    expect(result.current.wallets).toEqual([]);
    expect(fetchPreviousWallets).toHaveBeenCalledTimes(2);
  });

  it('drops an answer that arrives after unmount', async () => {
    const pending = deferred<PreviousWallet[]>();
    const failing = deferred<PreviousWallet[]>();
    vi.mocked(fetchPreviousWallets)
      .mockReturnValueOnce(pending.promise)
      .mockReturnValueOnce(failing.promise);
    const first = renderHook(() => usePreviousWallets());
    first.unmount();
    const second = renderHook(() => usePreviousWallets());
    second.unmount();
    await act(async () => {
      pending.resolve([WALLET]);
      failing.reject(new Error('late'));
      await Promise.resolve();
    });
    expect(first.result.current.status).toBe('loading');
    expect(second.result.current.status).toBe('loading');
  });

  it('drops the answer of an older read once a retry started', async () => {
    const older = deferred<PreviousWallet[]>();
    vi.mocked(fetchPreviousWallets)
      .mockRejectedValueOnce(new Error('down'))
      .mockReturnValueOnce(older.promise)
      .mockResolvedValueOnce([WALLET]);
    const { result } = renderHook(() => usePreviousWallets());
    await waitFor(() => {
      expect(result.current.status).toBe('error');
    });
    act(() => {
      result.current.retry();
    });
    act(() => {
      result.current.retry();
    });
    await waitFor(() => {
      expect(result.current.status).toBe('ready');
    });
    await act(async () => {
      older.resolve([]);
      await Promise.resolve();
    });
    expect(result.current.wallets).toEqual([WALLET]);
  });

  it('loads again for a new session and never shows the list of the old one', async () => {
    const next = deferred<PreviousWallet[]>();
    vi.mocked(fetchPreviousWallets)
      .mockResolvedValueOnce([WALLET])
      .mockReturnValueOnce(next.promise);
    const { result } = renderHook(() => usePreviousWallets());
    await waitFor(() => {
      expect(result.current.wallets).toEqual([WALLET]);
    });
    act(() => {
      useAuthStore.setState({ session: 'sess-2' });
    });
    expect(result.current.status).toBe('loading');
    expect(result.current.wallets).toEqual([]);
    expect(fetchPreviousWallets).toHaveBeenLastCalledWith('sess-2');
    await act(async () => {
      next.resolve([]);
      await Promise.resolve();
    });
    expect(result.current.status).toBe('ready');
    expect(result.current.wallets).toEqual([]);
  });
});
