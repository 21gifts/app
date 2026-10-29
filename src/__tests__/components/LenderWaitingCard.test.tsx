import { cleanup, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LenderWaitingCard } from '@/components/LenderWaitingCard';
import { useMyLoans } from '@/hooks/useMyLoans';
import { useSpotRate } from '@/hooks/useSpotRate';
import type { MyLoans } from '@/lib/api';
import type { FiatRateDay } from '@/lib/stats-money';
import { renderWithLocale } from '@/__tests__/render-with-locale';

vi.mock('@/hooks/useMyLoans', () => ({ useMyLoans: vi.fn() }));
vi.mock('@/hooks/useSpotRate', () => ({ useSpotRate: vi.fn() }));

const RATE_DAY: FiatRateDay = {
  sats: 100_000_000,
  usd: '100000.00',
  chf: '80000.00',
  eur: '90000.00',
  php: '5600000.00',
};

function show(loans: MyLoans | null): void {
  vi.mocked(useMyLoans).mockReturnValue({ loans, reload: vi.fn() });
  renderWithLocale(<LenderWaitingCard />);
}

beforeEach(() => {
  vi.mocked(useSpotRate).mockReturnValue(RATE_DAY);
});

afterEach(() => {
  cleanup();
});

describe('LenderWaitingCard', () => {
  it('renders nothing before the loans load, without the field, or when nothing waits', () => {
    show(null);
    show({ sundayRest: false, loans: [] });
    show({ sundayRest: false, loans: [], lenderWaiting: { shares: 0, loans: 0, sats: 0 } });
    expect(screen.queryByRole('region')).toBeNull();
  });

  it('counts the waiting repayments, shows their sum, and opens the wallet', () => {
    show({ sundayRest: false, loans: [], lenderWaiting: { shares: 3, loans: 2, sats: 1_500 } });
    const card = screen.getByRole('region', {
      name: '3 repayments are waiting for you — open your wallet to receive them',
    });
    expect(card.className).toContain('border-app-border');
    expect(card.className).not.toContain('danger');
    expect(screen.getByText(/₿1'500/).textContent).toBe("₿1'500 · $1.50");
    expect(screen.getByRole('link', { name: 'Open your wallet' }).getAttribute('href')).toBe(
      '/wallet',
    );
  });

  it('uses the singular sentence and leaves out a sum the api could not price', () => {
    show({ sundayRest: false, loans: [], lenderWaiting: { shares: 1, loans: 1, sats: null } });
    expect(
      screen.getByRole('heading', {
        name: '1 repayment is waiting for you — open your wallet to receive it',
      }),
    ).toBeTruthy();
    expect(screen.queryByText(/₿/)).toBeNull();
  });
});
