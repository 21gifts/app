import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WALLET_HISTORY_PAGE, useWalletHistory } from '@/hooks/useWalletHistory';
import type { WalletPayment } from '@/lib/wallet/wallet-sdk';
import { listWalletPayments } from '@/lib/wallet/wallet-service';
import { useWalletStore } from '@/stores/wallet-store';

vi.mock('@/lib/wallet/wallet-service', () => ({
  listWalletPayments: vi.fn(),
}));

const originalHref = window.location.href;
const ORIGINAL_E2E_NOW = process.env.NEXT_PUBLIC_E2E_NOW;

function payments(count: number, start = 0): WalletPayment[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `p${start + index}`,
    direction: 'received' as const,
    amountSats: 100,
    timestamp: 1_000 - start - index,
    status: 'completed' as const,
    senderComment: null,
  }));
}

function deferred<T>(): {
  promise: Promise<T>;
  resolve: (v: T) => void;
  reject: (e: unknown) => void;
} {
  let resolve: (v: T) => void = () => undefined;
  let reject: (e: unknown) => void = () => undefined;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function setReady(): void {
  useWalletStore.getState().setReady(0, 'id');
}

beforeEach(() => {
  window.history.replaceState({}, '', '/wallet');
  delete process.env.NEXT_PUBLIC_E2E_NOW;
  useWalletStore.setState({ status: 'locked', balanceSats: null, identityPubkey: null });
  vi.mocked(listWalletPayments).mockReset().mockResolvedValue([]);
});

afterEach(() => {
  cleanup();
  window.history.replaceState({}, '', originalHref);
  if (ORIGINAL_E2E_NOW === undefined) {
    delete process.env.NEXT_PUBLIC_E2E_NOW;
  } else {
    process.env.NEXT_PUBLIC_E2E_NOW = ORIGINAL_E2E_NOW;
  }
});

describe('useWalletHistory', () => {
  it('does not load while the wallet is not ready', () => {
    const { result } = renderHook(() => useWalletHistory());
    expect(result.current.status).toBe('loading');
    expect(listWalletPayments).not.toHaveBeenCalled();
  });

  it('loads the first page newest first once ready', async () => {
    vi.mocked(listWalletPayments).mockResolvedValueOnce(payments(3));
    setReady();
    const { result } = renderHook(() => useWalletHistory());
    await waitFor(() => {
      expect(result.current.status).toBe('ready');
    });
    expect(listWalletPayments).toHaveBeenCalledWith({ offset: 0, limit: WALLET_HISTORY_PAGE });
    expect(result.current.payments.map((p) => p.id)).toEqual(['p0', 'p1', 'p2']);
    expect(result.current.hasMore).toBe(false);
  });

  it('shows an empty list', async () => {
    setReady();
    const { result } = renderHook(() => useWalletHistory());
    await waitFor(() => {
      expect(result.current.status).toBe('ready');
    });
    expect(result.current.payments).toEqual([]);
  });

  it('pages with offsets and skips ids it already has', async () => {
    vi.mocked(listWalletPayments)
      .mockResolvedValueOnce(payments(WALLET_HISTORY_PAGE))
      .mockResolvedValueOnce([...payments(1, WALLET_HISTORY_PAGE - 1), ...payments(2, 20)]);
    setReady();
    const { result } = renderHook(() => useWalletHistory());
    await waitFor(() => {
      expect(result.current.hasMore).toBe(true);
    });
    await act(async () => {
      result.current.loadMore();
      await Promise.resolve();
    });
    expect(listWalletPayments).toHaveBeenLastCalledWith({
      offset: WALLET_HISTORY_PAGE,
      limit: WALLET_HISTORY_PAGE,
    });
    expect(result.current.payments).toHaveLength(WALLET_HISTORY_PAGE + 2);
    expect(result.current.hasMore).toBe(false);
  });

  it('loadMore does nothing at the end of the list or while a load runs', async () => {
    const first = deferred<WalletPayment[]>();
    vi.mocked(listWalletPayments).mockReturnValueOnce(first.promise);
    setReady();
    const { result } = renderHook(() => useWalletHistory());
    act(() => {
      result.current.loadMore();
    });
    expect(listWalletPayments).toHaveBeenCalledTimes(1);
    await act(async () => {
      first.resolve(payments(2));
      await first.promise;
    });
    act(() => {
      result.current.loadMore();
    });
    expect(listWalletPayments).toHaveBeenCalledTimes(1);
  });

  it('stops paging quietly when a later page fails', async () => {
    vi.mocked(listWalletPayments)
      .mockResolvedValueOnce(payments(WALLET_HISTORY_PAGE))
      .mockRejectedValueOnce(new Error('down'));
    setReady();
    const { result } = renderHook(() => useWalletHistory());
    await waitFor(() => {
      expect(result.current.hasMore).toBe(true);
    });
    await act(async () => {
      result.current.loadMore();
      await Promise.resolve();
    });
    expect(result.current.status).toBe('ready');
    expect(result.current.hasMore).toBe(false);
    expect(result.current.payments).toHaveLength(WALLET_HISTORY_PAGE);
  });

  it('reloads every loaded page when the wallet syncs', async () => {
    vi.mocked(listWalletPayments)
      .mockResolvedValueOnce(payments(WALLET_HISTORY_PAGE))
      .mockResolvedValueOnce(payments(5, WALLET_HISTORY_PAGE))
      .mockResolvedValueOnce(payments(WALLET_HISTORY_PAGE + 6));
    setReady();
    const { result } = renderHook(() => useWalletHistory());
    await waitFor(() => {
      expect(result.current.hasMore).toBe(true);
    });
    await act(async () => {
      result.current.loadMore();
      await Promise.resolve();
    });
    expect(result.current.payments).toHaveLength(WALLET_HISTORY_PAGE + 5);
    act(() => {
      setReady();
    });
    await waitFor(() => {
      expect(result.current.payments).toHaveLength(WALLET_HISTORY_PAGE + 6);
    });
    expect(listWalletPayments).toHaveBeenLastCalledWith({
      offset: 0,
      limit: WALLET_HISTORY_PAGE + 5,
    });
    expect(result.current.hasMore).toBe(false);
  });

  it('only the latest load writes state', async () => {
    const stale = deferred<WalletPayment[]>();
    const staleMore = deferred<WalletPayment[]>();
    vi.mocked(listWalletPayments)
      .mockResolvedValueOnce(payments(WALLET_HISTORY_PAGE))
      .mockReturnValueOnce(staleMore.promise)
      .mockReturnValueOnce(stale.promise)
      .mockResolvedValueOnce(payments(1, 99));
    setReady();
    const { result } = renderHook(() => useWalletHistory());
    await waitFor(() => {
      expect(result.current.hasMore).toBe(true);
    });
    act(() => {
      result.current.loadMore();
    });
    act(() => {
      setReady();
    });
    act(() => {
      setReady();
    });
    await waitFor(() => {
      expect(result.current.payments.map((p) => p.id)).toEqual(['p99']);
    });
    await act(async () => {
      staleMore.resolve(payments(3, 50));
      stale.reject(new Error('late'));
      await Promise.allSettled([staleMore.promise, stale.promise]);
    });
    expect(result.current.payments.map((p) => p.id)).toEqual(['p99']);
    expect(result.current.status).toBe('ready');
  });

  it('a late successful reload does not overwrite a newer one', async () => {
    const late = deferred<WalletPayment[]>();
    vi.mocked(listWalletPayments)
      .mockReturnValueOnce(late.promise)
      .mockResolvedValueOnce(payments(1, 7));
    setReady();
    const { result } = renderHook(() => useWalletHistory());
    act(() => {
      setReady();
    });
    await waitFor(() => {
      expect(result.current.payments.map((p) => p.id)).toEqual(['p7']);
    });
    await act(async () => {
      late.resolve(payments(2, 40));
      await late.promise;
    });
    expect(result.current.payments.map((p) => p.id)).toEqual(['p7']);
  });

  it('a stale failed page does not stop paging', async () => {
    const staleMore = deferred<WalletPayment[]>();
    vi.mocked(listWalletPayments)
      .mockResolvedValueOnce(payments(WALLET_HISTORY_PAGE))
      .mockReturnValueOnce(staleMore.promise)
      .mockResolvedValueOnce(payments(WALLET_HISTORY_PAGE));
    setReady();
    const { result } = renderHook(() => useWalletHistory());
    await waitFor(() => {
      expect(result.current.hasMore).toBe(true);
    });
    act(() => {
      result.current.loadMore();
    });
    act(() => {
      setReady();
    });
    await waitFor(() => {
      expect(listWalletPayments).toHaveBeenCalledTimes(3);
    });
    await act(async () => {
      staleMore.reject(new Error('late'));
      await staleMore.promise.catch(() => undefined);
    });
    expect(result.current.hasMore).toBe(true);
  });

  it('shows an error and retry loads again', async () => {
    vi.mocked(listWalletPayments)
      .mockRejectedValueOnce(new Error('down'))
      .mockResolvedValueOnce(payments(1));
    setReady();
    const { result } = renderHook(() => useWalletHistory());
    await waitFor(() => {
      expect(result.current.status).toBe('error');
    });
    act(() => {
      result.current.retry();
    });
    expect(result.current.status).toBe('loading');
    await waitFor(() => {
      expect(result.current.status).toBe('ready');
    });
    expect(result.current.payments).toHaveLength(1);
  });

  it.each([
    ['history-empty', 'ready', 0],
    ['history-rows', 'ready', 4],
    ['history-error', 'error', 0],
  ] as const)('pins %s in a Playwright build', (visual, status, count) => {
    process.env.NEXT_PUBLIC_E2E_NOW = '2026-01-07T12:00:00.000Z';
    window.history.replaceState({}, '', `/wallet?visual=${visual}`);
    setReady();
    const { result } = renderHook(() => useWalletHistory());
    expect(result.current.status).toBe(status);
    expect(result.current.payments).toHaveLength(count);
    expect(result.current.hasMore).toBe(false);
    act(() => {
      result.current.loadMore();
      result.current.retry();
    });
    expect(listWalletPayments).not.toHaveBeenCalled();
  });

  it('the rows pin has a received note, a sent row, a pending row, and a failed row', () => {
    process.env.NEXT_PUBLIC_E2E_NOW = '2026-01-07T12:00:00.000Z';
    window.history.replaceState({}, '', '/wallet?visual=history-rows');
    const { result } = renderHook(() => useWalletHistory());
    const [first, second, third, fourth] = result.current.payments;
    expect(first).toMatchObject({
      direction: 'received',
      senderComment: 'Thank you for the coffee',
    });
    expect(first?.timestamp).toBe(Date.parse('2026-01-07T10:00:00.000Z'));
    expect(second).toMatchObject({ direction: 'sent', status: 'completed' });
    expect(third).toMatchObject({ direction: 'received', status: 'pending' });
    expect(fourth).toMatchObject({ direction: 'sent', status: 'failed' });
  });

  it('ignores pins outside a Playwright build and unrelated values', async () => {
    window.history.replaceState({}, '', '/wallet?visual=history-rows');
    const { result } = renderHook(() => useWalletHistory());
    expect(result.current.status).toBe('loading');
    process.env.NEXT_PUBLIC_E2E_NOW = '2026-01-07T12:00:00.000Z';
    window.history.replaceState({}, '', '/wallet?visual=other');
    const second = renderHook(() => useWalletHistory());
    expect(second.result.current.status).toBe('loading');
  });
});
