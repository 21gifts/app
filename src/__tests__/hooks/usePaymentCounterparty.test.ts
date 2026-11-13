import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useActiveSession } from '@/hooks/useActiveSession';
import { usePaymentCounterparty } from '@/hooks/usePaymentCounterparty';
import { fetchPaymentCounterparties } from '@/lib/wallet/payment-counterparty';
import { reportWallet, walletReportSettled } from '@/lib/wallet/wallet-report';
import { useWalletStore } from '@/stores/wallet-store';
import {
  RECEIVED_FROM_MEMBER_PAYMENT,
  RECEIVED_FROM_MEMBER_SENDER,
  SENT_TO_MEMBER_PAYMENT,
  SENT_TO_MEMBER_COUNTERPARTY,
  toFixturePayment,
} from '@/lib/wallet/payment-fixtures';

vi.mock('@/hooks/useActiveSession', () => ({ useActiveSession: vi.fn() }));
vi.mock('@/lib/wallet/payment-counterparty', () => ({ fetchPaymentCounterparties: vi.fn() }));
vi.mock('@/lib/wallet/wallet-report', () => ({
  reportWallet: vi.fn(),
  walletReportSettled: vi.fn(),
}));
const payment = toFixturePayment(RECEIVED_FROM_MEMBER_PAYMENT);
const sent = toFixturePayment(SENT_TO_MEMBER_PAYMENT);
const originalUrl = window.location.href;
const originalNow = process.env.NEXT_PUBLIC_E2E_NOW;

beforeEach(() => {
  delete process.env.NEXT_PUBLIC_E2E_NOW;
  window.history.replaceState({}, '', '/wallet');
  vi.mocked(useActiveSession).mockReturnValue('session');
  vi.mocked(fetchPaymentCounterparties).mockReset().mockResolvedValue([]);
  vi.mocked(reportWallet).mockReset().mockResolvedValue(undefined);
  vi.mocked(walletReportSettled).mockReset().mockResolvedValue(undefined);
  useWalletStore.setState({ syncCount: 0 });
});
afterEach(() => {
  cleanup();
  window.history.replaceState({}, '', originalUrl);
  if (originalNow === undefined) delete process.env.NEXT_PUBLIC_E2E_NOW;
  else process.env.NEXT_PUBLIC_E2E_NOW = originalNow;
});

