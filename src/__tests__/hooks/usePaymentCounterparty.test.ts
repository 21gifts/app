import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useActiveSession } from '@/hooks/useActiveSession';
import { usePaymentCounterparty } from '@/hooks/usePaymentCounterparty';
import { fetchPaymentCounterparties } from '@/lib/wallet/payment-counterparty';
import {
  RECEIVED_FROM_MEMBER_PAYMENT,
  RECEIVED_FROM_MEMBER_SENDER,
  SENT_TO_MEMBER_PAYMENT,
  SENT_TO_MEMBER_COUNTERPARTY,
  toFixturePayment,
} from '@/lib/wallet/payment-fixtures';

vi.mock('@/hooks/useActiveSession', () => ({ useActiveSession: vi.fn() }));
vi.mock('@/lib/wallet/payment-counterparty', () => ({ fetchPaymentCounterparties: vi.fn() }));
const payment = toFixturePayment(RECEIVED_FROM_MEMBER_PAYMENT);
const sent = toFixturePayment(SENT_TO_MEMBER_PAYMENT);
const originalUrl = window.location.href;
const originalNow = process.env.NEXT_PUBLIC_E2E_NOW;

beforeEach(() => {
  delete process.env.NEXT_PUBLIC_E2E_NOW;
  window.history.replaceState({}, '', '/wallet');
  vi.mocked(useActiveSession).mockReturnValue('session');
  vi.mocked(fetchPaymentCounterparties).mockReset().mockResolvedValue([]);
});
afterEach(() => {
  cleanup();
  window.history.replaceState({}, '', originalUrl);
  if (originalNow === undefined) delete process.env.NEXT_PUBLIC_E2E_NOW;
  else process.env.NEXT_PUBLIC_E2E_NOW = originalNow;
});

describe('usePaymentCounterparty', () => {
  it.each([
    [payment, 'in'],
    [sent, 'out'],
  ] as const)('requests the correct direction', async (entry, direction) => {
    renderHook(() => usePaymentCounterparty(entry));
    await waitFor(() =>
      expect(fetchPaymentCounterparties).toHaveBeenCalledWith('session', [
        { id: entry.id, direction, invoice: entry.info.invoice, paymentHash: null },
      ]),
    );
  });
  it('looks up a payment by hash without an invoice', async () => {
    const hash = 'a'.repeat(64);
    renderHook(() => usePaymentCounterparty({ ...payment, info: { paymentHash: hash } }));
    await waitFor(() =>
      expect(fetchPaymentCounterparties).toHaveBeenCalledWith('session', [
        { id: payment.id, direction: 'in', invoice: null, paymentHash: hash },
      ]),
    );
  });
  it.each([
    { ...payment, status: 'pending' as const },
    { ...payment, status: 'failed' as const },
    { ...payment, info: {} },
  ])('does not fetch ineligible payments', (entry) => {
    expect(renderHook(() => usePaymentCounterparty(entry)).result.current).toBeNull();
    expect(fetchPaymentCounterparties).not.toHaveBeenCalled();
  });
  it('does not fetch without a session', () => {
    vi.mocked(useActiveSession).mockReturnValue(null);
    expect(renderHook(() => usePaymentCounterparty(payment)).result.current).toBeNull();
    expect(fetchPaymentCounterparties).not.toHaveBeenCalled();
  });
  it.each([true, false])('caches a result (match: %s)', async (match) => {
    const rows = match ? [RECEIVED_FROM_MEMBER_SENDER] : [];
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
    hook.unmount();
    await act(async () => {
      resolve([RECEIVED_FROM_MEMBER_SENDER]);
    });
    expect(hook.result.current).toBeNull();
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
});
