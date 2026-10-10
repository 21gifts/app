import { cleanup, fireEvent, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LoansCard } from '@/components/LoansCard';
import { useMyLoans } from '@/hooks/useMyLoans';
import { useSpotRate } from '@/hooks/useSpotRate';
import type { MyLoan, MyLoans } from '@/lib/api';
import type { FiatRateDay } from '@/lib/stats-money';
import { renderWithLocale } from '@/__tests__/render-with-locale';

const goalBar = vi.hoisted(() => vi.fn());
vi.mock('@/components/ForumGoalBar', () => ({
  ForumGoalBar: (props: { sats: number; goalSats: number; [key: string]: unknown }) => {
    goalBar(props);
    return <div data-testid="goal-bar">{`${props.sats}/${props.goalSats}`}</div>;
  },
}));
vi.mock('@/hooks/useMyLoans', () => ({ useMyLoans: vi.fn() }));
vi.mock('@/hooks/useSpotRate', () => ({ useSpotRate: vi.fn() }));

const RATE_DAY: FiatRateDay = {
  sats: 100_000_000,
  usd: '100000.00',
  chf: '80000.00',
  eur: '90000.00',
  php: '5600000.00',
};

function loan(overrides: Partial<MyLoan> = {}): MyLoan {
  return {
    messageId: 'loan/1',
    text: 'A sewing machine for my work',
    createdAt: '2026-09-01T00:00:00.000Z',
    goalSats: 30_000,
    sats: 30_000,
    goalCurrency: 'BTC',
    goalAmount: '30000',
    goalAmountUsd: '30.00',
    goalAmountChf: '24.00',
    goalAmountEur: '27.00',
    goalAmountPhp: '1680.00',
    amountUsd: '30.00',
    amountChf: '24.00',
    amountEur: '27.00',
    amountPhp: '1680.00',
    termDays: 30,
    fundedAt: '2026-09-02T00:00:00.000Z',
    daysDue: 10,
    daysPaid: 9,
    repaidSats: 9_000,
    totalSats: 30_000,
    due: {
      payableSats: 1_000,
      payablePeople: 1,
      waitingSats: 0,
      waitingPeople: 0,
      behindDays: 0,
      payableAmount: null,
      waitingAmount: null,
      lastPayment: false,
    },
    next: { dueOn: '2026-10-12', sats: 1_000, amount: null },
    ...overrides,
  };
}

