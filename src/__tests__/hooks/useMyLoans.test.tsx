import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useMyLoans } from '@/hooks/useMyLoans';
import { getMyLoans, type MyLoans } from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';

vi.mock('@/lib/api', () => ({ getMyLoans: vi.fn() }));

const EMPTY: MyLoans = { sundayRest: false, loans: [] };

beforeEach(() => {
  vi.mocked(getMyLoans).mockReset();
  useAuthStore.setState({ session: 'session-1' });
});

afterEach(() => {
  cleanup();
});

describe('useMyLoans', () => {
  it('reads on mount and reloads explicitly', async () => {
    const sunday: MyLoans = { sundayRest: true, loans: [] };
    vi.mocked(getMyLoans).mockResolvedValueOnce(EMPTY).mockResolvedValueOnce(sunday);
    const { result } = renderHook(() => useMyLoans());
    expect(result.current.loans).toBeNull();
    await waitFor(() => {
      expect(result.current.loans).toEqual(EMPTY);
    });
    await act(async () => {
      await expect(result.current.reload()).resolves.toEqual(sunday);
    });
    expect(result.current.loans).toEqual(sunday);
    expect(getMyLoans).toHaveBeenNthCalledWith(1, 'session-1');
    expect(getMyLoans).toHaveBeenNthCalledWith(2, 'session-1');
  });

  it('returns null and clears state after a failed reload', async () => {
    vi.mocked(getMyLoans).mockResolvedValueOnce(EMPTY).mockRejectedValueOnce(new Error('offline'));
    const { result } = renderHook(() => useMyLoans());
    await waitFor(() => {
      expect(result.current.loans).toEqual(EMPTY);
    });
    await act(async () => {
      await expect(result.current.reload()).resolves.toBeNull();
    });
    expect(result.current.loans).toBeNull();
  });

  it('stays null without a session', async () => {
    useAuthStore.setState({ session: null, account: null });
    const { result } = renderHook(() => useMyLoans());
    await act(async () => undefined);
    expect(result.current.loans).toBeNull();
    await act(async () => {
      await expect(result.current.reload()).resolves.toBeNull();
    });
    expect(getMyLoans).not.toHaveBeenCalled();
  });

  it('drops an older session response and loads the new session', async () => {
    let resolveOld!: (body: MyLoans) => void;
    vi.mocked(getMyLoans)
      .mockReturnValueOnce(
        new Promise<MyLoans>((resolve) => {
          resolveOld = resolve;
        }),
      )
      .mockResolvedValueOnce({ sundayRest: true, loans: [] });
    const { result } = renderHook(() => useMyLoans());
    await act(async () => {
      useAuthStore.setState({ session: 'session-2' });
    });
    await waitFor(() => {
      expect(result.current.loans).toEqual({ sundayRest: true, loans: [] });
    });
    await act(async () => {
      resolveOld(EMPTY);
    });
    expect(result.current.loans).toEqual({ sundayRest: true, loans: [] });
  });

  it('does not apply a response after unmount', async () => {
    let resolve!: (body: MyLoans) => void;
    vi.mocked(getMyLoans).mockReturnValue(
      new Promise<MyLoans>((done) => {
        resolve = done;
      }),
    );
    const { unmount } = renderHook(() => useMyLoans());
    unmount();
    await act(async () => {
      resolve(EMPTY);
    });
  });

  it('drops an older rejection after another session has loaded', async () => {
    let rejectOld!: (error: unknown) => void;
    vi.mocked(getMyLoans)
      .mockReturnValueOnce(
        new Promise<MyLoans>((_resolve, reject) => {
          rejectOld = reject;
        }),
      )
      .mockResolvedValueOnce(EMPTY);
    const { result } = renderHook(() => useMyLoans());
    await act(async () => {
      useAuthStore.setState({ session: 'session-2' });
    });
    await waitFor(() => {
      expect(result.current.loans).toEqual(EMPTY);
    });
    await act(async () => {
      rejectOld(new Error('old failure'));
    });
    expect(result.current.loans).toEqual(EMPTY);
  });
});
