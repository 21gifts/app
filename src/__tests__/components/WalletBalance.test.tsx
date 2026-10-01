import { cleanup, fireEvent, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WalletBalance } from '@/components/WalletBalance';
import { useLatestRateDay } from '@/hooks/useLatestRateDay';
import type { FiatRateDay } from '@/lib/stats-money';
import { renderWithLocale } from '@/__tests__/render-with-locale';

vi.mock('@/hooks/useLatestRateDay', () => ({
  useLatestRateDay: vi.fn(),
}));

const RATE_DAY: FiatRateDay = {
  sats: 100_000_000,
  usd: '100000.00',
  chf: '80000.00',
  eur: '90000.00',
  php: '5600000.00',
};

beforeEach(() => {
  vi.mocked(useLatestRateDay).mockReset().mockReturnValue(null);
});

afterEach(cleanup);

describe('WalletBalance', () => {
  it('renders nothing while disabled and does not request a rate', () => {
    const { container } = renderWithLocale(
      <WalletBalance status="disabled" balanceSats={null} onUnlock={vi.fn()} onRetry={vi.fn()} />,
    );
    expect(container.firstChild).toBeNull();
    expect(useLatestRateDay).toHaveBeenCalledWith(false);
  });

  it('renders the named locked region and calls unlock', () => {
    const onUnlock = vi.fn();
    renderWithLocale(
      <WalletBalance status="locked" balanceSats={null} onUnlock={onUnlock} onRetry={vi.fn()} />,
    );
    expect(screen.getByRole('region', { name: 'Balance' })).toBeTruthy();
    expect(screen.getByText('Unlock your wallet to see your Bitcoin balance.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Unlock wallet' }));
    expect(onUnlock).toHaveBeenCalledTimes(1);
    expect(useLatestRateDay).toHaveBeenCalledWith(false);
  });

  it('renders the pending treatment without a button', () => {
    const { container } = renderWithLocale(
      <WalletBalance status="connecting" balanceSats={null} onUnlock={vi.fn()} onRetry={vi.fn()} />,
    );
    expect(screen.getByRole('status').textContent).toBe('Opening your wallet…');
    expect(container.querySelector('svg')?.className.baseVal).toContain('animate-spin');
    expect(screen.queryByRole('button')).toBeNull();
    expect(useLatestRateDay).toHaveBeenCalledWith(false);
  });

  it('renders bitcoin and preferred fiat with a usable rate', () => {
    vi.mocked(useLatestRateDay).mockReturnValue(RATE_DAY);
    renderWithLocale(
      <WalletBalance status="ready" balanceSats={21_000} onUnlock={vi.fn()} onRetry={vi.fn()} />,
    );
    expect(screen.getByText("₿21'000")).toBeTruthy();
    expect(screen.getByText('$21.00')).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Balance' }).textContent).toContain(
      "₿21'000 · $21.00",
    );
    expect(useLatestRateDay).toHaveBeenCalledWith(true);
  });

  it('renders only bitcoin without a usable rate', () => {
    renderWithLocale(
      <WalletBalance status="ready" balanceSats={21_000} onUnlock={vi.fn()} onRetry={vi.fn()} />,
    );
    expect(screen.getByText("₿21'000")).toBeTruthy();
    expect(screen.queryByText('$21.00')).toBeNull();
  });

  it('keeps the ready region and label when the balance is unavailable', () => {
    renderWithLocale(
      <WalletBalance status="ready" balanceSats={null} onUnlock={vi.fn()} onRetry={vi.fn()} />,
    );
    const region = screen.getByRole('region', { name: 'Balance' });
    expect(region.textContent).toBe('Balance');
  });

  it('renders the error alert and calls retry', () => {
    const onRetry = vi.fn();
    renderWithLocale(
      <WalletBalance status="error" balanceSats={null} onUnlock={vi.fn()} onRetry={onRetry} />,
    );
    expect(screen.getByRole('alert').textContent).toBe(
      'Your wallet could not be opened. Please try again.',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(useLatestRateDay).toHaveBeenCalledWith(false);
  });

  it('does not render prohibited implementation vocabulary', () => {
    vi.mocked(useLatestRateDay).mockReturnValue(RATE_DAY);
    for (const status of ['locked', 'connecting', 'ready', 'error'] as const) {
      const { container, unmount } = renderWithLocale(
        <WalletBalance
          status={status}
          balanceSats={status === 'ready' ? 21_000 : null}
          onUnlock={vi.fn()}
          onRetry={vi.fn()}
        />,
      );
      expect(container.textContent).not.toMatch(/Lightning|Spark|LNURL|zap|sats/i);
      unmount();
    }
  });

  it('renders the German strings', () => {
    renderWithLocale(
      <WalletBalance status="locked" balanceSats={null} onUnlock={vi.fn()} onRetry={vi.fn()} />,
      'de',
    );
    expect(screen.getByRole('region', { name: 'Guthaben' })).toBeTruthy();
    expect(
      screen.getByText('Entsperren Sie Ihre Wallet, um Ihr Bitcoin-Guthaben zu sehen.'),
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Wallet entsperren' })).toBeTruthy();
  });
});