function show(loans: MyLoans | null, place: 'welcome' | 'wallet' = 'welcome'): void {
  vi.mocked(useMyLoans).mockReturnValue({ loans, reload: vi.fn() });
  renderWithLocale(<LoansCard place={place} />);
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-10T10:00:00'));
  vi.mocked(useSpotRate).mockReturnValue(RATE_DAY);
  vi.mocked(useMyLoans).mockReturnValue({ loans: null, reload: vi.fn() });
  goalBar.mockReset();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('LoansCard', () => {
  it('renders nothing while loading or with no loans', () => {
    const loading = renderWithLocale(<LoansCard place="welcome" />);
    expect(loading.container.innerHTML).toBe('');
    loading.unmount();
    show({ sundayRest: false, loans: [] });
    expect(screen.queryByRole('region')).toBeNull();
  });

  it('shows a collecting loan, its exact goal fields, and the collapsed post link', () => {
    const item = loan({ sats: 12_000, fundedAt: null });
    show({ sundayRest: false, loans: [item] });
    const card = screen.getByRole('region', { name: 'Your loan' });
    expect(card.className).toContain('mt-4');
    expect(card.className).toContain('border-app-border');
    expect(screen.getByRole('heading', { name: 'Your loan' }).className).toBe(
      'text-sm font-semibold text-app-fg',
    );
    expect(screen.getByText('Not fully funded yet.').className).toBe('mt-1 text-sm text-app-muted');
    expect(goalBar).toHaveBeenCalledWith(
      expect.objectContaining({
        sats: 12_000,
        goalCurrency: 'BTC',
        goalAmount: '30000',
      }),
    );
    expect(screen.queryByRole('link')).toBeNull();
    const toggle = screen.getByRole('button', { name: 'Show loan' });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(toggle.className).toContain('mt-3');
    expect(toggle.className).toContain('w-full');
    expect(toggle.className).toContain('justify-between');
    expect(toggle.className).not.toContain('underline');
    expect(toggle.querySelector('svg')?.className.baseVal).toContain('shrink-0 text-app-muted');
    fireEvent.click(toggle);
    const openToggle = screen.getByRole('button', { name: 'Hide loan' });
    expect(openToggle.getAttribute('aria-expanded')).toBe('true');
    expect(openToggle.querySelector('svg')?.className.baseVal).toContain('rotate-180');
    const post = screen.getByRole('link', { name: 'A sewing machine for my work' });
    expect(post.getAttribute('href')).toBe('/messages/loan%2F1');
    expect(post.closest('ul')?.className).toContain('mt-2');
    expect(screen.getByText('40%')).toBeTruthy();
  });

  it('combines several goals and shows the behind amount and Send', () => {
    show({
      sundayRest: false,
      loans: [
        loan({ due: { ...loan().due, behindDays: 2 } }),
        loan({
          messageId: 'two',
          text: 'School books',
          goalSats: 12_000,
          sats: 6_000,
          fundedAt: null,
          due: { ...loan().due, payableSats: 0, payablePeople: 0 },
        }),
      ],
    });
    const card = screen.getByRole('region', { name: 'Your loans (2)' });
    expect(card.className).toContain('border-app-danger/50');
    expect(screen.getByText('1 of 2 fully funded.')).toBeTruthy();
    expect(screen.getByText("You're 2 days behind")).toBeTruthy();
    expect(screen.getByText("₿1'000").textContent).toBe("₿1'000 · $1.00");
    expect(screen.getByRole('link', { name: 'Send' }).getAttribute('href')).toBe('/loans/repay');
    expect(goalBar).toHaveBeenCalledWith(
      expect.objectContaining({ sats: 36_000, goalSats: 42_000 }),
    );
    expect(goalBar.mock.calls[0]?.[0]).not.toHaveProperty('goalCurrency');
    fireEvent.click(screen.getByRole('button', { name: 'Show loans' }));
    expect(screen.getByRole('button', { name: 'Hide loans' })).toBeTruthy();
  });

  it('shows Sunday rest without a repayment link', () => {
    show({ sundayRest: true, loans: [loan()] });
    expect(screen.getByText('No repayments on Sundays')).toBeTruthy();
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('shows an ordinary due-today row with the funded status', () => {
    show({ sundayRest: false, loans: [loan()] });
    expect(screen.getByText('Fully funded.')).toBeTruthy();
    expect(screen.getByText('Due today')).toBeTruthy();
    expect(screen.getByText("₿1'000").textContent).toBe("₿1'000 · $1.00");
  });

  it('shows a one-day warning and omits fiat when no spot rate exists', () => {
    vi.mocked(useSpotRate).mockReturnValue(null);
    show({
      sundayRest: false,
      loans: [loan({ due: { ...loan().due, behindDays: 1 } })],
    });
    expect(screen.getByText("You're 1 day behind")).toBeTruthy();
    expect(screen.getByText("₿1'000").textContent).toBe("₿1'000");
    expect(screen.queryByText(/\$/)).toBeNull();
    cleanup();
    show({
      sundayRest: false,
      loans: [
        loan({
          due: { ...loan().due, payableSats: 0, payablePeople: 0 },
          next: { dueOn: '2026-10-11', sats: 1_000, amount: null },
        }),
      ],
    });
    expect(screen.getByText("Next: tomorrow, ₿1'000")).toBeTruthy();
  });

  it('shows the success state and tomorrow line with its details arrow', () => {
    show({
      sundayRest: false,
      loans: [
        loan({
          due: { ...loan().due, payableSats: 0, payablePeople: 0 },
          next: { dueOn: '2026-10-11', sats: 1_000, amount: null },
        }),
      ],
    });
    const card = screen.getByRole('region', { name: 'Your loan' });
    expect(card.className).toContain('border-app-success/50');
    expect(screen.getByText("Next: tomorrow, ₿1'000 · $1.00")).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Repayment details' }).getAttribute('href')).toBe(
      '/loans/repay',
    );
  });

  it('uses the long local date and only tells the wallet about waiting lenders', () => {
    const data: MyLoans = {
      sundayRest: false,
      loans: [
        loan({
          due: {
            ...loan().due,
            payableSats: 0,
            payablePeople: 0,
            waitingSats: 200,
            waitingPeople: 2,
          },
          next: { dueOn: '2026-10-13', sats: 1_000, amount: null },
        }),
      ],
    };
    const welcome = renderWithLocale(<LoansCard place="welcome" />);
    vi.mocked(useMyLoans).mockReturnValue({ loans: data, reload: vi.fn() });
    welcome.rerender(<LoansCard place="welcome" />);
    expect(screen.getByText(/Next: Tuesday, October 13/)).toBeTruthy();
    expect(screen.queryByText(/lenders have no wallet/)).toBeNull();
    welcome.unmount();
    show(data, 'wallet');
    expect(screen.getByText('₿200 · $0.20 waits · 2 lenders have no wallet yet')).toBeTruthy();
    expect(screen.getByText('Nothing due today').className).toContain('text-app-muted');
  });

  it('uses the singular waiting sentence and omits a missing next line', () => {
    show(
      {
        sundayRest: false,
        loans: [
          loan({
            due: {
              ...loan().due,
              payableSats: 0,
              payablePeople: 0,
              waitingSats: 200,
              waitingPeople: 1,
            },
            next: null,
          }),
        ],
      },
      'wallet',
    );
    expect(screen.getByText('₿200 · $0.20 waits · a lender has no wallet yet')).toBeTruthy();
    expect(screen.queryByText(/^Next:/)).toBeNull();
  });
});