describe('usePaymentCounterparty', () => {
  it('waits for a running report before the first lookup without requesting a report', async () => {
    let finishReport!: () => void;
    vi.mocked(walletReportSettled).mockReturnValue(
      new Promise<void>((resolve) => {
        finishReport = resolve;
      }),
    );
    renderHook(() => usePaymentCounterparty(payment));
    expect(walletReportSettled).toHaveBeenCalledTimes(1);
    expect(fetchPaymentCounterparties).not.toHaveBeenCalled();
    expect(reportWallet).not.toHaveBeenCalled();
    await act(async () => {
      finishReport();
    });
    expect(fetchPaymentCounterparties).toHaveBeenCalledWith('session', [
      { id: payment.id, direction: 'in' },
    ]);
    expect(reportWallet).not.toHaveBeenCalled();
  });
  it('does not fetch when unmounted while waiting for the first report', async () => {
    let finishReport!: () => void;
    vi.mocked(walletReportSettled).mockReturnValue(
      new Promise<void>((resolve) => {
        finishReport = resolve;
      }),
    );
    const hook = renderHook(() => usePaymentCounterparty(payment));
    hook.unmount();
    await act(async () => {
      finishReport();
    });
    expect(fetchPaymentCounterparties).not.toHaveBeenCalled();
    expect(reportWallet).not.toHaveBeenCalled();
  });
  it.each([
    [payment, 'in'],
    [sent, 'out'],
  ] as const)('requests the correct direction', async (entry, direction) => {
    renderHook(() => usePaymentCounterparty(entry));
    await waitFor(() =>
      expect(fetchPaymentCounterparties).toHaveBeenCalledWith('session', [
        { id: entry.id, direction },
      ]),
    );
  });
  it('looks up a completed payment without invoice or hash', async () => {
    renderHook(() => usePaymentCounterparty({ ...payment, info: {} }));
    await waitFor(() =>
      expect(fetchPaymentCounterparties).toHaveBeenCalledWith('session', [
        { id: payment.id, direction: 'in' },
      ]),
    );
  });
  it.each([
    { ...payment, status: 'pending' as const },
    { ...payment, status: 'failed' as const },
  ])('does not fetch ineligible payments', (entry) => {
    expect(renderHook(() => usePaymentCounterparty(entry)).result.current).toBeNull();
    expect(fetchPaymentCounterparties).not.toHaveBeenCalled();
  });
  it('does not fetch without a session', () => {
    vi.mocked(useActiveSession).mockReturnValue(null);
    expect(renderHook(() => usePaymentCounterparty(payment)).result.current).toBeNull();
    expect(fetchPaymentCounterparties).not.toHaveBeenCalled();
  });
  it('caches a match', async () => {
    const rows = [RECEIVED_FROM_MEMBER_SENDER];
    vi.mocked(fetchPaymentCounterparties).mockResolvedValue(rows);
    const { result, rerender } = renderHook(
      ({ completed }: { completed: boolean }) =>
        usePaymentCounterparty({ ...payment, status: completed ? 'completed' : 'pending' }),
      { initialProps: { completed: true } },
    );
    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current).toEqual(rows[0] ?? null);
    rerender({ completed: false });
    rerender({ completed: true });
    expect(result.current).toEqual(rows[0] ?? null);
    expect(fetchPaymentCounterparties).toHaveBeenCalledTimes(1);
  });
  it('waits for the report before retrying a miss on sync and stops after a match', async () => {
    let finishReport!: () => void;
    vi.mocked(reportWallet).mockReturnValue(
      new Promise<void>((resolve) => {
        finishReport = resolve;
      }),
    );
    vi.mocked(fetchPaymentCounterparties)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([RECEIVED_FROM_MEMBER_SENDER]);
    const { result, rerender } = renderHook(() => usePaymentCounterparty(payment));
    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current).toBeNull();
    rerender();
    expect(fetchPaymentCounterparties).toHaveBeenCalledTimes(1);
    expect(reportWallet).not.toHaveBeenCalled();
    act(() => useWalletStore.setState({ syncCount: 1 }));
    expect(reportWallet).toHaveBeenCalledTimes(1);
    expect(fetchPaymentCounterparties).toHaveBeenCalledTimes(1);
    await act(async () => {
      finishReport();
    });
    await waitFor(() => expect(result.current).toEqual(RECEIVED_FROM_MEMBER_SENDER));
    expect(fetchPaymentCounterparties).toHaveBeenCalledTimes(2);
    act(() => useWalletStore.setState({ syncCount: 2 }));
    expect(fetchPaymentCounterparties).toHaveBeenCalledTimes(2);
    expect(reportWallet).toHaveBeenCalledTimes(1);
  });
  it('waits for a sync during a pending payment before the first lookup', async () => {
    let finishReport!: () => void;
    vi.mocked(reportWallet).mockReturnValue(
      new Promise<void>((resolve) => {
        finishReport = resolve;
      }),
    );
    const { rerender } = renderHook(
      ({ completed }: { completed: boolean }) =>
        usePaymentCounterparty({ ...payment, status: completed ? 'completed' : 'pending' }),
      { initialProps: { completed: false } },
    );
    act(() => useWalletStore.setState({ syncCount: 1 }));
    expect(reportWallet).not.toHaveBeenCalled();
    expect(fetchPaymentCounterparties).not.toHaveBeenCalled();
    rerender({ completed: true });
    expect(reportWallet).toHaveBeenCalledTimes(1);
    expect(fetchPaymentCounterparties).not.toHaveBeenCalled();
    await act(async () => {
      finishReport();
    });
    expect(fetchPaymentCounterparties).toHaveBeenCalledWith('session', [
      { id: payment.id, direction: 'in' },
    ]);
  });
  it('does not fetch after a pending report is invalidated', async () => {
    let finishReport!: () => void;
    vi.mocked(reportWallet).mockReturnValue(
      new Promise<void>((resolve) => {
        finishReport = resolve;
      }),
    );
    const hook = renderHook(() => usePaymentCounterparty(payment));
    await act(async () => {
      await Promise.resolve();
    });
    act(() => useWalletStore.setState({ syncCount: 1 }));
    hook.unmount();
    await act(async () => {
      finishReport();
    });
    expect(fetchPaymentCounterparties).toHaveBeenCalledTimes(1);
  });
  it('keeps the cached result when invoice and hash change', async () => {
    vi.mocked(fetchPaymentCounterparties).mockResolvedValue([RECEIVED_FROM_MEMBER_SENDER]);
    const { result, rerender } = renderHook(
      ({ withDetails }: { withDetails: boolean }) =>
        usePaymentCounterparty({
          ...payment,
          info: withDetails ? { invoice: 'spark1example', paymentHash: 'hash' } : {},
        }),
      { initialProps: { withDetails: false } },
    );
    await waitFor(() => expect(result.current).toEqual(RECEIVED_FROM_MEMBER_SENDER));
    rerender({ withDetails: true });
    expect(result.current).toEqual(RECEIVED_FROM_MEMBER_SENDER);
    expect(fetchPaymentCounterparties).toHaveBeenCalledTimes(1);
  });
  it('ignores foreign ids and clears the cache on session change', async () => {
    vi.mocked(fetchPaymentCounterparties)
      .mockResolvedValueOnce([{ ...RECEIVED_FROM_MEMBER_SENDER, id: 'other' }])
      .mockResolvedValueOnce([RECEIVED_FROM_MEMBER_SENDER]);
    const { result, rerender } = renderHook(() => usePaymentCounterparty(payment));
    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current).toBeNull();
    vi.mocked(useActiveSession).mockReturnValue('other');
    rerender();
    await waitFor(() => expect(result.current).toEqual(RECEIVED_FROM_MEMBER_SENDER));
    expect(fetchPaymentCounterparties).toHaveBeenCalledTimes(2);
  });
  it('ignores a response after unmount', async () => {
    let resolve!: (rows: (typeof RECEIVED_FROM_MEMBER_SENDER)[]) => void;
    vi.mocked(fetchPaymentCounterparties).mockReturnValue(
      new Promise((done) => {
        resolve = done;
      }),
    );
    const hook = renderHook(() => usePaymentCounterparty(payment));
    await waitFor(() => expect(fetchPaymentCounterparties).toHaveBeenCalledTimes(1));
    hook.unmount();
    await act(async () => {
      resolve([RECEIVED_FROM_MEMBER_SENDER]);
    });
    expect(hook.result.current).toBeNull();
  });
  it('ignores a late response from the previous session and does not cache it', async () => {
    let resolveA!: (rows: (typeof RECEIVED_FROM_MEMBER_SENDER)[]) => void;
    let resolveB!: (rows: (typeof RECEIVED_FROM_MEMBER_SENDER)[]) => void;
    let resolveRetry!: (rows: (typeof RECEIVED_FROM_MEMBER_SENDER)[]) => void;
    vi.mocked(fetchPaymentCounterparties)
      .mockReturnValueOnce(
        new Promise((done) => {
          resolveA = done;
        }),
      )
      .mockReturnValueOnce(
        new Promise((done) => {
          resolveB = done;
        }),
      )
      .mockReturnValueOnce(
        new Promise((done) => {
          resolveRetry = done;
        }),
      );
    const { result, rerender } = renderHook(
      ({ completed }: { completed: boolean }) =>
        usePaymentCounterparty({ ...payment, status: completed ? 'completed' : 'pending' }),
      { initialProps: { completed: true } },
    );
    await waitFor(() => expect(fetchPaymentCounterparties).toHaveBeenCalledTimes(1));
    expect(fetchPaymentCounterparties).toHaveBeenCalledWith('session', [
      { id: payment.id, direction: 'in' },
    ]);
    vi.mocked(useActiveSession).mockReturnValue('other');
    rerender({ completed: true });
    await waitFor(() => expect(fetchPaymentCounterparties).toHaveBeenCalledTimes(2));
    expect(fetchPaymentCounterparties).toHaveBeenCalledWith('other', [
      { id: payment.id, direction: 'in' },
    ]);
    await act(async () => {
      resolveA([RECEIVED_FROM_MEMBER_SENDER]);
    });
    expect(result.current).toBeNull();
    rerender({ completed: false });
    rerender({ completed: true });
    expect(result.current).toBeNull();
    await waitFor(() => expect(fetchPaymentCounterparties).toHaveBeenCalledTimes(3));
    await act(async () => {
      resolveB([]);
      resolveRetry([]);
    });
    expect(result.current).toBeNull();
    rerender({ completed: false });
    rerender({ completed: true });
    expect(result.current).toBeNull();
  });
  it.each([
    ['received-from-member', payment, RECEIVED_FROM_MEMBER_SENDER],
    ['sent-to-member', sent, SENT_TO_MEMBER_COUNTERPARTY],
  ] as const)('honours %s only in Playwright builds', async (pin, entry, match) => {
    window.history.replaceState({}, '', `/wallet?visual=${pin}`);
    const production = renderHook(() => usePaymentCounterparty(entry));
    await waitFor(() => expect(fetchPaymentCounterparties).toHaveBeenCalled());
    expect(production.result.current).toBeNull();
    production.unmount();
    vi.mocked(fetchPaymentCounterparties).mockClear();
    process.env.NEXT_PUBLIC_E2E_NOW = '2026-01-07T12:00:00.000Z';
    expect(renderHook(() => usePaymentCounterparty(entry)).result.current).toEqual(match);
    expect(fetchPaymentCounterparties).not.toHaveBeenCalled();
  });
  it.each([
    ['received-member-unknown', payment],
    ['sent-member-unknown', sent],
  ] as const)(
    'returns null for %s without a lookup, and a production build ignores it',
    async (pin, entry) => {
      window.history.replaceState({}, '', `/wallet?visual=${pin}`);
      const production = renderHook(() => usePaymentCounterparty(entry));
      await waitFor(() => expect(fetchPaymentCounterparties).toHaveBeenCalled());
      expect(production.result.current).toBeNull();
      production.unmount();
      vi.mocked(fetchPaymentCounterparties).mockClear();
      process.env.NEXT_PUBLIC_E2E_NOW = '2026-01-07T12:00:00.000Z';
      expect(renderHook(() => usePaymentCounterparty(entry)).result.current).toBeNull();
      expect(fetchPaymentCounterparties).not.toHaveBeenCalled();
    },
  );
});
