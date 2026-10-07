import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useWalletPayment } from '@/hooks/useWalletPayment';
import { WALLET_PAYMENT_FIXTURES } from '@/lib/wallet/payment-fixtures';
import { toWalletPayment, type WalletPayment } from '@/lib/wallet/wallet-sdk';
import { getWalletPayment } from '@/lib/wallet/wallet-service';
import { useWalletStore } from '@/stores/wallet-store';

vi.mock('@/lib/wallet/wallet-service', () => ({ getWalletPayment: vi.fn() }));

const ORIGINAL_E2E_NOW = process.env.NEXT_PUBLIC_E2E_NOW;

const PAYMENT = { id: 'p1', status: 'pending' } as WalletPayment;

beforeEach(() => {
  delete process.env.NEXT_PUBLIC_E2E_NOW;
  window.history.replaceState({}, '', '/wallet/payment?id=p1');
  vi.mocked(getWalletPayment).mockReset();
  useWalletStore.setState({ status: 'ready', syncCount: 0 });
});

afterEach(() => {
  cleanup();
  useWalletStore.getState().reset();
  if (ORIGINAL_E2E_NOW === undefined) {
    delete process.env.NEXT_PUBLIC_E2E_NOW;
  } else {
    process.env.NEXT_PUBLIC_E2E_NOW = ORIGINAL_E2E_NOW;
  }
});

describe('useWalletPayment', () => {
  it('reads the payment once the wallet is ready, and again after each sync', async () => {
    useWalletStore.setState({ status: 'connecting' });
    vi.mocked(getWalletPayment).mockResolvedValue(PAYMENT);
    const { result } = renderHook(() => useWalletPayment('p1'));
    expect(result.current).toEqual({ status: 'loading' });
    expect(getWalletPayment).not.toHaveBeenCalled();
    act(() => {
      useWalletStore.setState({ status: 'ready' });
    });
    await waitFor(() => {
      expect(result.current).toEqual({ status: 'ready', payment: PAYMENT });
    });
    const settled = { ...PAYMENT, status: 'completed' } as WalletPayment;
    vi.mocked(getWalletPayment).mockResolvedValue(settled);
    act(() => {
      useWalletStore.setState({ syncCount: 1 });
    });
    await waitFor(() => {
      expect(result.current).toEqual({ status: 'ready', payment: settled });
    });
    expect(getWalletPayment).toHaveBeenCalledTimes(2);
  });

  it('is missing without an id or for a payment the wallet does not know, and keeps a shown payment on a later failure', async () => {
    expect(renderHook(() => useWalletPayment(null)).result.current).toEqual({ status: 'missing' });
    vi.mocked(getWalletPayment).mockRejectedValueOnce(new Error('unknown'));
    const unknown = renderHook(() => useWalletPayment('nope'));
    await waitFor(() => {
      expect(unknown.result.current).toEqual({ status: 'missing' });
    });
    unknown.unmount();
    vi.mocked(getWalletPayment).mockResolvedValueOnce(PAYMENT);
    const shown = renderHook(() => useWalletPayment('p1'));
    await waitFor(() => {
      expect(shown.result.current.status).toBe('ready');
    });
    vi.mocked(getWalletPayment).mockRejectedValueOnce(new Error('offline'));
    act(() => {
      useWalletStore.setState({ syncCount: 5 });
    });
    await waitFor(() => {
      expect(getWalletPayment).toHaveBeenCalledTimes(3);
    });
    expect(shown.result.current).toEqual({ status: 'ready', payment: PAYMENT });
  });

  it('drops an answer that arrives after unmount', async () => {
    let finish: (value: WalletPayment) => void = () => undefined;
    let fail: (reason: Error) => void = () => undefined;
    vi.mocked(getWalletPayment)
      .mockReturnValueOnce(
        new Promise((resolve) => {
          finish = resolve;
        }),
      )
      .mockReturnValueOnce(
        new Promise((_resolve, reject) => {
          fail = reject;
        }),
      );
    const first = renderHook(() => useWalletPayment('p1'));
    first.unmount();
    const second = renderHook(() => useWalletPayment('p2'));
    second.unmount();
    await act(async () => {
      finish(PAYMENT);
      fail(new Error('late'));
    });
    expect(first.result.current).toEqual({ status: 'loading' });
    expect(second.result.current).toEqual({ status: 'loading' });
  });

  it('shows the fixture payment under the rows pin in a Playwright build only', () => {
    process.env.NEXT_PUBLIC_E2E_NOW = '2026-01-07T12:00:00.000Z';
    window.history.replaceState({}, '', '/wallet/payment?visual=history-rows');
    const fixture = WALLET_PAYMENT_FIXTURES[3]!;
    expect(renderHook(() => useWalletPayment(fixture.id)).result.current).toEqual({
      status: 'ready',
      payment: toWalletPayment(fixture),
    });
    expect(renderHook(() => useWalletPayment('nope')).result.current).toEqual({
      status: 'missing',
    });
    expect(getWalletPayment).not.toHaveBeenCalled();
    delete process.env.NEXT_PUBLIC_E2E_NOW;
    vi.mocked(getWalletPayment).mockReturnValue(new Promise(() => undefined));
    expect(renderHook(() => useWalletPayment(fixture.id)).result.current).toEqual({
      status: 'loading',
    });
  });

  it('starts over for another id and never shows the previous payment under it', async () => {
    vi.mocked(getWalletPayment).mockResolvedValueOnce(PAYMENT);
    const { result, rerender } = renderHook(({ id }) => useWalletPayment(id), {
      initialProps: { id: 'p1' },
    });
    await waitFor(() => {
      expect(result.current).toEqual({ status: 'ready', payment: PAYMENT });
    });
    vi.mocked(getWalletPayment).mockRejectedValueOnce(new Error('unknown'));
    rerender({ id: 'p2' });
    expect(result.current).toEqual({ status: 'loading' });
    await waitFor(() => {
      expect(result.current).toEqual({ status: 'missing' });
    });
    const other = { id: 'p3', status: 'completed' } as WalletPayment;
    vi.mocked(getWalletPayment).mockResolvedValueOnce(other);
    rerender({ id: 'p3' });
    await waitFor(() => {
      expect(result.current).toEqual({ status: 'ready', payment: other });
    });
  });

  it('drops a loaded payment back to loading when the wallet stops being ready', async () => {
    vi.mocked(getWalletPayment).mockResolvedValue(PAYMENT);
    const { result } = renderHook(() => useWalletPayment('p1'));
    await waitFor(() => {
      expect(result.current.status).toBe('ready');
    });
    act(() => {
      useWalletStore.setState({ status: 'locked' });
    });
    expect(result.current).toEqual({ status: 'loading' });
  });
});
