import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactElement } from 'react';
import { useMyLoans } from '@/hooks/useMyLoans';
import { getMyLoans, type MyLoans } from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';

vi.mock('@/lib/api', () => ({ getMyLoans: vi.fn() }));

const EMPTY: MyLoans = { sundayRest: false, loans: [] };

function Probe(): ReactElement {
  return <p>{useMyLoans().loans === null ? 'empty' : 'loaded'}</p>;
}

beforeEach(() => {
  vi.mocked(getMyLoans).mockReset();
  useAuthStore.setState({ session: 'session-1' });
});

afterEach(() => {
  cleanup();
  useAuthStore.setState({ session: null, account: null });
});

describe('useMyLoans', () => {
  it('loads once for two instances and shares an explicit reload update', async () => {
    const sunday: MyLoans = { sundayRest: true, loans: [] };
    vi.mocked(getMyLoans).mockResolvedValueOnce(EMPTY).mockResolvedValueOnce(sunday);
    const { result } = renderHook(() => {
      const first = useMyLoans();
      const second = useMyLoans();
      return { first, second };
    });
    expect(result.current.first.loans).toBeNull();
    expect(result.current.second.loans).toBeNull();
    await waitFor(() => {
      expect(result.current.first.loans).toEqual(EMPTY);
    });
    expect(result.current.second.loans).toEqual(EMPTY);
    expect(getMyLoans).toHaveBeenCalledTimes(1);
    await act(async () => {
      await expect(result.current.first.reload()).resolves.toEqual(sunday);
    });
    expect(result.current.first.loans).toEqual(sunday);
    expect(result.current.second.loans).toEqual(sunday);
    act(() => {
      useAuthStore.setState({ account: null });
    });
    expect(result.current.first.loans).toEqual(sunday);
    expect(getMyLoans).toHaveBeenNthCalledWith(1, 'session-1');
    expect(getMyLoans).toHaveBeenNthCalledWith(2, 'session-1');

    const later = renderHook(() => useMyLoans());
    expect(later.result.current.loans).toEqual(sunday);
    expect(getMyLoans).toHaveBeenCalledTimes(2);
  });

  it('returns null but keeps the last good body after a failed reload', async () => {
    vi.mocked(getMyLoans).mockResolvedValueOnce(EMPTY).mockRejectedValueOnce(new Error('offline'));
    const { result } = renderHook(() => useMyLoans());
    await waitFor(() => {
      expect(result.current.loans).toEqual(EMPTY);
    });
    await act(async () => {
      await expect(result.current.reload()).resolves.toBeNull();
    });
    expect(result.current.loans).toEqual(EMPTY);
  });

  it('stays null without a session and does not read', async () => {
    useAuthStore.setState({ session: null, account: null });
    const { result } = renderHook(() => useMyLoans());
    await act(async () => undefined);
    expect(result.current.loans).toBeNull();
    await act(async () => {
      await expect(result.current.reload()).resolves.toBeNull();
    });
    expect(getMyLoans).not.toHaveBeenCalled();
  });

  it('uses null as its server snapshot', () => {
    expect(renderToString(<Probe />)).toContain('empty');
    expect(getMyLoans).not.toHaveBeenCalled();
  });

  it('resets for a new session and signed-out state, and drops the old response', async () => {
    let resolveOld!: (body: MyLoans) => void;
    const newBody: MyLoans = { sundayRest: true, loans: [] };
    vi.mocked(getMyLoans)
      .mockReturnValueOnce(
        new Promise<MyLoans>((resolve) => {
          resolveOld = resolve;
        }),
      )
      .mockResolvedValueOnce(newBody);
    const { result } = renderHook(() => useMyLoans());
    await act(async () => {
      useAuthStore.setState({ session: 'session-2' });
    });
    await waitFor(() => {
      expect(result.current.loans).toEqual(newBody);
    });
    await act(async () => {
      resolveOld(EMPTY);
    });
    expect(result.current.loans).toEqual(newBody);
    act(() => {
      useAuthStore.setState({ session: null, account: null });
    });
    expect(result.current.loans).toBeNull();
  });

  it('drops a response from an earlier generation of the same session token', async () => {
    let resolveFirst!: (body: MyLoans) => void;
    const latest: MyLoans = { sundayRest: true, loans: [] };
    vi.mocked(getMyLoans)
      .mockReturnValueOnce(
        new Promise<MyLoans>((resolve) => {
          resolveFirst = resolve;
        }),
      )
      .mockResolvedValueOnce(EMPTY)
      .mockResolvedValueOnce(latest);
    const { result } = renderHook(() => useMyLoans());
    await act(async () => {
      useAuthStore.setState({ session: 'session-2' });
    });
    await waitFor(() => expect(result.current.loans).toEqual(EMPTY));
    await act(async () => {
      useAuthStore.setState({ session: 'session-1' });
    });
    await waitFor(() => expect(result.current.loans).toEqual(latest));
    await act(async () => {
      resolveFirst(EMPTY);
    });
    expect(result.current.loans).toEqual(latest);
  });

  it('ignores an older request after a newer request was applied', async () => {
    let resolveOlder!: (body: MyLoans) => void;
    const newer: MyLoans = { sundayRest: true, loans: [] };
    vi.mocked(getMyLoans)
      .mockResolvedValueOnce(EMPTY)
      .mockReturnValueOnce(
        new Promise<MyLoans>((done) => {
          resolveOlder = done;
        }),
      )
      .mockResolvedValueOnce(newer);
    const { result } = renderHook(() => useMyLoans());
    await waitFor(() => expect(result.current.loans).toEqual(EMPTY));
    let olderResult: MyLoans | null | undefined;
    act(() => {
      void result.current.reload().then((body) => {
        olderResult = body;
      });
    });
    await act(async () => {
      await expect(result.current.reload()).resolves.toEqual(newer);
    });
    expect(result.current.loans).toEqual(newer);
    await act(async () => {
      resolveOlder(EMPTY);
    });
    expect(olderResult).toBeNull();
    expect(result.current.loans).toEqual(newer);
  });

  it('tries an initial read again for a later mount after a failure', async () => {
    vi.mocked(getMyLoans).mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(EMPTY);
    const first = renderHook(() => useMyLoans());
    await waitFor(() => expect(getMyLoans).toHaveBeenCalledTimes(1));
    await act(async () => undefined);
    first.unmount();
    const second = renderHook(() => useMyLoans());
    await waitFor(() => expect(second.result.current.loans).toEqual(EMPTY));
    expect(getMyLoans).toHaveBeenCalledTimes(2);
  });
});
