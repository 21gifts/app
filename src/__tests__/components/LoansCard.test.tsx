import { cleanup, fireEvent, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LoansCard } from '@/components/LoansCard';
import { useMyLoans } from '@/hooks/useMyLoans';
import { useSpotRate } from '@/hooks/useSpotRate';
import type { MyLoan, MyLoans } from '@/lib/api';
import { formatDefinedGoalAmount } from '@/lib/forum-goal';
import { formatFiatDisplay, satsToFiatAmount } from '@/lib/stats-money';
import type { FiatRateDay } from '@/lib/stats-money';
import { renderWithLocale } from '@/__tests__/render-with-locale';

const goalBar = vi.hoisted(() => vi.fn());
interface ForumGoalBarTestProps {
  sats: number;
  goalSats: number;
  goalCurrency?: string;
  goalAmount?: string;
}

vi.mock('@/components/ForumGoalBar', () => ({
  ForumGoalBar: (props: ForumGoalBarTestProps) => {
    goalBar(props);
    const goal =
      typeof props.goalAmount === 'string' &&
      (props.goalCurrency === 'PHP' ||
        props.goalCurrency === 'USD' ||
        props.goalCurrency === 'CHF' ||
        props.goalCurrency === 'EUR')
        ? formatDefinedGoalAmount(props.goalAmount, props.goalCurrency, 'ch')
        : '';
    return <div data-testid="goal-bar">{`${goal} ${props.sats}/${props.goalSats}`.trim()}</div>;
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

const PRODUCTION_SPOT = formatFiatDisplay(
  satsToFiatAmount(192_814 + 290_243, RATE_DAY, 'PHP'),
  'PHP',
  'ch',
);

function phpLoan(overrides: Partial<MyLoan> = {}): MyLoan {
  return loan({
    goalCurrency: 'PHP',
    goalAmount: '10000',
    goalAmountUsd: null,
    goalAmountChf: null,
    goalAmountEur: null,
    goalAmountPhp: '10000.00',
    amountUsd: null,
    amountChf: null,
    amountEur: null,
    amountPhp: '10000.98',
    goalSats: 192_814,
    sats: 192_833,
    fundedAt: '2026-10-10T00:00:00.000Z',
    due: { ...loan().due, payableSats: 0, payablePeople: 0 },
    next: { dueOn: '2026-11-16', sats: 19_999, amount: '199.99' },
    ...overrides,
  });
}

function collectingPhpLoan(): MyLoan {
  return phpLoan({
    messageId: 'loan-b',
    text: 'Small loan for school books for my daughter.',
    goalAmount: '15000',
    goalAmountPhp: '15000.00',
    amountPhp: '480.28',
    goalSats: 290_243,
    sats: 9_283,
    fundedAt: null,
    next: null,
    due: {
      payableSats: 0,
      payablePeople: 0,
      waitingSats: 0,
      waitingPeople: 0,
      behindDays: 0,
      payableAmount: null,
      waitingAmount: null,
      lastPayment: false,
    },
  });
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
    cleanup();
    show({ sundayRest: false, loans: [] }, 'wallet');
    expect(screen.queryByRole('region')).toBeNull();
  });

  it('shows a collecting loan, its exact goal fields, and the collapsed disclosure', () => {
    const item = loan({ sats: 12_000, fundedAt: null });
    show({ sundayRest: false, loans: [item] });
    const card = screen.getByRole('region', { name: 'Your loan' });
    expect(card.className).toContain('mt-4');
    expect(card.className).not.toContain('-mt-2');
    expect(card.className).not.toContain('max-w-xl');
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
    expect(
      screen.getByRole('link', { name: 'Pay early or end collecting' }).getAttribute('href'),
    ).toBe('/loans/repay');
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

  it('shows one defined goal bar per loan and the behind amount and Send', () => {
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
    expect(goalBar).toHaveBeenCalledTimes(2);
    expect(goalBar).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ sats: 30_000, goalSats: 30_000, goalCurrency: 'BTC' }),
    );
    expect(goalBar).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ sats: 6_000, goalSats: 12_000, goalCurrency: 'BTC' }),
    );
    expect(screen.getByText('A sewing machine for my work').tagName).toBe('P');
    expect(screen.getByText('School books').tagName).toBe('P');
    expect(screen.queryByRole('link', { name: 'A sewing machine for my work' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Show loans' }));
    expect(screen.getByRole('button', { name: 'Hide loans' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'A sewing machine for my work' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'School books' })).toBeTruthy();
  });

  it('keeps both PHP loans at their frozen figures instead of the summed goal spot', () => {
    expect(PRODUCTION_SPOT).toBe("₱27'051.19");
    show({ sundayRest: false, loans: [phpLoan(), collectingPhpLoan()] });
    const card = screen.getByRole('region', { name: 'Your loans (2)' });
    expect(card.textContent).not.toContain(PRODUCTION_SPOT);
    expect(screen.getAllByTestId('goal-bar')).toHaveLength(2);
    expect(screen.getByText(/₱10'000\.00/)).toBeTruthy();
    expect(screen.getByText(/₱15'000\.00/)).toBeTruthy();
    expect(goalBar).toHaveBeenCalledTimes(2);
    expect(goalBar).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        sats: 192_833,
        goalSats: 192_814,
        goalCurrency: 'PHP',
        goalAmount: '10000',
        goalAmountPhp: '10000.00',
        amountPhp: '10000.98',
      }),
    );
    expect(goalBar).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        sats: 9_283,
        goalSats: 290_243,
        goalCurrency: 'PHP',
        goalAmount: '15000',
        goalAmountPhp: '15000.00',
        amountPhp: '480.28',
      }),
    );
    expect(screen.getByText('A sewing machine for my work').tagName).toBe('P');
    expect(screen.getByText('Small loan for school books for my daughter.').tagName).toBe('P');
    fireEvent.click(screen.getByRole('button', { name: 'Show loans' }));
    expect(
      screen.getByRole('link', { name: 'Small loan for school books for my daughter.' }),
    ).toBeTruthy();
  });

  it('keeps a bitcoin and a PHP loan as separate bars', () => {
    show({
      sundayRest: false,
      loans: [loan(), collectingPhpLoan()],
    });
    expect(goalBar).toHaveBeenCalledTimes(2);
    expect(goalBar.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({ goalCurrency: 'BTC', goalAmount: '30000' }),
    );
    expect(goalBar.mock.calls[1]?.[0]).toEqual(
      expect.objectContaining({ goalCurrency: 'PHP', goalAmount: '15000' }),
    );
    expect(screen.queryByText(PRODUCTION_SPOT)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Show loans' }));
    expect(screen.getByRole('link', { name: 'A sewing machine for my work' })).toBeTruthy();
    expect(
      screen.getByRole('link', { name: 'Small loan for school books for my daughter.' }),
    ).toBeTruthy();
  });

  it('shows Sunday rest and keeps the post link behind the disclosure', () => {
    show({ sundayRest: true, loans: [loan()] });
    expect(screen.getByText('No repayments on Sundays')).toBeTruthy();
    expect(screen.queryByRole('link')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Show loan' }));
    expect(screen.getByRole('link', { name: 'A sewing machine for my work' })).toBeTruthy();
  });

  it('keeps a collecting-only entry off the card on Sunday', () => {
    show({ sundayRest: true, loans: [loan({ fundedAt: null })] });
    expect(screen.getByText('No repayments on Sundays')).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Pay early or end collecting' })).toBeNull();
  });

  it('shows Sunday rest for a manually closed underfunded loan', () => {
    show({
      sundayRest: true,
      loans: [loan({ fundedAt: null, closedAt: '2026-10-09T12:00:00.000Z' })],
    });
    expect(screen.queryByText('Not fully funded yet.')).toBeNull();
    expect(screen.getByText('No repayments on Sundays')).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Pay early or end collecting' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Repay your loan' })).toBeNull();
  });

  it('uses ordinary repayment wording for a manually closed underfunded loan on a weekday', () => {
    show({
      sundayRest: false,
      loans: [loan({ fundedAt: null, closedAt: '2026-10-09T12:00:00.000Z' })],
    });
    expect(screen.queryByText('Not fully funded yet.')).toBeNull();
    expect(screen.queryByText('No repayments on Sundays')).toBeNull();
    expect(screen.getByRole('link', { name: 'Repay your loan' })).toBeTruthy();
  });

  it('shows an ordinary due-today row with the funded status', () => {
    show({ sundayRest: false, loans: [loan()] });
    expect(screen.getByText('Fully funded.')).toBeTruthy();
    expect(screen.getByText('Due today')).toBeTruthy();
    expect(screen.getByText("₿1'000").textContent).toBe("₿1'000 · $1.00");
  });

  it('shows a stored payable amount with its bitcoin on the compact row', () => {
    show({
      sundayRest: false,
      loans: [
        phpLoan({
          due: {
            ...loan().due,
            payableSats: 192_833,
            payableAmount: '9999.99',
          },
        }),
      ],
    });
    expect(screen.getByText("₱9'999.99 · ₿192'833")).toBeTruthy();
    expect(screen.queryByText(PRODUCTION_SPOT)).toBeNull();
  });

  it('shows stored fiat due and waiting amounts without unavailable sat figures', () => {
    show({
      sundayRest: false,
      loans: [
        phpLoan({
          totalSats: null,
          maxSats: null,
          due: {
            ...loan().due,
            payableSats: null,
            payablePeople: 1,
            payableAmount: '30.00',
            waitingSats: null,
            waitingPeople: 1,
            waitingAmount: '15.00',
          },
          next: { dueOn: '2026-10-11', sats: null, amount: '30.00' },
        }),
      ],
    });

    expect(screen.getByText('₱30.00')).toBeTruthy();
    expect(screen.getByText('₱15.00 is waiting for a lender to set up their wallet')).toBeTruthy();
    expect(screen.queryByText(/^Next:/)).toBeNull();
    expect(screen.queryByRole('link', { name: 'Send' })).toBeNull();
    expect(screen.getByRole('link', { name: 'Repayment details' })).toBeTruthy();
  });

  it('marks an unpriced fiat due amount as danger when behind', () => {
    show({
      sundayRest: false,
      loans: [
        phpLoan({
          due: {
            ...loan().due,
            payableSats: null,
            payablePeople: 1,
            payableAmount: '30.00',
            behindDays: 2,
          },
        }),
      ],
    });

    expect(screen.getByText('₱30.00').className).toContain('text-app-danger');
  });

  it('omits unavailable due, waiting, and next amounts instead of rendering null', () => {
    const unavailable = phpLoan({
      totalSats: null,
      maxSats: null,
      due: {
        ...loan().due,
        payableSats: null,
        payablePeople: 1,
        payableAmount: null,
        waitingSats: null,
        waitingPeople: 1,
        waitingAmount: null,
      },
      next: { dueOn: '2026-10-11', sats: null, amount: null },
    });
    show({ sundayRest: false, loans: [unavailable] });
    expect(screen.getByText('Due today')).toBeTruthy();
    expect(screen.queryByText(/null/)).toBeNull();
    expect(screen.queryByText(/waiting for/)).toBeNull();
    expect(screen.getByRole('link', { name: 'Repayment details' })).toBeTruthy();

    cleanup();
    show({
      sundayRest: false,
      loans: [
        {
          ...unavailable,
          due: {
            ...unavailable.due,
            payablePeople: 0,
          },
        },
        loan({
          messageId: 'known-zero',
          due: {
            ...loan().due,
            payableSats: 0,
            payablePeople: 0,
            waitingSats: 0,
            waitingPeople: 0,
          },
        }),
      ],
    });
    expect(screen.getByText('Nothing to send now')).toBeTruthy();
    expect(screen.queryByText(/^Next:/)).toBeNull();
    expect(screen.queryByText(/null/)).toBeNull();
  });

  it('shows every payable fiat currency with its own sum', () => {
    show({
      sundayRest: false,
      loans: [
        loan({
          messageId: 'php',
          goalCurrency: 'PHP',
          goalAmount: '900.00',
          due: { ...loan().due, payableSats: 536, payableAmount: '30.00' },
        }),
        loan({
          messageId: 'usd',
          goalCurrency: 'USD',
          goalAmount: '900.00',
          due: { ...loan().due, payableSats: 464, payableAmount: '3.00' },
        }),
      ],
    });
    expect(screen.getByText("₱30.00 + $3.00 · ₿1'000")).toBeTruthy();
  });

  it('keeps a known bitcoin due payable beside an unpriced fiat loan', () => {
    show({
      sundayRest: false,
      loans: [
        loan(),
        phpLoan({
          messageId: 'unpriced',
          due: {
            ...loan().due,
            payableSats: null,
            payablePeople: 1,
            payableAmount: '30.00',
          },
        }),
      ],
    });
    expect(screen.getByText("₿1'000").textContent).toBe("₿1'000 · $1.00");
    expect(screen.queryByText(/null/)).toBeNull();
    expect(screen.getByRole('link', { name: 'Send' })).toBeTruthy();
  });

  it('keeps a priced fiat due payable beside an unpriced fiat loan', () => {
    show({
      sundayRest: false,
      loans: [
        phpLoan({
          messageId: 'priced',
          due: { ...loan().due, payableSats: 1_000, payableAmount: '30.00' },
        }),
        phpLoan({
          messageId: 'unpriced',
          due: {
            ...loan().due,
            payableSats: null,
            payablePeople: 1,
            payableAmount: '15.00',
          },
        }),
      ],
    });
    expect(screen.getByText("₱30.00 · ₿1'000")).toBeTruthy();
    expect(screen.getByText('₱15.00')).toBeTruthy();
    expect(screen.queryByText(/null/)).toBeNull();
    expect(screen.getByRole('link', { name: 'Send' })).toBeTruthy();
  });

  it('keeps an active unpriced due and waiting amount fiat-only beside known zeroes', () => {
    show({
      sundayRest: false,
      loans: [
        phpLoan({
          messageId: 'unpriced',
          due: {
            ...loan().due,
            payableSats: null,
            payablePeople: 1,
            payableAmount: '30.00',
            waitingSats: null,
            waitingPeople: 1,
            waitingAmount: '15.00',
          },
        }),
        loan({
          messageId: 'known-zero',
          due: {
            ...loan().due,
            payableSats: 0,
            payablePeople: 0,
            waitingSats: 0,
            waitingPeople: 0,
          },
        }),
      ],
    });
    expect(screen.getByText('₱30.00')).toBeTruthy();
    expect(screen.getByText('₱15.00 is waiting for a lender to set up their wallet')).toBeTruthy();
    expect(screen.queryByText(/₿0/)).toBeNull();
    expect(screen.queryByRole('link', { name: 'Send' })).toBeNull();
    expect(screen.getByRole('link', { name: 'Repayment details' })).toBeTruthy();
  });

  it('shows the stored next amount beside its bitcoin', () => {
    show({
      sundayRest: false,
      loans: [
        phpLoan({
          due: { ...loan().due, payableSats: 0, payablePeople: 0 },
          next: { dueOn: '2026-10-11', sats: 19_999, amount: '199.99' },
        }),
      ],
    });
    expect(screen.getByText("Next: tomorrow, ₱199.99 · ₿19'999")).toBeTruthy();
  });

  it('shows the next line in mixed currencies with each stored amount', () => {
    show({
      sundayRest: false,
      loans: [
        phpLoan({
          due: { ...loan().due, payableSats: 0, payablePeople: 0 },
          next: { dueOn: '2026-10-11', sats: 1_000, amount: '199.99' },
        }),
        loan({
          messageId: 'usd',
          text: 'A USD loan',
          goalCurrency: 'USD',
          due: { ...loan().due, payableSats: 0, payablePeople: 0 },
          next: { dueOn: '2026-10-11', sats: 1_000, amount: '2.00' },
        }),
      ],
    });
    expect(screen.getByText("Next: tomorrow, ₱199.99 + $2.00 · ₿2'000")).toBeTruthy();
  });

  it('separates priced and unpriced fiat on the same next day', () => {
    show({
      sundayRest: false,
      loans: [
        phpLoan({
          due: { ...loan().due, payableSats: 0, payablePeople: 0 },
          next: { dueOn: '2026-10-11', sats: 120, amount: '6.00' },
        }),
        phpLoan({
          messageId: 'unpriced-next',
          due: { ...loan().due, payableSats: 0, payablePeople: 0 },
          next: { dueOn: '2026-10-11', sats: null, amount: '3.00' },
        }),
      ],
    });
    expect(screen.getByText('Next: tomorrow, ₱6.00 · ₿120')).toBeTruthy();
    expect(screen.getByText('Next: tomorrow, ₱3.00')).toBeTruthy();
  });

  it('falls back to bitcoin and spot for missing stored strings', () => {
    show({
      sundayRest: false,
      loans: [
        phpLoan({
          due: {
            ...loan().due,
            payableSats: 1_000,
            payableAmount: null,
          },
          next: null,
        }),
      ],
    });
    expect(screen.getByText("₿1'000").textContent).toBe("₿1'000 · $1.00");
    cleanup();
    show({
      sundayRest: false,
      loans: [
        phpLoan({
          due: { ...loan().due, payableSats: 0, payablePeople: 0 },
          next: { dueOn: '2026-10-11', sats: 1_000, amount: null },
        }),
      ],
    });
    expect(screen.getByText("Next: tomorrow, ₿1'000 · $1.00")).toBeTruthy();
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

  it('omits the waiting line for a funded loan without waiting shares', () => {
    show({
      sundayRest: false,
      loans: [
        loan({
          due: {
            ...loan().due,
            payableSats: 0,
            payablePeople: 0,
            waitingSats: null,
            waitingPeople: 0,
          },
        }),
      ],
    });

    expect(screen.getByText('Nothing due today')).toBeTruthy();
    expect(screen.queryByText(/waiting for/)).toBeNull();
  });

  it('uses the long local date and tells both places about waiting lenders', () => {
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
    expect(
      screen.getByText('₿200 · $0.20 is waiting for 2 lenders to set up their wallets'),
    ).toBeTruthy();
    welcome.unmount();
    show(data, 'wallet');
    const card = screen.getByRole('region', { name: 'Your loan' });
    expect(card.className).toContain('-mt-2');
    expect(card.className).toContain('max-w-xl');
    expect(card.className).not.toContain('mt-4');
    expect(
      screen.getByText('₿200 · $0.20 is waiting for 2 lenders to set up their wallets'),
    ).toBeTruthy();
    expect(screen.getByText('Nothing to send now').className).toContain('text-app-muted');
    expect(screen.queryByText('Nothing due today')).toBeNull();
  });

  it('names waiting fiat shares by their stored figure', () => {
    show({
      sundayRest: false,
      loans: [
        loan({
          goalCurrency: 'PHP',
          goalAmount: '1680.00',
          due: {
            ...loan().due,
            waitingSats: 200,
            waitingPeople: 1,
            waitingAmount: '11.20',
          },
        }),
      ],
    });
    expect(
      screen.getByText('₱11.20 · ₿200 is waiting for a lender to set up their wallet'),
    ).toBeTruthy();
  });

  it('shows priced waiting sats even when the summary has no waiting people', () => {
    show({
      sundayRest: false,
      loans: [
        phpLoan({
          due: {
            ...loan().due,
            payableSats: 1_000,
            payableAmount: '30.00',
            waitingSats: 200,
            waitingPeople: 0,
            waitingAmount: '11.20',
          },
        }),
        loan({
          messageId: 'known-zero',
          due: {
            ...loan().due,
            payableSats: 0,
            payablePeople: 0,
            waitingSats: 0,
            waitingPeople: 0,
          },
        }),
      ],
    });
    expect(screen.getByText('Due today')).toBeTruthy();
    expect(screen.getByText("₱30.00 · ₿1'000")).toBeTruthy();
    expect(
      screen.getByText('₱11.20 · ₿200 is waiting for 0 lenders to set up their wallets'),
    ).toBeTruthy();
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
    expect(
      screen.getByText('₿200 · $0.20 is waiting for a lender to set up their wallet'),
    ).toBeTruthy();
    expect(screen.queryByText(/^Next:/)).toBeNull();
  });
});
