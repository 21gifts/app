import { cleanup, fireEvent, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WalletBalance } from '@/components/WalletBalance';
import { useSpotRate } from '@/hooks/useSpotRate';
import type { FiatRateDay } from '@/lib/stats-money';
import { renderWithLocale } from '@/__tests__/render-with-locale';

vi.mock('@/hooks/useSpotRate', () => ({
  useSpotRate: vi.fn(),
}));

vi.mock('@/components/WalletSetupNote', () => ({
  WalletSetupNote: () => <p role="alert">setup failed</p>,
}));

const RATE_DAY: FiatRateDay = {
  sats: 100_000_000,
  usd: '100000.00',
  chf: '80000.00',
  eur: '90000.00',
  php: '5600000.00',
};

beforeEach(() => {
  vi.mocked(useSpotRate).mockReset().mockReturnValue(null);
});

afterEach(cleanup);

describe('WalletBalance', () => {
  it('renders nothing while disabled and does not request a rate', () => {
    const { container } = renderWithLocale(
      <WalletBalance status="disabled" balanceSats={null} onUnlock={vi.fn()} onRetry={vi.fn()} />,
    );
    expect(container.firstChild).toBeNull();
    expect(useSpotRate).toHaveBeenCalledWith(false);
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
    expect(useSpotRate).toHaveBeenCalledWith(false);
  });

  it('renders the pending treatment without a button', () => {
    const { container } = renderWithLocale(
      <WalletBalance status="connecting" balanceSats={null} onUnlock={vi.fn()} onRetry={vi.fn()} />,
    );
    expect(screen.getByRole('status').textContent).toBe('Opening your wallet…');
    expect(container.querySelector('svg')?.className.baseVal).toContain('animate-spin');
    expect(screen.queryByRole('button')).toBeNull();
    expect(useSpotRate).toHaveBeenCalledWith(false);
  });

  it('renders bitcoin and preferred fiat with a usable rate', () => {
    vi.mocked(useSpotRate).mockReturnValue(RATE_DAY);
    renderWithLocale(
      <WalletBalance status="ready" balanceSats={21_000} onUnlock={vi.fn()} onRetry={vi.fn()} />,
    );
    const toggle = screen.getByRole('button', { name: "₿21'000 $21.00" });
    const [large, small] = Array.from(toggle.children);
    expect(large?.textContent).toBe("₿21'000");
    expect(large?.className).toContain('text-5xl');
    expect(small?.textContent).toBe('$21.00');
    expect(small?.className).toContain('text-app-muted');
    expect(useSpotRate).toHaveBeenCalledWith(true);
  });

  it('swaps the large figure between bitcoin and fiat on each tap', () => {
    vi.mocked(useSpotRate).mockReturnValue(RATE_DAY);
    renderWithLocale(
      <WalletBalance status="ready" balanceSats={21_000} onUnlock={vi.fn()} onRetry={vi.fn()} />,
    );
    fireEvent.click(screen.getByRole('button', { name: "₿21'000 $21.00" }));
    const swapped = screen.getByRole('button', { name: "$21.00 ₿21'000" });
    expect(swapped.children[0]?.textContent).toBe('$21.00');
    expect(swapped.children[0]?.className).toContain('text-5xl');
    expect(swapped.children[1]?.textContent).toBe("₿21'000");
    fireEvent.click(swapped);
    expect(screen.getByRole('button', { name: "₿21'000 $21.00" }).children[0]?.textContent).toBe(
      "₿21'000",
    );
  });

  it('renders only bitcoin without a usable rate', () => {
    renderWithLocale(
      <WalletBalance status="ready" balanceSats={21_000} onUnlock={vi.fn()} onRetry={vi.fn()} />,
    );
    expect(screen.getByText("₿21'000").className).toContain('text-5xl');
    expect(screen.queryByText('$21.00')).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
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
    expect(useSpotRate).toHaveBeenCalledWith(false);
  });

  it('says that this phone or browser cannot hold a wallet when the passkey has no PRF', () => {
    const onRetry = vi.fn();
    renderWithLocale(
      <WalletBalance
        status="error"
        balanceSats={null}
        onUnlock={vi.fn()}
        onRetry={onRetry}
        prfUnsupported
      />,
    );
    expect(screen.getByRole('alert').textContent).toBe(
      'This phone or browser cannot hold a 21.gifts wallet. Please use an up-to-date phone or browser that supports passkeys.',
    );
    expect(screen.queryByText('Your wallet could not be opened. Please try again.')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('renders the inline setup note instead of the ordinary error controls', () => {
    const onRetry = vi.fn();
    renderWithLocale(
      <WalletBalance
        status="error"
        balanceSats={null}
        onUnlock={vi.fn()}
        onRetry={onRetry}
        setupFailed
      />,
    );
    expect(screen.getByRole('alert').textContent).toBe('setup failed');
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull();
    expect(onRetry).not.toHaveBeenCalled();
  });

  it('does not render prohibited implementation vocabulary', () => {
    vi.mocked(useSpotRate).mockReturnValue(RATE_DAY);
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
