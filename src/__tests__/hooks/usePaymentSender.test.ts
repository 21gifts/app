import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useActiveSession } from '@/hooks/useActiveSession';
import { usePaymentSender } from '@/hooks/usePaymentSender';
import { fetchPaymentSenders } from '@/lib/wallet/payment-sender';
import {
  RECEIVED_FROM_MEMBER_PAYMENT,
  RECEIVED_FROM_MEMBER_SENDER,
  toFixturePayment,
} from '@/lib/wallet/payment-fixtures';

vi.mock('@/hooks/useActiveSession', () => ({ useActiveSession: vi.fn() }));
vi.mock('@/lib/wallet/payment-sender', () => ({ fetchPaymentSenders: vi.fn() }));
const payment = toFixturePayment(RECEIVED_FROM_MEMBER_PAYMENT);
const originalUrl = window.location.href;
const originalNow = process.env.NEXT_PUBLIC_E2E_NOW;

beforeEach(() => {
  delete process.env.NEXT_PUBLIC_E2E_NOW;
  window.history.replaceState({}, '', '/wallet');
  vi.mocked(useActiveSession).mockReturnValue('session');
  vi.mocked(fetchPaymentSenders).mockReset().mockResolvedValue([]);
});
afterEach(() => {
  cleanup();
  window.history.replaceState({}, '', originalUrl);
  if (originalNow === undefined) delete process.env.NEXT_PUBLIC_E2E_NOW;
  else process.env.NEXT_PUBLIC_E2E_NOW = originalNow;
});

describe('usePaymentSender', () => {
  it('resolves a matching sender and ignores another payment id', async () => {
    vi.mocked(fetchPaymentSenders).mockResolvedValue([
      { ...RECEIVED_FROM_MEMBER_SENDER, id: 'other' },
      RECEIVED_FROM_MEMBER_SENDER,
    ]);
    const { result } = renderHook(() => usePaymentSender(payment));
    await waitFor(() => expect(result.current).toEqual(RECEIVED_FROM_MEMBER_SENDER));
    expect(fetchPaymentSenders).toHaveBeenCalledWith('session', [
      { id: payment.id, invoice: payment.info.invoice, paymentHash: null },
    ]);
  });
  it('ignores a foreign payment id', async () => {
    vi.mocked(fetchPaymentSenders).mockResolvedValue([
      { ...RECEIVED_FROM_MEMBER_SENDER, id: 'other' },
    ]);
    const first = renderHook(() => usePaymentSender(payment));
    await waitFor(() => expect(fetchPaymentSenders).toHaveBeenCalled());
    expect(first.result.current).toBeNull();
  });
  it.each([
    { ...payment, direction: 'sent' as const },
    { ...payment, status: 'pending' as const },
    { ...payment, status: 'failed' as const },
    { ...payment, info: {} },
  ])('does not request an ineligible payment', (value) => {
    expect(renderHook(() => usePaymentSender(value)).result.current).toBeNull();
    expect(fetchPaymentSenders).not.toHaveBeenCalled();
  });

  it('does not request a sender without an active session', () => {
    vi.mocked(useActiveSession).mockReturnValue(null);
    expect(renderHook(() => usePaymentSender(payment)).result.current).toBeNull();
    expect(fetchPaymentSenders).not.toHaveBeenCalled();
  });

  it('uses the cached sender when the same payment becomes eligible again', async () => {
    vi.mocked(fetchPaymentSenders).mockResolvedValue([RECEIVED_FROM_MEMBER_SENDER]);
    const { result, rerender } = renderHook(
      ({ completed }: { completed: boolean }) =>
        usePaymentSender({ ...payment, status: completed ? 'completed' : 'pending' }),
      { initialProps: { completed: true } },
    );
    await waitFor(() => expect(result.current).toEqual(RECEIVED_FROM_MEMBER_SENDER));
    rerender({ completed: false });
    expect(result.current).toBeNull();
    rerender({ completed: true });
    await waitFor(() => expect(result.current).toEqual(RECEIVED_FROM_MEMBER_SENDER));
    expect(fetchPaymentSenders).toHaveBeenCalledTimes(1);
  });

  it('uses a cached non-match when the same payment becomes eligible again', async () => {
    const { result, rerender } = renderHook(
      ({ completed }: { completed: boolean }) =>
        usePaymentSender({ ...payment, status: completed ? 'completed' : 'pending' }),
      { initialProps: { completed: true } },
    );
    await act(async () => {
      await Promise.resolve();
    });
    expect(fetchPaymentSenders).toHaveBeenCalledTimes(1);
    expect(result.current).toBeNull();
    rerender({ completed: false });
    rerender({ completed: true });
    expect(result.current).toBeNull();
    expect(fetchPaymentSenders).toHaveBeenCalledTimes(1);
  });

  it('clears the cache when the session changes', async () => {
    vi.mocked(fetchPaymentSenders)
      .mockResolvedValueOnce([RECEIVED_FROM_MEMBER_SENDER])
      .mockResolvedValueOnce([]);
    const { result, rerender } = renderHook(() => usePaymentSender(payment));
    await waitFor(() => expect(result.current).toEqual(RECEIVED_FROM_MEMBER_SENDER));
    vi.mocked(useActiveSession).mockReturnValue('other-session');
    rerender();
    expect(result.current).toBeNull();
    await waitFor(() => expect(fetchPaymentSenders).toHaveBeenCalledTimes(2));
    expect(fetchPaymentSenders).toHaveBeenLastCalledWith('other-session', [
      { id: payment.id, invoice: payment.info.invoice, paymentHash: null },
    ]);
    expect(result.current).toBeNull();
  });

  it('discards a response after unmount', async () => {
    let resolve!: (value: (typeof RECEIVED_FROM_MEMBER_SENDER)[]) => void;
    vi.mocked(fetchPaymentSenders).mockReturnValue(
      new Promise((finish) => {
        resolve = finish;
      }),
    );
    const first = renderHook(() => usePaymentSender(payment));
    expect(fetchPaymentSenders).toHaveBeenCalledTimes(1);
    first.unmount();
    await act(async () => {
      resolve([RECEIVED_FROM_MEMBER_SENDER]);
    });
    vi.mocked(fetchPaymentSenders).mockResolvedValue([]);
    const second = renderHook(() => usePaymentSender(payment));
    await waitFor(() => expect(fetchPaymentSenders).toHaveBeenCalledTimes(2));
    expect(second.result.current).toBeNull();
  });

  it('uses the fixture only in a Playwright build', async () => {
    window.history.replaceState({}, '', '/wallet?visual=received-from-member');
    const production = renderHook(() => usePaymentSender(payment));
    await waitFor(() => expect(fetchPaymentSenders).toHaveBeenCalled());
    expect(production.result.current).toBeNull();
    production.unmount();
    vi.mocked(fetchPaymentSenders).mockClear();
    process.env.NEXT_PUBLIC_E2E_NOW = '2026-01-07T12:00:00.000Z';
    expect(renderHook(() => usePaymentSender(payment)).result.current).toEqual(
      RECEIVED_FROM_MEMBER_SENDER,
    );
    expect(fetchPaymentSenders).not.toHaveBeenCalled();
  });
});
