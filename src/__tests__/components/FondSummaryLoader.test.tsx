import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FondSummaryLoader } from '@/components/FondSummaryLoader';
import type { FondSummary } from '@/lib/api-types';
import type { FiatRateDay } from '@/lib/stats-money';
import { renderWithLocale } from '@/__tests__/render-with-locale';

const spot = vi.hoisted(() => ({ value: null as FiatRateDay | null }));

vi.mock('@/hooks/useSpotRate', () => ({
  useSpotRate: (): FiatRateDay | null => spot.value,
}));

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return { ...actual, fetchFondSummary: vi.fn() };
});

import { fetchFondSummary } from '@/lib/api';

const SUMMARY: FondSummary = {
  username: 'tondo-fond',
  receivedSats: 210_000,
  paidOutSats: 21_000,
  feesSats: 210,
  balanceSats: 189_000,
  balanceSyncedAt: '2026-11-11T10:00:00.000Z',
  payoutsPaid: 3,
  payoutsPaidUsd: '3.00',
  onchainAddress: null,
};

afterEach(() => {
  cleanup();
  vi.mocked(fetchFondSummary).mockReset();
  spot.value = null;
});

describe('FondSummaryLoader', () => {
  it('shows the loading sentence before the answer', () => {
    vi.mocked(fetchFondSummary).mockReturnValue(new Promise<FondSummary | null>(() => undefined));
    renderWithLocale(<FondSummaryLoader username="tondo-fond" />);
    expect(screen.getByText('Loading…')).toBeTruthy();
  });

  it('shows the handle, KPI tiles, and the paid grant-payout line', async () => {
    vi.mocked(fetchFondSummary).mockResolvedValue(SUMMARY);
    renderWithLocale(<FondSummaryLoader username="tondo-fond" />);
    expect(await screen.findByRole('heading', { name: 'tondo-fond' })).toBeTruthy();
    expect(screen.getByText('Received')).toBeTruthy();
    expect(screen.getByText("₿210'000")).toBeTruthy();
    expect(screen.getByText('Paid out')).toBeTruthy();
    expect(screen.getByText("₿21'000")).toBeTruthy();
    expect(screen.getByText('Fees ₿210')).toBeTruthy();
    expect(screen.getByText('Balance')).toBeTruthy();
    expect(screen.getByText("₿189'000")).toBeTruthy();
    expect(screen.getByText(/as of/)).toBeTruthy();
    expect(screen.getByText('3 grant payouts paid (3.00 USD)', { exact: false })).toBeTruthy();
    expect(fetchFondSummary).toHaveBeenCalledWith('tondo-fond');
  });

  it('shows the deposit block with the summary handle and on-chain address', async () => {
    vi.mocked(fetchFondSummary).mockResolvedValue({
      ...SUMMARY,
      onchainAddress: 'bc1p5cyxnuxmeuwuvkwfem96lqzszd02n6xdcjrs20cac6yqjjwudpxqkedrcr',
    });
    renderWithLocale(<FondSummaryLoader username="tondo-fond" />);
    expect(await screen.findByRole('heading', { name: 'Top up this Fond' })).toBeTruthy();
    expect(screen.getByRole('group', { name: 'Deposit method' })).toBeTruthy();
    expect(await screen.findByText('tondo-fond@21.gifts')).toBeTruthy();
  });

  it('shows one paid grant payout in the singular', async () => {
    vi.mocked(fetchFondSummary).mockResolvedValue({
      ...SUMMARY,
      payoutsPaid: 1,
      payoutsPaidUsd: '1.00',
    });
    renderWithLocale(<FondSummaryLoader username="tondo-fond" />);
    expect(await screen.findByText('1 grant payout paid (1.00 USD)')).toBeTruthy();
  });

  it('shows the preferred fiat from the current spot under each amount', async () => {
    spot.value = { sats: 100_000_000, usd: '100000', chf: null, eur: null, php: null };
    vi.mocked(fetchFondSummary).mockResolvedValue(SUMMARY);
    renderWithLocale(<FondSummaryLoader username="tondo-fond" />);
    expect(await screen.findByText('$210.00')).toBeTruthy();
    expect(screen.getByText('$21.00')).toBeTruthy();
    expect(screen.getByText('$0.21')).toBeTruthy();
    expect(screen.getByText('$189.00')).toBeTruthy();
  });

  it('shows a ₿0 fee with its fiat figure', async () => {
    spot.value = { sats: 100_000_000, usd: '100000', chf: null, eur: null, php: null };
    vi.mocked(fetchFondSummary).mockResolvedValue({ ...SUMMARY, feesSats: 0 });
    renderWithLocale(<FondSummaryLoader username="tondo-fond" />);
    expect(await screen.findByText('Fees ₿0')).toBeTruthy();
    expect(screen.getByText('$0.00')).toBeTruthy();
  });

  it('shows the Fond role hint when the pill is pressed', async () => {
    vi.mocked(fetchFondSummary).mockResolvedValue(SUMMARY);
    renderWithLocale(<FondSummaryLoader username="tondo-fond" />);
    await screen.findByRole('heading', { name: 'tondo-fond' });
    const pill = screen.getByRole('button', { name: 'Fond' });
    expect(pill.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(pill);
    expect(pill.getAttribute('aria-expanded')).toBe('true');
    expect(
      screen.getByText('This account pays the daily gifts from the 21.gifts fund.'),
    ).toBeTruthy();
    fireEvent.click(pill);
    expect(pill.getAttribute('aria-expanded')).toBe('false');
  });

  it('shows an em dash and the not-reported line when the balance is null', async () => {
    vi.mocked(fetchFondSummary).mockResolvedValue({
      ...SUMMARY,
      balanceSats: null,
      balanceSyncedAt: null,
    });
    renderWithLocale(<FondSummaryLoader username="tondo-fond" />);
    expect(await screen.findByText('\u2014')).toBeTruthy();
    expect(screen.getByText('not reported yet')).toBeTruthy();
  });

  it('shows the not-found sentence on 404', async () => {
    vi.mocked(fetchFondSummary).mockResolvedValue(null);
    renderWithLocale(<FondSummaryLoader username="tondo-fond" />);
    expect(await screen.findByText('This Fond could not be found.')).toBeTruthy();
  });

  it('shows the error and retries', async () => {
    vi.mocked(fetchFondSummary).mockRejectedValueOnce(new Error('503'));
    renderWithLocale(<FondSummaryLoader username="tondo-fond" />);
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toBe('Could not load the Fond. Please try again.');
    vi.mocked(fetchFondSummary).mockResolvedValue(SUMMARY);
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'tondo-fond' })).toBeTruthy();
    });
    expect(fetchFondSummary).toHaveBeenCalledTimes(2);
  });

  it('renders German copy for the tiles', async () => {
    vi.mocked(fetchFondSummary).mockResolvedValue(SUMMARY);
    renderWithLocale(<FondSummaryLoader username="tondo-fond" />, 'de');
    expect(await screen.findByText('Eingenommen')).toBeTruthy();
    expect(screen.getByText('Ausgezahlt')).toBeTruthy();
    expect(screen.getByText('Kontostand')).toBeTruthy();
    expect(screen.getByText(/Stand /)).toBeTruthy();
    expect(screen.getByText(/Grant-Auszahlungen ausgezahlt/, { exact: false })).toBeTruthy();
  });

  it('ignores a stale resolve after unmount', async () => {
    let resolveSummary: ((value: FondSummary | null) => void) | undefined;
    vi.mocked(fetchFondSummary).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveSummary = resolve;
        }),
    );
    const view = renderWithLocale(<FondSummaryLoader username="tondo-fond" />);
    view.unmount();
    resolveSummary?.(SUMMARY);
    await Promise.resolve();
    expect(fetchFondSummary).toHaveBeenCalled();
  });

  it('ignores a stale missing answer after unmount', async () => {
    let resolveSummary: ((value: FondSummary | null) => void) | undefined;
    vi.mocked(fetchFondSummary).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveSummary = resolve;
        }),
    );
    const view = renderWithLocale(<FondSummaryLoader username="tondo-fond" />);
    view.unmount();
    resolveSummary?.(null);
    await Promise.resolve();
    expect(fetchFondSummary).toHaveBeenCalled();
  });

  it('ignores a stale reject after unmount', async () => {
    let rejectSummary: ((reason: Error) => void) | undefined;
    vi.mocked(fetchFondSummary).mockImplementationOnce(
      () =>
        new Promise((_, reject) => {
          rejectSummary = reject;
        }),
    );
    const view = renderWithLocale(<FondSummaryLoader username="tondo-fond" />);
    view.unmount();
    rejectSummary?.(new Error('503'));
    await Promise.resolve();
    expect(fetchFondSummary).toHaveBeenCalled();
  });
});
