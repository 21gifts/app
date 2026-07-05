import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useLnurlLogin } from '@/hooks/useLnurlLogin';
import { pollSession, startLnurlAuth } from '@/lib/api';
import type { SessionResult, StartChallenge } from '@/lib/api-types';
import { useAuthStore } from '@/stores/auth-store';

vi.mock('@/lib/api', () => ({
  startLnurlAuth: vi.fn(),
  pollSession: vi.fn(),
  fetchMe: vi.fn(),
}));

const startMock = vi.mocked(startLnurlAuth);
const pollMock = vi.mocked(pollSession);

const challenge: StartChallenge = {
  lnurl: 'lnurl1abc',
  k1: 'deadbeef',
  pollToken: 'ptok',
  expiresInSeconds: 90,
};
const account = {
  id: 'acc_1',
  linkingKey: '02abcdef',
  role: 'basis' as const,
  lightningAddress: null,
  lightningAddressVerified: false,
  createdAt: 1_700_000_000,
};

/** A manually-controllable promise, for interleaving late resolutions. */
function deferred<T>(): {
  promise: Promise<T>;
  resolve: (v: T) => void;
  reject: (e: unknown) => void;
} {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/** Advances fake timers and flushes the promise microtask queue inside `act`. */
async function advance(ms: number): Promise<void> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  useAuthStore.setState({ session: null, account: null });
  window.localStorage.clear();
  startMock.mockReset();
  pollMock.mockReset();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('useLnurlLogin', () => {
  it('walks idle → starting → waiting', async () => {
    startMock.mockResolvedValue(challenge);
    pollMock.mockResolvedValue({ status: 'pending' });

    const { result } = renderHook(() => useLnurlLogin());
    expect(result.current.status).toBe('idle');
    expect(result.current.lnurl).toBeNull();

    act(() => {
      result.current.start();
    });
    expect(result.current.status).toBe('starting');

    await advance(0);
    expect(result.current.status).toBe('waiting');
    expect(result.current.lnurl).toBe(challenge.lnurl);
  });

  it('keeps polling while pending, then authenticates and resets to idle', async () => {
    startMock.mockResolvedValue(challenge);
    pollMock
      .mockResolvedValueOnce({ status: 'pending' })
      .mockResolvedValueOnce({ status: 'authenticated', token: 'sess', account });

    const { result } = renderHook(() => useLnurlLogin());
    act(() => {
      result.current.start();
    });
    await advance(0);

    await advance(2000);
    expect(pollMock).toHaveBeenCalledTimes(1);
    expect(useAuthStore.getState().account).toBeNull();

    await advance(2000);
    expect(pollMock).toHaveBeenCalledTimes(2);
    expect(useAuthStore.getState().account).toEqual(account);
    expect(useAuthStore.getState().session).toBe('sess');
    // Resets so a later logout returns to the start view.
    expect(result.current.status).toBe('idle');
    expect(result.current.lnurl).toBeNull();

    // Polling has stopped: further ticks do not call poll again.
    await advance(2000);
    expect(pollMock).toHaveBeenCalledTimes(2);
  });

  it('ends in expired on an expired result', async () => {
    startMock.mockResolvedValue(challenge);
    pollMock.mockResolvedValue({ status: 'expired' });

    const { result } = renderHook(() => useLnurlLogin());
    act(() => {
      result.current.start();
    });
    await advance(0);
    await advance(2000);

    expect(result.current.status).toBe('expired');
    expect(result.current.lnurl).toBeNull();
    await advance(2000);
    expect(pollMock).toHaveBeenCalledTimes(1);
  });

  it('ends in expired on a used result', async () => {
    startMock.mockResolvedValue(challenge);
    pollMock.mockResolvedValue({ status: 'used' });

    const { result } = renderHook(() => useLnurlLogin());
    act(() => {
      result.current.start();
    });
    await advance(0);
    await advance(2000);

    expect(result.current.status).toBe('expired');
  });

  it('ends in error when starting the challenge throws', async () => {
    startMock.mockRejectedValue(new Error('boom'));

    const { result } = renderHook(() => useLnurlLogin());
    act(() => {
      result.current.start();
    });
    await advance(0);

    expect(result.current.status).toBe('error');
    expect(result.current.lnurl).toBeNull();
  });

  it('ends in error when a poll throws, and stops polling', async () => {
    startMock.mockResolvedValue(challenge);
    pollMock.mockRejectedValue(new Error('network'));

    const { result } = renderHook(() => useLnurlLogin());
    act(() => {
      result.current.start();
    });
    await advance(0);
    await advance(2000);

    expect(result.current.status).toBe('error');
    await advance(2000);
    expect(pollMock).toHaveBeenCalledTimes(1);
  });

  it('clears the previous interval when restarted', async () => {
    startMock.mockResolvedValue(challenge);
    pollMock.mockResolvedValue({ status: 'pending' });

    const { result } = renderHook(() => useLnurlLogin());
    act(() => {
      result.current.start();
    });
    await advance(0);

    act(() => {
      result.current.start();
    });
    await advance(0);
    await advance(2000);

    // Only the second interval is live, so exactly one poll per tick.
    expect(pollMock).toHaveBeenCalledTimes(1);
  });

  it('clears the interval on unmount', async () => {
    startMock.mockResolvedValue(challenge);
    pollMock.mockResolvedValue({ status: 'pending' });
    const clearIntervalSpy = vi.spyOn(globalThis, 'clearInterval');

    const { result, unmount } = renderHook(() => useLnurlLogin());
    act(() => {
      result.current.start();
    });
    await advance(0);

    unmount();
    expect(clearIntervalSpy).toHaveBeenCalled();

    await advance(4000);
    expect(pollMock).not.toHaveBeenCalled();
    clearIntervalSpy.mockRestore();
  });

  it('ignores a superseded start that resolves late', async () => {
    const first = deferred<StartChallenge>();
    const second: StartChallenge = { ...challenge, lnurl: 'lnurl1second', pollToken: 'p2' };
    startMock.mockReturnValueOnce(first.promise).mockResolvedValueOnce(second);
    pollMock.mockResolvedValue({ status: 'pending' });

    const { result } = renderHook(() => useLnurlLogin());
    act(() => {
      result.current.start(); // run 1 — stays pending
    });
    act(() => {
      result.current.start(); // run 2 — supersedes run 1
    });
    await advance(0);
    expect(result.current.lnurl).toBe('lnurl1second');

    // Run 1 resolves late; its run id no longer matches, so it is ignored.
    await act(async () => {
      first.resolve({ ...challenge, lnurl: 'lnurl1first', pollToken: 'p1' });
      await Promise.resolve();
    });
    expect(result.current.lnurl).toBe('lnurl1second');
  });

  it('ignores a superseded start that rejects late', async () => {
    const first = deferred<StartChallenge>();
    startMock.mockReturnValueOnce(first.promise).mockResolvedValueOnce(challenge);
    pollMock.mockResolvedValue({ status: 'pending' });

    const { result } = renderHook(() => useLnurlLogin());
    act(() => {
      result.current.start();
    });
    act(() => {
      result.current.start();
    });
    await advance(0);
    expect(result.current.status).toBe('waiting');

    await act(async () => {
      first.reject(new Error('late'));
      await Promise.resolve();
    });
    expect(result.current.status).toBe('waiting');
  });

  it('ignores an in-flight poll that resolves after teardown', async () => {
    startMock.mockResolvedValue(challenge);
    const poll = deferred<SessionResult>();
    pollMock.mockReturnValueOnce(poll.promise);

    const { result, unmount } = renderHook(() => useLnurlLogin());
    act(() => {
      result.current.start();
    });
    await advance(0);
    await advance(2000);
    expect(pollMock).toHaveBeenCalledTimes(1);

    unmount(); // effect cleanup sets cancelled + clears the interval
    await act(async () => {
      poll.resolve({ status: 'authenticated', token: 'x', account });
      await Promise.resolve();
    });
    // The cancelled guard means the late poll never records a session.
    expect(useAuthStore.getState().account).toBeNull();
  });

  it('ignores an in-flight poll that rejects after teardown', async () => {
    startMock.mockResolvedValue(challenge);
    const poll = deferred<SessionResult>();
    pollMock.mockReturnValueOnce(poll.promise);

    const { result, unmount } = renderHook(() => useLnurlLogin());
    act(() => {
      result.current.start();
    });
    await advance(0);
    await advance(2000);

    unmount();
    await act(async () => {
      poll.reject(new Error('late'));
      await Promise.resolve();
    });
    expect(pollMock).toHaveBeenCalledTimes(1);
  });
});
