import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useIncomingPayment } from '@/hooks/useIncomingPayment';
import type { WalletPayment } from '@/lib/wallet/wallet-sdk';
import { onIncomingPayment } from '@/lib/wallet/wallet-service';
import { useAuthStore } from '@/stores/auth-store';

vi.mock('@/lib/wallet/wallet-service', () => ({ onIncomingPayment: vi.fn() }));

const originalHref = window.location.href;
const ORIGINAL_E2E_NOW = process.env.NEXT_PUBLIC_E2E_NOW;

let emit: (payment: WalletPayment) => void = () => undefined;
const unsubscribe = vi.fn();

function payment(id: string): WalletPayment {
  return {
    id,
    direction: 'received',
    amountSats: 500,
    feesSats: 0,
    timestamp: 1,
    status: 'completed',
    method: 'lightning',
    senderComment: null,
    info: {},
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  useAuthStore.setState({ session: 'session-a' });
  unsubscribe.mockReset();
  vi.mocked(onIncomingPayment)
    .mockReset()
    .mockImplementation((listener) => {
      emit = listener;
      return unsubscribe;
    });
});

afterEach(() => {
  cleanup();
  useAuthStore.setState({ session: null });
  vi.useRealTimers();
  window.history.replaceState({}, '', originalHref);
  if (ORIGINAL_E2E_NOW === undefined) delete process.env.NEXT_PUBLIC_E2E_NOW;
  else process.env.NEXT_PUBLIC_E2E_NOW = ORIGINAL_E2E_NOW;
});

describe('useIncomingPayment', () => {
  it('shows a payment for the hold time, and a newer one replaces it and restarts the time', () => {
    const { result } = renderHook(() => useIncomingPayment(1000));
    expect(result.current.payment).toBeNull();
    act(() => {
      emit(payment('a'));
    });
    expect(result.current.payment?.id).toBe('a');
    act(() => {
      vi.advanceTimersByTime(800);
      emit(payment('b'));
    });
    expect(result.current.payment?.id).toBe('b');
    act(() => {
      vi.advanceTimersByTime(800);
    });
    expect(result.current.payment?.id).toBe('b');
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(result.current.payment).toBeNull();
  });

  it('keeps the running timer when the hold time changes, and uses the new one for the next payment', () => {
    const { result, rerender } = renderHook(({ hold }) => useIncomingPayment(hold), {
      initialProps: { hold: 1000 },
    });
    act(() => {
      emit(payment('a'));
    });
    rerender({ hold: 5000 });
    expect(onIncomingPayment).toHaveBeenCalledTimes(1);
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(result.current.payment).toBeNull();
    act(() => {
      emit(payment('b'));
    });
    act(() => {
      vi.advanceTimersByTime(4999);
    });
    expect(result.current.payment?.id).toBe('b');
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current.payment).toBeNull();
  });

  it('never shows a payment after its session ended or under the next one, and listens only while signed in', () => {
    const { result } = renderHook(() => useIncomingPayment(1000));
    act(() => {
      emit(payment('a'));
    });
    expect(result.current.payment?.id).toBe('a');
    act(() => {
      useAuthStore.setState({ session: 'session-b' });
    });
    expect(result.current.payment).toBeNull();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
    expect(onIncomingPayment).toHaveBeenCalledTimes(2);
    act(() => {
      emit(payment('b'));
    });
    expect(result.current.payment?.id).toBe('b');
    act(() => {
      useAuthStore.setState({ session: null });
    });
    expect(result.current.payment).toBeNull();
    expect(unsubscribe).toHaveBeenCalledTimes(2);
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(onIncomingPayment).toHaveBeenCalledTimes(2);
    expect(result.current.payment).toBeNull();
  });

  it('dismisses early and unsubscribes on unmount', () => {
    const { result, unmount } = renderHook(() => useIncomingPayment(1000));
    act(() => {
      emit(payment('a'));
    });
    act(() => {
      result.current.dismiss();
    });
    expect(result.current.payment).toBeNull();
    unmount();
    expect(unsubscribe).toHaveBeenCalled();
  });

  it('shows the fixed ₿500 payment under the wallet-received pin in a Playwright build, without a timer', () => {
    process.env.NEXT_PUBLIC_E2E_NOW = '2026-01-07T12:00:00.000Z';
    window.history.replaceState({}, '', '/wallet?visual=wallet-received');
    const { result } = renderHook(() => useIncomingPayment(1000));
    expect(result.current.payment).toMatchObject({
      amountSats: 500,
      direction: 'received',
    });
    expect(onIncomingPayment).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(result.current.payment).not.toBeNull();
    act(() => {
      result.current.dismiss();
    });
    expect(result.current.payment).toBeNull();
  });

  it('ignores the wallet-received pin in a production build', () => {
    delete process.env.NEXT_PUBLIC_E2E_NOW;
    window.history.replaceState({}, '', '/wallet?visual=wallet-received');
    const { result } = renderHook(() => useIncomingPayment(1000));
    expect(result.current.payment).toBeNull();
    expect(onIncomingPayment).toHaveBeenCalled();
  });
});
