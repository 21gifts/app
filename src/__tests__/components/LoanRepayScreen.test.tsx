import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LoanRepayScreen } from '@/components/LoanRepayScreen';
import { useLoanRepay, type LoanRepayResult } from '@/hooks/useLoanRepay';
import { useMyLoans } from '@/hooks/useMyLoans';
import { useSpotRate } from '@/hooks/useSpotRate';
import { getRepayment, type MyLoan, type MyLoans, type RepaymentLedger } from '@/lib/api';
import type { FiatRateDay } from '@/lib/stats-money';
import { useAuthStore } from '@/stores/auth-store';
import { renderWithLocale } from '@/__tests__/render-with-locale';

vi.mock('@/hooks/useMyLoans', () => ({ useMyLoans: vi.fn() }));
vi.mock('@/hooks/useLoanRepay', () => ({ useLoanRepay: vi.fn() }));
vi.mock('@/hooks/useSpotRate', () => ({ useSpotRate: vi.fn() }));
vi.mock('@/lib/api', () => ({ getRepayment: vi.fn() }));
vi.mock('@/components/WalletSetupNote', () => ({
  WalletSetupNote: () => <p role="alert">Wallet setup failed</p>,
}));
vi.mock('@/components/WalletOwnAddress', () => ({
  WalletOwnAddress: ({ username, copy }: { username: string; copy?: boolean }) => (
    <div data-testid="own-address">{`${username}:${String(copy)}`}</div>
  ),
}));

const RATE_DAY: FiatRateDay = {
  sats: 100_000_000,
  usd: '100000.00',
  chf: '80000.00',
  eur: '90000.00',
  php: '5600000.00',
};

function loan(overrides: Partial<MyLoan> = {}): MyLoan {
  return {
    messageId: 'loan-1',
    text: 'A sewing machine for my repair stall',
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
    closedAt: '2026-09-02T00:00:00.000Z',
    maxSats: 19_000,
    maxAmount: null,
    daysDue: 12,
    daysPaid: 11,
    repaidSats: 11_000,
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
    next: { dueOn: '2026-10-11', sats: 1_000, amount: null },
    ...overrides,
  };
}

function ledger(overrides: Partial<RepaymentLedger> = {}): RepaymentLedger {
  return {
    currency: 'BTC',
    fundedAt: '2026-09-02T00:00:00.000Z',
    termDays: 30,
    daysDue: 12,
    daysPaid: 11,
    unassignedSats: 0,
    givers: [
      {
        accountId: 'giver-1',
        name: 'Bruno',
        username: 'bruno',
        givenSats: 30_000,
        givenAmount: null,
        canReceive: true,
      },
    ],
    repayments: [
      {
        dayIndex: 11,
        dueOn: '2026-10-09',
        accountId: 'giver-1',
        name: 'Bruno',
        username: 'bruno',
        amount: null,
        sats: 1_000,
        dueSats: null,
        status: 'due',
        via: 'lightning',
      },
      {
        dayIndex: 12,
        dueOn: '2026-10-11',
        accountId: 'giver-1',
        name: 'Bruno',
        username: 'bruno',
        amount: null,
        sats: 1_000,
        dueSats: null,
        status: 'scheduled',
        via: 'lightning',
      },
    ],
    next: { dayIndex: 12, sats: 1_000, recipientAccountId: 'giver-1' },
    ...overrides,
  };
}

function repay(overrides: Partial<LoanRepayResult> = {}): LoanRepayResult {
  return {
    phase: 'idle',
    activeAction: { kind: 'due', messageId: null },
    balanceSats: 21_000,
    sentSats: 0,
    sentAmounts: [],
    sentNames: [],
    prepayWaiting: [],
    prepayMessageId: null,
    feeSats: 0,
    missingSats: null,
    errorKey: null,
    actionError: null,
    topUpOpen: false,
    openTopUp: vi.fn(),
    pay: vi.fn(),
    prepay: vi.fn(),
    closeCollecting: vi.fn(),
    pinned: false,
    ...overrides,
  };
}

function show(
  data: MyLoans | null,
  state: LoanRepayResult = repay(),
  reload = vi.fn(),
): ReturnType<typeof renderWithLocale> {
  reload.mockResolvedValue(data);
  vi.mocked(useMyLoans).mockReturnValue({ loans: data, reload });
  vi.mocked(useLoanRepay).mockReturnValue(state);
  return renderWithLocale(<LoanRepayScreen />);
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(new Date('2026-10-10T10:00:00'));
  vi.mocked(useSpotRate).mockReturnValue(RATE_DAY);
  vi.mocked(getRepayment).mockReset().mockResolvedValue(ledger());
  vi.mocked(useLoanRepay).mockReset();
  vi.mocked(useMyLoans).mockReset();
  vi.mocked(useMyLoans).mockReturnValue({
    loans: null,
    reload: vi.fn((): Promise<MyLoans | null> => new Promise(() => undefined)),
  });
  vi.mocked(useLoanRepay).mockReturnValue(repay());
  useAuthStore.setState({ session: 'token', account: { username: 'ada' } as never });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  useAuthStore.setState({ session: null, account: null });
});

describe('LoanRepayScreen', () => {
  it('shows loading, then a known initial read failure and retries', async () => {
    const reload = vi.fn().mockResolvedValue(null);
    vi.mocked(useMyLoans).mockReturnValue({ loans: null, reload });
    renderWithLocale(<LoanRepayScreen />);
    expect(screen.getByRole('status').textContent).toBe('Loading your loans…');
    expect((await screen.findByRole('alert')).textContent).toBe('Could not load your loans.');
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(reload).toHaveBeenCalledTimes(2);
  });

  it('does not turn a failed settlement reload into an initial-load error', async () => {
    const data = { sundayRest: false, loans: [loan()] };
    const reload = vi.fn().mockResolvedValueOnce(data).mockResolvedValueOnce(null);
    vi.mocked(useMyLoans).mockReturnValue({ loans: data, reload });
    vi.mocked(useLoanRepay).mockReturnValue(repay({ phase: 'waiting' }));
    const view = renderWithLocale(<LoanRepayScreen />);
    await waitFor(() => expect(reload).toHaveBeenCalledTimes(1));
    const options = vi.mocked(useLoanRepay).mock.calls[0]?.[0];
    await act(async () => {
      await expect(options?.reload()).resolves.toBeNull();
    });
    expect(screen.getByRole('status').textContent).toContain("Sending ₿1'000 · $1.00…");

    vi.mocked(useMyLoans).mockReturnValue({ loans: null, reload });
    view.rerender(<LoanRepayScreen />);
    expect(screen.getByRole('status').textContent).toBe('Loading your loans…');
    expect(screen.queryByText('Could not load your loans.')).toBeNull();
  });

  it('shows the no-loans state', () => {
    show({ sundayRest: false, loans: [] });
    expect(screen.getByRole('heading', { name: 'Loan repayment' }).className).toContain('sr-only');
    expect(screen.getByText('You have no loan to repay.')).toBeTruthy();
  });

  it('shows only the list for a collecting loan', () => {
    show({
      sundayRest: false,
      loans: [loan({ fundedAt: null, closedAt: null, sats: 12_000, maxSats: 12_000 })],
    });
    expect(screen.getByText('Not fully funded yet.')).toBeTruthy();
    expect(screen.queryByText('Due today')).toBeNull();
    expect(screen.getByText("₿30'000 · $30.00 · 30 days · ₿1'000 · $1.00 per day")).toBeTruthy();
    expect(screen.queryByRole('img', { name: /Repaid/ })).toBeNull();
    expect(screen.getByRole('heading', { name: 'Pay more' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'End collecting' })).toBeTruthy();
  });

  it('shows due recipients, old day labels, wallet balance, and sends once', async () => {
    const state = repay();
    show({ sundayRest: false, loans: [loan()] }, state);
    await waitFor(() => expect(getRepayment).toHaveBeenCalledWith('loan-1'));
    expect(screen.getByText("₿1'000")).toBeTruthy();
    expect(screen.getByText('$1.00')).toBeTruthy();
    expect(screen.getByText('to 1 person')).toBeTruthy();
    const who = screen.getByRole('button', { name: 'Who gets paid' });
    expect(who.className).toContain('w-full');
    expect(who.className).toContain('justify-between');
    expect(who.className).not.toContain('underline');
    expect(who.querySelector('svg')?.className.baseVal).toContain('text-app-muted');
    fireEvent.click(who);
    expect(who.querySelector('svg')?.className.baseVal).toContain('rotate-180');
    expect(screen.getByText(/Bruno/).parentElement?.textContent).toContain('Oct 9');
    const bruno = screen.getByText(/Bruno/).closest('li');
    expect(bruno?.textContent).toContain("₿1'000 · $1.00");
    expect(screen.getByText("From your wallet · ₿21'000 · $21.00")).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: "Send ₿1'000 · $1.00" }));
    expect(state.pay).toHaveBeenCalledWith(
      [expect.objectContaining({ messageId: 'loan-1' })],
      undefined,
      expect.any(Map),
    );
    const list = screen.getByRole('region', { name: 'Your loan' });
    expect(within(list).getByText("Repaid ₿11'000 · $11.00 of ₿30'000 · $30.00")).toBeTruthy();
    expect(within(list).getByText('Day 12 of 30')).toBeTruthy();
    expect(within(list).getByRole('img').getAttribute('viewBox')).toBe('0 0 100 8');
    expect(within(list).getByRole('link', { name: 'Repayment list' }).getAttribute('href')).toBe(
      '/messages/loan-1/repayment-list',
    );
  });

  it('shows the current spot when the goal stored no fiat', () => {
    show({
      sundayRest: false,
      loans: [
        loan({
          goalCurrency: 'BTC',
          goalAmountUsd: null,
          goalAmountChf: null,
          goalAmountEur: null,
          goalAmountPhp: null,
        }),
      ],
    });
    const list = screen.getByRole('region', { name: 'Your loan' });
    expect(
      within(list).getByText("₿30'000 · $30.00 · 30 days · ₿1'000 · $1.00 per day"),
    ).toBeTruthy();
    expect(within(list).getByText("Repaid ₿11'000 · $11.00 of ₿30'000 · $30.00")).toBeTruthy();
    expect(screen.getByText("₿1'000")).toBeTruthy();
    expect(screen.getByText('$1.00')).toBeTruthy();
    expect(screen.getByText("From your wallet · ₿21'000 · $21.00")).toBeTruthy();
  });

  it('keeps the stored loan total and shows payable sats in bitcoin without a spot rate', () => {
    vi.mocked(useSpotRate).mockReturnValue(null);
    show({ sundayRest: false, loans: [loan()] });
    expect(screen.getByText("₿1'000")).toBeTruthy();
    expect(screen.getByRole('button', { name: "Send ₿1'000" })).toBeTruthy();
    expect(screen.getByText("From your wallet · ₿21'000")).toBeTruthy();
    expect(screen.getByText("₿30'000 · $30.00 · 30 days · ₿1'000 per day")).toBeTruthy();
    expect(screen.queryByText(/\$1\.00/)).toBeNull();
  });

  it('renders a fiat loan whose unpaid sat figures are null from its stored amounts', async () => {
    const noRate = loan({
      goalCurrency: 'PHP',
      goalAmount: '300.00',
      totalSats: null,
      maxSats: null,
      maxAmount: '180.00',
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
    });
    vi.mocked(getRepayment).mockResolvedValue(
      ledger({
        currency: 'PHP',
        repayments: [
          { ...ledger().repayments[0]!, amount: '10.00', dueSats: null },
          { ...ledger().repayments[1]!, amount: '10.00', dueSats: null },
        ],
      }),
    );

    show({ sundayRest: false, loans: [noRate] });

    expect(screen.getByText('₱30.00')).toBeTruthy();
    expect(screen.getByText(/₱15\.00 waits for a lender/)).toBeTruthy();
    expect(await screen.findByText(/Next: tomorrow, ₱30\.00 to 1 person/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^Send / })).toBeNull();
    expect(screen.getByText('₱300.00 · 30 days · ₱10.00 per day')).toBeTruthy();
    expect(screen.getByText(/No PHP exchange rate is available now/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Max' })).toHaveProperty('disabled', true);
    expect(screen.getByRole('button', { name: 'Pay this amount' })).toHaveProperty(
      'disabled',
      true,
    );
    await waitFor(() => expect(getRepayment).toHaveBeenCalledWith('loan-1'));
    expect(screen.queryByRole('img', { name: /Repaid/ })).toBeNull();
  });

  it('omits the secondary member-fiat line when the loan uses that fiat', async () => {
    const usdLoan = loan({
      goalCurrency: 'USD',
      goalAmount: '30.00',
      due: { ...loan().due, payableAmount: '1.00' },
    });
    vi.mocked(getRepayment).mockResolvedValue(
      ledger({
        currency: 'USD',
        repayments: [{ ...ledger().repayments[0]!, amount: '1.00' }],
      }),
    );
    show({ sundayRest: false, loans: [usdLoan] });
    expect(screen.getByText('$30.00 · 30 days · $1.00 per day')).toBeTruthy();
    expect(screen.getByRole('button', { name: "Send $1.00 · ₿1'000" })).toBeTruthy();
  });

  it('keeps the big amount fiat-only for a priced fiat loan', () => {
    show({
      sundayRest: false,
      loans: [
        loan({
          goalCurrency: 'PHP',
          goalAmount: '900.00',
          due: { ...loan().due, payableSats: 1_000, payableAmount: '30.00' },
        }),
      ],
    });
    const bigAmount = screen.getByText('₱30.00');
    expect(bigAmount.className).toContain('text-3xl');
    expect(bigAmount.textContent).not.toContain('₿');
    expect(screen.queryByText("₱30.00 · ₿1'000")).toBeNull();
    expect(screen.getByRole('button', { name: "Send ₱30.00 · ₿1'000" })).toBeTruthy();
  });

  it('names the last day when the loan currency does not divide evenly', () => {
    show({
      sundayRest: false,
      loans: [
        loan({
          goalCurrency: 'USD',
          goalAmount: '10.00',
          termDays: 4,
          totalSats: 10_001,
          goalSats: 10_001,
        }),
        loan({
          messageId: 'loan-btc',
          goalCurrency: 'BTC',
          goalAmount: '10001',
          termDays: 4,
          totalSats: 10_001,
          goalSats: 10_001,
          goalAmountUsd: null,
          goalAmountChf: null,
          goalAmountEur: null,
          goalAmountPhp: null,
        }),
      ],
    });
    expect(screen.getByText('$10.00 · 4 days · $2.50 per day')).toBeTruthy();
    expect(
      screen.getByText(
        "₿10'001 · $10.00 · ₿2'500 · $2.50 per day for 3 days, then ₿2'501 · $2.50 on the last day",
      ),
    ).toBeTruthy();
  });

  it('falls back to bitcoin and spot for an unusable payable-amount value', () => {
    show({
      sundayRest: false,
      loans: [
        loan({
          goalCurrency: 'EUR',
          goalAmount: '30.00',
          due: { ...loan().due, payableAmount: 'not-an-amount' },
        }),
      ],
    });
    expect(screen.getByText("₿1'000")).toBeTruthy();
    expect(screen.getByText('$1.00')).toBeTruthy();
    expect(screen.getByRole('button', { name: "Send ₿1'000 · $1.00" })).toBeTruthy();
    expect(screen.queryByText('EUR 0.00')).toBeNull();
  });

  it('sums two PHP payable amounts in their currency for the due box', () => {
    show({
      sundayRest: false,
      loans: [
        loan({
          messageId: 'php-1',
          goalCurrency: 'PHP',
          goalAmount: '900.00',
          due: { ...loan().due, payableSats: 536, payableAmount: '30.00' },
        }),
        loan({
          messageId: 'php-2',
          goalCurrency: 'PHP',
          goalAmount: '600.00',
          due: {
            ...loan().due,
            payableSats: 268,
            payablePeople: 2,
            payableAmount: '15.00',
          },
        }),
      ],
    });
    expect(screen.getByText('₱45.00')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Send ₱45.00 · ₿804' })).toBeTruthy();
  });

  it('names each payable fiat currency with the bitcoin in the big due line and on Send', () => {
    show(
      {
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
      },
      repay(),
    );
    expect(screen.getByText("₱30.00 + $3.00 · ₿1'000")).toBeTruthy();
    expect(screen.getByRole('button', { name: "Send ₱30.00 + $3.00 · ₿1'000" })).toBeTruthy();
  });

  it('pays a known bitcoin due beside an unpriced fiat loan without rendering null', () => {
    const pay = vi.fn();
    show(
      {
        sundayRest: false,
        loans: [
          loan(),
          loan({
            messageId: 'unpriced',
            goalCurrency: 'PHP',
            goalAmount: '900.00',
            totalSats: null,
            maxSats: null,
            due: {
              ...loan().due,
              payableSats: null,
              payablePeople: 1,
              payableAmount: '30.00',
            },
          }),
        ],
      },
      repay({ pay }),
    );
    expect(screen.getByText("₿1'000")).toBeTruthy();
    expect(screen.getByText('$1.00')).toBeTruthy();
    expect(screen.queryByText(/null/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: "Send ₿1'000 · $1.00" }));
    expect(pay).toHaveBeenCalledWith(
      [expect.objectContaining({ messageId: 'loan-1' })],
      undefined,
      expect.any(Map),
    );
  });

  it('pays a priced fiat due beside an unpriced fiat loan', () => {
    const pay = vi.fn();
    show(
      {
        sundayRest: false,
        loans: [
          loan({
            messageId: 'priced',
            goalCurrency: 'PHP',
            goalAmount: '900.00',
            due: { ...loan().due, payableSats: 1_000, payableAmount: '30.00' },
          }),
          loan({
            messageId: 'unpriced',
            goalCurrency: 'PHP',
            goalAmount: '450.00',
            totalSats: null,
            maxSats: null,
            due: {
              ...loan().due,
              payableSats: null,
              payablePeople: 1,
              payableAmount: '15.00',
            },
          }),
        ],
      },
      repay({ pay }),
    );
    expect(screen.getByText("₱30.00 · ₿1'000")).toBeTruthy();
    expect(screen.getByText('₱15.00')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: "Send ₱30.00 · ₿1'000" }));
    expect(pay).toHaveBeenCalledWith(
      [expect.objectContaining({ messageId: 'priced' })],
      undefined,
      expect.any(Map),
    );
  });

  it('keeps priced and unpriced waiting parts on separate lines', () => {
    show({
      sundayRest: false,
      loans: [
        loan({
          messageId: 'priced',
          goalCurrency: 'PHP',
          goalAmount: '900.00',
          due: {
            ...loan().due,
            payableSats: 1_000,
            payableAmount: '30.00',
            waitingSats: 200,
            waitingPeople: 1,
            waitingAmount: '6.00',
          },
        }),
        loan({
          messageId: 'unpriced',
          goalCurrency: 'PHP',
          goalAmount: '450.00',
          totalSats: null,
          maxSats: null,
          due: {
            ...loan().due,
            payableSats: 0,
            payablePeople: 0,
            payableAmount: null,
            waitingSats: null,
            waitingPeople: 2,
            waitingAmount: '3.00',
          },
        }),
      ],
    });
    expect(screen.getByText(/^₱6\.00 · ₿200 waits for a lender/)).toBeTruthy();
    expect(screen.getByText(/^₱3\.00 waits for 2 lenders/)).toBeTruthy();
  });

  it('keeps unpriced payable and waiting amounts fiat-only beside known zeroes', () => {
    show({
      sundayRest: false,
      loans: [
        loan({
          messageId: 'unpriced',
          goalCurrency: 'PHP',
          goalAmount: '450.00',
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
    expect(screen.getByText(/₱15\.00 waits for a lender/)).toBeTruthy();
    expect(screen.queryByText(/₿0/)).toBeNull();
    expect(screen.queryByRole('button', { name: /^Send / })).toBeNull();
  });

  it('omits unavailable aggregate amounts instead of rendering null', () => {
    show(
      {
        sundayRest: false,
        loans: [
          loan({
            goalCurrency: 'PHP',
            goalAmount: '900.00',
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
          }),
        ],
      },
      repay(),
    );
    expect(screen.getByText('Due today')).toBeTruthy();
    expect(screen.queryByText(/null/)).toBeNull();
    expect(screen.queryByText(/waits for/)).toBeNull();
    expect(screen.queryByText(/^Next:/)).toBeNull();
    expect(screen.queryByRole('button', { name: /^Send/ })).toBeNull();
  });

  it('keeps a foreign-currency ledger amount out of the list, send-now link, and share map', async () => {
    const phpLoan = loan({
      goalCurrency: 'PHP',
      goalAmount: '900.00',
      due: { ...loan().due, payableSats: 1_000, payableAmount: '30.00' },
    });
    vi.mocked(getRepayment).mockResolvedValue(
      ledger({
        currency: 'USD',
        repayments: [{ ...ledger().repayments[0]!, amount: '1.00', sats: 90 }],
      }),
    );
    const pay = vi.fn();
    show({ sundayRest: false, loans: [phpLoan] }, repay({ balanceSats: 100, pay }));
    fireEvent.click(screen.getByRole('button', { name: 'Who gets paid' }));
    expect(await screen.findByText('₿90 · $0.09')).toBeTruthy();
    expect(screen.queryByText('₱1.00')).toBeNull();
    const sendNow = await screen.findByRole('button', { name: /Send ₿90 · \$0\.09 now to Bruno/ });
    expect(sendNow.textContent).not.toContain('₱1.00');
    fireEvent.click(sendNow);
    const amounts = pay.mock.calls[0]?.[2] as Map<string, string | null>;
    expect(amounts.get('loan-1:11:giver-1')).toBeNull();
  });

  it('uses the loan payable total for a full send when the ledger currency differs', async () => {
    const phpLoan = loan({
      goalCurrency: 'PHP',
      goalAmount: '900.00',
      due: { ...loan().due, payableSats: 1_000, payableAmount: '30.00' },
    });
    vi.mocked(getRepayment).mockResolvedValue(
      ledger({
        currency: 'USD',
        repayments: [{ ...ledger().repayments[0]!, amount: '1.00', sats: 90 }],
      }),
    );
    const pay = vi.fn();
    const view = show({ sundayRest: false, loans: [phpLoan] }, repay({ balanceSats: 2_000, pay }));
    fireEvent.click(screen.getByRole('button', { name: 'Who gets paid' }));
    expect(await screen.findByText('₿90 · $0.09')).toBeTruthy();
    const send = screen.getByRole('button', { name: "Send ₱30.00 · ₿1'000" });
    fireEvent.click(send);
    vi.mocked(useLoanRepay).mockReturnValue(repay({ balanceSats: 2_000, pay, phase: 'preparing' }));
    view.rerender(<LoanRepayScreen />);
    expect(screen.getByRole('status').textContent).toContain("Sending ₱30.00 · ₿1'000…");
    expect(screen.getByRole('status').textContent).not.toContain('₿90');
  });

  it('uses the loan payable total when due-share sats do not match it', async () => {
    const phpLoan = loan({
      goalCurrency: 'PHP',
      goalAmount: '900.00',
      due: { ...loan().due, payableSats: 1_000, payableAmount: '30.00' },
    });
    vi.mocked(getRepayment).mockResolvedValue(
      ledger({
        currency: 'PHP',
        repayments: [{ ...ledger().repayments[0]!, amount: '27.00', sats: 900 }],
      }),
    );
    show({ sundayRest: false, loans: [phpLoan] }, repay({ balanceSats: 2_000 }));
    fireEvent.click(screen.getByRole('button', { name: 'Who gets paid' }));
    expect(await screen.findByText('₱27.00')).toBeTruthy();
    expect(screen.getByRole('button', { name: "Send ₱30.00 · ₿1'000" })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Send ₱27.00 · ₿900' })).toBeNull();
  });

  it('puts a shared fiat loan currency first and shows waiting shares as neutral lines', async () => {
    const phpLoan = loan({
      goalCurrency: 'PHP',
      goalAmount: '900.00',
      due: {
        ...loan().due,
        payableSats: 536,
        payableAmount: '30.00',
        waitingSats: 200,
        waitingPeople: 1,
      },
    });
    vi.mocked(getRepayment).mockResolvedValue(
      ledger({
        currency: 'PHP',
        givers: [{ ...ledger().givers[0]!, canReceive: false }],
        repayments: [
          {
            ...ledger().repayments[0]!,
            amount: '10.00',
            sats: null,
            dueSats: 200,
          },
        ],
      }),
    );
    show({ sundayRest: false, loans: [phpLoan] });
    expect(screen.getByText('₱30.00')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Send ₱30.00 · ₿536' })).toBeTruthy();
    expect(screen.queryByText('$0.54')).toBeNull();
    const waitingNotice = screen.getByText(/waits for a lender/);
    expect(waitingNotice.className).toContain('text-app-muted');
    expect(waitingNotice.querySelector('svg')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Who gets paid' }));
    const waitingLine = await screen.findByText('Waiting for Bruno to set up their wallet');
    expect(waitingLine.className).toContain('text-app-muted');
    expect(waitingLine.closest('li')?.querySelector('svg')).toBeNull();
    expect(waitingLine.closest('li')?.className).not.toContain('app-danger');
    expect(screen.getByText('₱10.00').className).toContain('text-app-muted');
    expect(screen.queryByText('$0.20')).toBeNull();
  });

  it('shows a defined amount or a dash for recipient shares whose sats are unknown', async () => {
    const phpLoan = loan({
      goalCurrency: 'PHP',
      goalAmount: '900.00',
      due: { ...loan().due, payableSats: 500, payablePeople: 2, payableAmount: '30.00' },
    });
    vi.mocked(getRepayment).mockResolvedValue(
      ledger({
        currency: 'PHP',
        givers: [
          ledger().givers[0]!,
          { ...ledger().givers[0]!, accountId: 'giver-2', name: 'Carla' },
        ],
        repayments: [
          {
            ...ledger().repayments[0]!,
            dueOn: null,
            amount: '10.00',
            sats: null,
            dueSats: null,
          },
          {
            ...ledger().repayments[0]!,
            dueOn: '2026-10-10',
            accountId: 'giver-2',
            name: 'Carla',
            amount: null,
            sats: null,
            dueSats: null,
          },
        ],
      }),
    );
    show({ sundayRest: false, loans: [phpLoan] });
    fireEvent.click(screen.getByRole('button', { name: 'Who gets paid' }));
    expect(await screen.findByText('₱10.00')).toBeTruthy();
    expect(screen.getByText('–')).toBeTruthy();
    expect(screen.getByText('Carla').parentElement?.textContent).not.toContain('Oct');
  });

  it('opens top-up and can send the fitting prefix now', async () => {
    const state = repay({ balanceSats: 600 });
    vi.mocked(getRepayment).mockResolvedValue(
      ledger({
        givers: [
          ledger().givers[0]!,
          { ...ledger().givers[0]!, accountId: 'giver-2', name: 'Carla' },
        ],
        repayments: [
          { ...ledger().repayments[0]!, sats: 500 },
          { ...ledger().repayments[0]!, accountId: 'giver-2', name: 'Carla', sats: 500 },
        ],
      }),
    );
    const view = show({ sundayRest: false, loans: [loan()] }, state);
    expect(screen.getByText('Not enough in your wallet')).toBeTruthy();
    expect(screen.getByText(/Your wallet has ₿600 · \$0.60/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Top up your wallet' }));
    expect(state.openTopUp).toHaveBeenCalledTimes(1);
    const sendNow = await screen.findByRole('button', {
      name: /Send ₿500 · \$0\.50 now to Bruno/,
    });
    expect(sendNow.className).toContain('inline-flex');
    expect(sendNow.className).toContain('min-h-11');
    expect(sendNow.className).toContain('items-center');
    expect(sendNow.className).toContain('justify-center');
    fireEvent.click(sendNow);
    expect(state.pay).toHaveBeenCalledWith(
      expect.any(Array),
      new Set(['loan-1:11:giver-1']),
      expect.any(Map),
    );
    vi.mocked(useLoanRepay).mockReturnValue({ ...state, phase: 'preparing' });
    view.rerender(<LoanRepayScreen />);
    expect(screen.getByRole('status').textContent).toContain('Sending ₿500 · $0.50…');
    cleanup();
    show({ sundayRest: false, loans: [loan()] }, repay({ balanceSats: 600, topUpOpen: true }));
    expect(screen.getByTestId('own-address').textContent).toBe('ada:true');
    expect(screen.getByRole('status').textContent).toBe('Waiting for your top-up…');
    cleanup();
    useAuthStore.setState({ session: 'token', account: { username: null } as never });
    show(
      { sundayRest: false, loans: [loan()] },
      repay({ balanceSats: 600, missingSats: 700, topUpOpen: true }),
    );
    expect(screen.queryByTestId('own-address')).toBeNull();
    expect(screen.getByText(/Still missing ₿700 · \$0.70/)).toBeTruthy();
    expect(screen.getByRole('status').textContent).toBe('Waiting for your top-up…');
    expect(screen.queryByRole('button', { name: /now to/ })).toBeNull();
    cleanup();
    useAuthStore.setState({ session: 'token', account: {} as never });
    show({ sundayRest: false, loans: [loan()] }, repay({ balanceSats: 600, topUpOpen: true }));
    expect(screen.queryByTestId('own-address')).toBeNull();
  });

  it('caps the send-now set at 60 shares of one loan', async () => {
    const state = repay({ balanceSats: 6_500 });
    const dueRow = ledger().repayments[0]!;
    vi.mocked(getRepayment).mockResolvedValue(
      ledger({
        repayments: Array.from({ length: 61 }, (_, index) => ({
          ...dueRow,
          dayIndex: index,
          accountId: `giver-${index}`,
          name: 'Bruno',
          sats: 100,
        })),
      }),
    );
    show(
      {
        sundayRest: false,
        loans: [loan({ due: { ...loan().due, payableSats: 7_000, payablePeople: 61 } })],
      },
      state,
    );
    const sendNow = await screen.findByRole('button', { name: /now to/ });
    fireEvent.click(sendNow);
    expect(state.pay).toHaveBeenCalledWith(
      expect.any(Array),
      new Set(Array.from({ length: 60 }, (_, index) => `loan-1:${index}:giver-${index}`)),
      expect.any(Map),
    );
  });

  it('names and counts only the 60 shares a full PHP send can request', async () => {
    const pay = vi.fn();
    const dueRow = ledger().repayments[0]!;
    vi.mocked(getRepayment).mockResolvedValue(
      ledger({
        currency: 'PHP',
        repayments: Array.from({ length: 61 }, (_, index) => ({
          ...dueRow,
          dayIndex: index,
          accountId: `giver-${index}`,
          name: 'Bruno',
          amount: '1.00',
          sats: 100,
        })),
      }),
    );
    const view = show(
      {
        sundayRest: false,
        loans: [
          loan({
            goalCurrency: 'PHP',
            goalAmount: '900.00',
            due: { ...loan().due, payableSats: 6_100, payablePeople: 61, payableAmount: '61.00' },
          }),
        ],
      },
      repay({ balanceSats: 7_000, pay }),
    );
    const send = await screen.findByRole('button', { name: "Send ₱60.00 · ₿6'000" });
    expect(screen.queryByRole('button', { name: "Send ₱61.00 · ₿6'100" })).toBeNull();
    fireEvent.click(send);
    expect(pay).toHaveBeenCalledWith(
      [expect.objectContaining({ messageId: 'loan-1' })],
      undefined,
      expect.any(Map),
    );
    vi.mocked(useLoanRepay).mockReturnValue(repay({ balanceSats: 7_000, pay, phase: 'preparing' }));
    view.rerender(<LoanRepayScreen />);
    expect(screen.getByRole('status').textContent).toContain("Sending ₱60.00 · ₿6'000…");
    expect(screen.getByRole('status').textContent).not.toContain("₿6'100");
  });

  it('keeps the summary payable when a due share has no known sats', () => {
    vi.mocked(getRepayment).mockResolvedValue(
      ledger({
        repayments: [{ ...ledger().repayments[0]!, sats: null, dueSats: null }],
      }),
    );
    show(
      {
        sundayRest: false,
        loans: [loan({ due: { ...loan().due, payableSats: 1_000, payableAmount: '30.00' } })],
      },
      repay({ balanceSats: 2_000 }),
    );
    expect(screen.getByRole('button', { name: "Send ₿1'000 · $1.00" })).toBeTruthy();
  });

  it('keeps the loan payable amount and bitcoin when a loaded ledger has no due rows', async () => {
    vi.mocked(getRepayment).mockResolvedValue(
      ledger({
        currency: 'PHP',
        repayments: [{ ...ledger().repayments[0]!, status: 'paid', amount: '30.00' }],
      }),
    );
    show(
      {
        sundayRest: false,
        loans: [
          loan({
            goalCurrency: 'PHP',
            goalAmount: '900.00',
            due: { ...loan().due, payableSats: 1_000, payableAmount: '30.00' },
          }),
        ],
      },
      repay({ balanceSats: 2_000 }),
    );
    expect(screen.getByText('₱30.00')).toBeTruthy();
    await waitFor(() => expect(getRepayment).toHaveBeenCalledWith('loan-1'));
    fireEvent.click(screen.getByRole('button', { name: 'Who gets paid' }));
    await waitFor(() => expect(screen.queryByRole('status')).toBeNull());
    expect(screen.queryByText('Bruno')).toBeNull();
    expect(screen.getByRole('button', { name: "Send ₱30.00 · ₿1'000" })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Send ₿0 · $0.00' })).toBeNull();
  });

  it('keeps both payable loans in a full send when one loaded ledger has no due rows', async () => {
    vi.mocked(getRepayment).mockImplementation(async (id) =>
      id === 'php-1'
        ? ledger({
            currency: 'PHP',
            repayments: [
              { ...ledger().repayments[0]!, amount: '30.00', sats: 1_000, dueSats: null },
            ],
          })
        : ledger({ currency: 'PHP', repayments: [] }),
    );
    const state = repay({ balanceSats: 2_000 });
    const view = show(
      {
        sundayRest: false,
        loans: [
          loan({
            messageId: 'php-1',
            goalCurrency: 'PHP',
            goalAmount: '900.00',
            due: { ...loan().due, payableSats: 1_000, payableAmount: '30.00' },
          }),
          loan({
            messageId: 'php-2',
            goalCurrency: 'PHP',
            goalAmount: '450.00',
            due: { ...loan().due, payableSats: 500, payableAmount: '15.00' },
          }),
        ],
      },
      state,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Who gets paid' }));
    await waitFor(() => expect(screen.queryByRole('status')).toBeNull());
    const send = screen.getByRole('button', { name: "Send ₱45.00 · ₿1'500" });
    expect(screen.queryByRole('button', { name: "Send ₱30.00 · ₿1'000" })).toBeNull();
    fireEvent.click(send);
    vi.mocked(useLoanRepay).mockReturnValue(
      repay({ balanceSats: 2_000, phase: 'preparing', pay: state.pay }),
    );
    view.rerender(<LoanRepayScreen />);
    expect(screen.getByRole('status').textContent).toContain("Sending ₱45.00 · ₿1'500…");
  });

  it('hides send-now when a loan repayment list has not loaded', async () => {
    vi.mocked(getRepayment).mockImplementation(async (id) =>
      id === 'loan-1'
        ? ledger({
            repayments: [{ ...ledger().repayments[0]!, sats: 500 }],
          })
        : null,
    );
    show(
      { sundayRest: false, loans: [loan(), loan({ messageId: 'loan-2' })] },
      repay({ balanceSats: 600 }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Who gets paid' }));
    expect(await screen.findByText('Bruno')).toBeTruthy();
    expect(screen.getByText('Not enough in your wallet')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /now to/ })).toBeNull();
  });

  it('shows a loading line in the opened list while a repayment list is pending', () => {
    vi.mocked(getRepayment).mockImplementation(() => new Promise(() => undefined));
    show({ sundayRest: false, loans: [loan()] });
    fireEvent.click(screen.getByRole('button', { name: 'Who gets paid' }));
    const status = screen.getByRole('status');
    expect(status.textContent).toBe('Loading who gets paid…');
    expect(status.className).toContain('text-app-muted');
    const spinner = status.querySelector('svg');
    expect(spinner?.getAttribute('class')).toContain('h-4');
    expect(spinner?.getAttribute('class')).toContain('animate-spin');
    expect(spinner?.getAttribute('aria-hidden')).toBe('true');
  });

  it('shows an error line in the opened list when a repayment list failed', async () => {
    vi.mocked(getRepayment).mockResolvedValue(null);
    show({ sundayRest: false, loans: [loan()] });
    fireEvent.click(screen.getByRole('button', { name: 'Who gets paid' }));
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toBe('Could not load who gets paid for this loan.');
    expect(alert.className).toContain('text-app-danger');
  });

  it('shows an error line for an unpriced fiat payable share without a repayment list', async () => {
    vi.mocked(getRepayment).mockResolvedValue(null);
    show({
      sundayRest: false,
      loans: [
        loan({
          goalCurrency: 'PHP',
          goalAmount: '900.00',
          due: {
            ...loan().due,
            payableSats: null,
            payablePeople: 1,
            payableAmount: '30.00',
            waitingSats: null,
            waitingPeople: 0,
            waitingAmount: null,
          },
        }),
      ],
    });
    const whoButton = screen.getByRole('button', { name: 'Who gets paid' });
    fireEvent.click(whoButton);
    const whoList = document.getElementById(whoButton.getAttribute('aria-controls')!);
    expect(whoList).not.toBeNull();
    const alert = await within(whoList!).findByRole('alert');
    expect(alert.textContent).toBe('Could not load who gets paid for this loan.');
    expect(alert.className).toContain('text-app-danger');
  });

  it('shows an error line for an unpriced fiat waiting share without a repayment list', async () => {
    vi.mocked(getRepayment).mockResolvedValue(null);
    show({
      sundayRest: false,
      loans: [
        loan({
          goalCurrency: 'PHP',
          goalAmount: '900.00',
          due: {
            ...loan().due,
            payableSats: null,
            payablePeople: 0,
            payableAmount: null,
            waitingSats: null,
            waitingPeople: 1,
            waitingAmount: '15.00',
          },
        }),
      ],
    });
    const whoButton = screen.getByRole('button', { name: 'Who gets paid' });
    fireEvent.click(whoButton);
    const whoList = document.getElementById(whoButton.getAttribute('aria-controls')!);
    expect(whoList).not.toBeNull();
    const alert = await within(whoList!).findByRole('alert');
    expect(alert.textContent).toBe('Could not load who gets paid for this loan.');
    expect(alert.className).toContain('text-app-danger');
  });

  it('shows an error line for a priced waiting share without a repayment list', async () => {
    vi.mocked(getRepayment).mockResolvedValue(null);
    show({
      sundayRest: false,
      loans: [
        loan({
          due: {
            ...loan().due,
            payableSats: 0,
            payablePeople: 0,
            waitingSats: 500,
            waitingPeople: 1,
          },
        }),
      ],
    });
    const whoButton = screen.getByRole('button', { name: 'Who gets paid' });
    fireEvent.click(whoButton);
    const whoList = document.getElementById(whoButton.getAttribute('aria-controls')!);
    expect(whoList).not.toBeNull();
    const alert = await within(whoList!).findByRole('alert');
    expect(alert.textContent).toBe('Could not load who gets paid for this loan.');
    expect(alert.className).toContain('text-app-danger');
  });

  it('shows a failed list at once while a sibling list is still pending', async () => {
    vi.mocked(getRepayment).mockImplementation((id) =>
      id === 'loan-1' ? new Promise(() => undefined) : Promise.resolve(null),
    );
    show({
      sundayRest: false,
      loans: [loan(), loan({ messageId: 'loan-2', text: 'School books for my daughter' })],
    });
    fireEvent.click(screen.getByRole('button', { name: 'Who gets paid' }));
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toBe('Could not load who gets paid for this loan.');
    expect(screen.getByRole('status').textContent).toBe('Loading who gets paid…');
  });

  it('shows rows for a loaded loan and an error line for a failed ledger', async () => {
    vi.mocked(getRepayment).mockImplementation(async (id) => (id === 'loan-1' ? ledger() : null));
    show({
      sundayRest: false,
      loans: [
        loan(),
        loan({ messageId: 'loan-2', text: 'School books for my daughter' }),
        loan({
          messageId: 'loan-3',
          text: 'Still collecting gifts',
          fundedAt: null,
          sats: 12_000,
          due: { ...loan().due, payableSats: 0, payablePeople: 0 },
        }),
      ],
    });
    fireEvent.click(screen.getByRole('button', { name: 'Who gets paid' }));
    expect(await screen.findByText('Bruno')).toBeTruthy();
    const whoList = document.getElementById(
      screen.getByRole('button', { name: 'Who gets paid' }).getAttribute('aria-controls')!,
    );
    expect(whoList).not.toBeNull();
    expect(within(whoList!).getByText('A sewing machine for my repair stall')).toBeTruthy();
    expect(within(whoList!).getByText('School books for my daughter')).toBeTruthy();
    expect(within(whoList!).getByRole('alert').textContent).toBe(
      'Could not load who gets paid for this loan.',
    );
    expect(within(whoList!).queryByText('Still collecting gifts')).toBeNull();
  });

  it('shows the fee shortfall and top-up without send-now when the amount fits', () => {
    const state = repay({ balanceSats: 1_000, missingSats: 25 });
    show({ sundayRest: false, loans: [loan()] }, state);
    expect(screen.getByText('Not enough in your wallet')).toBeTruthy();
    expect(screen.getByText(/Still missing ₿25 · \$0.03/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Top up your wallet' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^Send ₿/ })).toBeNull();
  });

  it('keeps due and pay-more shortfalls with their own flows', () => {
    show(
      {
        sundayRest: false,
        loans: [
          loan({
            due: {
              ...loan().due,
              payableSats: 3_000,
            },
          }),
        ],
      },
      repay({
        activeAction: { kind: 'prepay', messageId: 'loan-1' },
        balanceSats: 500,
        missingSats: 500,
      }),
    );
    expect(screen.getByText(/Still missing ₿2'500 · \$2.50/)).toBeTruthy();
    expect(screen.getByText(/Still missing ₿500 · \$0.50/)).toBeTruthy();
  });

  it('transfers an open pay-more top-up to due after the draft is edited', () => {
    const data = {
      sundayRest: false,
      loans: [loan({ due: { ...loan().due, payableSats: 3_000 } })],
    };
    const state = repay({ balanceSats: 500 });
    const view = show(data, state);
    const input = screen.getByLabelText('Amount (₿)');
    fireEvent.change(input, { target: { value: '1000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Pay this amount' }));

    const shortfallState = repay({
      activeAction: { kind: 'prepay', messageId: 'loan-1' },
      balanceSats: 500,
      missingSats: 500,
    });
    vi.mocked(useLoanRepay).mockReturnValue(shortfallState);
    view.rerender(<LoanRepayScreen />);
    fireEvent.click(screen.getAllByRole('button', { name: 'Top up your wallet' })[1]!);

    vi.mocked(useLoanRepay).mockReturnValue({ ...shortfallState, topUpOpen: true });
    view.rerender(<LoanRepayScreen />);
    expect(screen.getByTestId('own-address').textContent).toBe('ada:true');

    fireEvent.change(input, { target: { value: '400' } });
    expect(screen.queryByTestId('own-address')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Top up your wallet' }));

    expect(screen.getByTestId('own-address').textContent).toBe('ada:true');
    expect(shortfallState.openTopUp).toHaveBeenCalledTimes(2);
  });

  it('names a waiting fiat share by its stored figure', () => {
    vi.mocked(getRepayment).mockResolvedValue(null);
    show({
      sundayRest: false,
      loans: [
        loan({
          goalCurrency: 'PHP',
          goalAmount: '900.00',
          due: {
            ...loan().due,
            payableSats: 536,
            payableAmount: '30.00',
            waitingSats: 200,
            waitingPeople: 1,
            waitingAmount: '10.00',
          },
        }),
      ],
    });
    expect(screen.getByText(/^₱10\.00 · ₿200 waits for a lender/)).toBeTruthy();
    expect(screen.queryByText(/\$0\.20 waits/)).toBeNull();
  });

  it('shows a PHP loan repaid from the stored paid amounts of its ledger', async () => {
    vi.mocked(getRepayment).mockResolvedValue(
      ledger({
        currency: 'PHP',
        repayments: [
          {
            ...ledger().repayments[0]!,
            dayIndex: 0,
            status: 'paid',
            amount: '30.00',
            sats: 3_000,
            dueSats: null,
          },
          {
            ...ledger().repayments[0]!,
            dayIndex: 1,
            status: 'paid',
            amount: '29.99',
            sats: 2_999,
            dueSats: null,
          },
          {
            ...ledger().repayments[0]!,
            dayIndex: 2,
            status: 'due',
            amount: '30.00',
          },
        ],
      }),
    );
    show({
      sundayRest: false,
      loans: [
        loan({
          goalCurrency: 'PHP',
          goalAmount: '900.00',
          repaidSats: 5_999,
          due: { ...loan().due, payableSats: 1_000, payableAmount: '30.00' },
        }),
      ],
    });
    expect(await screen.findByText("Repaid ₱59.99 · ₿5'999 of ₱900.00")).toBeTruthy();
    expect(screen.queryByText('Repaid ₱59.99 of ₱900.00')).toBeNull();
    expect(screen.queryByText("Repaid ₿5'999 · $6.00 of ₱900.00")).toBeNull();
    cleanup();
    vi.mocked(getRepayment).mockResolvedValue(null);
    show({
      sundayRest: false,
      loans: [loan({ goalCurrency: 'PHP', goalAmount: '900.00', repaidSats: 5_999 })],
    });
    fireEvent.click(screen.getByRole('button', { name: 'Who gets paid' }));
    expect(await screen.findByText('Could not load who gets paid for this loan.')).toBeTruthy();
    expect(screen.queryByText(/Repaid ₱/)).toBeNull();
    expect(screen.getByText("Repaid ₿5'999 · $6.00 of ₱900.00")).toBeTruthy();
  });

  it('shows stored paid fiat while the paid sats still match repaidSats', async () => {
    vi.mocked(getRepayment).mockResolvedValue(
      ledger({
        currency: 'PHP',
        repayments: [
          {
            ...ledger().repayments[0]!,
            dayIndex: 0,
            status: 'paid',
            amount: '59.99',
            sats: 5_999,
            paidSats: 1_000,
            paidAmount: '10.00',
            dueSats: null,
          },
        ],
      }),
    );
    show({
      sundayRest: false,
      loans: [loan({ goalCurrency: 'PHP', goalAmount: '900.00', repaidSats: 5_999 })],
    });
    expect(await screen.findByText("Repaid ₱59.99 · ₿5'999 of ₱900.00")).toBeTruthy();
  });

  it('includes stored partial payments from due and scheduled rows in Repaid', async () => {
    vi.mocked(getRepayment).mockResolvedValue(
      ledger({
        currency: 'PHP',
        repayments: [
          {
            ...ledger().repayments[0]!,
            dayIndex: 0,
            status: 'due',
            amount: '30.00',
            sats: 3_000,
            paidSats: 1_000,
            paidAmount: '10.00',
            dueSats: 2_000,
          },
          {
            ...ledger().repayments[0]!,
            dayIndex: 1,
            status: 'scheduled',
            amount: '49.99',
            sats: 4_999,
            paidSats: 4_999,
            paidAmount: '49.99',
            dueSats: null,
          },
        ],
      }),
    );
    show({
      sundayRest: false,
      loans: [loan({ goalCurrency: 'PHP', goalAmount: '900.00', repaidSats: 5_999 })],
    });
    expect(await screen.findByText("Repaid ₱59.99 · ₿5'999 of ₱900.00")).toBeTruthy();
  });

  it.each([
    [
      'satoshi',
      {
        sats: 5_000,
        paidSats: 5_999,
        amount: '59.99',
        paidAmount: '59.99',
      },
    ],
    [
      'fiat',
      {
        sats: 5_999,
        paidSats: 5_999,
        amount: '50.00',
        paidAmount: '59.99',
      },
    ],
  ] as const)('falls back from an overpaid partial %s relationship', async (_kind, partial) => {
    vi.mocked(getRepayment).mockResolvedValue(
      ledger({
        currency: 'PHP',
        repayments: [
          {
            ...ledger().repayments[0]!,
            dayIndex: 0,
            status: 'due',
            dueSats: 0,
            ...partial,
          },
        ],
      }),
    );
    show({
      sundayRest: false,
      loans: [loan({ goalCurrency: 'PHP', goalAmount: '900.00', repaidSats: 5_999 })],
    });

    expect(await screen.findByText("Repaid ₿5'999 · $6.00 of ₱900.00")).toBeTruthy();
    expect(screen.queryByText(/Repaid ₱/)).toBeNull();
  });

  it('falls back when a partial unpaid-status row has no stored paid amount', async () => {
    vi.mocked(getRepayment).mockResolvedValue(
      ledger({
        currency: 'PHP',
        repayments: [
          {
            ...ledger().repayments[0]!,
            dayIndex: 0,
            status: 'due',
            amount: '60.00',
            sats: 6_000,
            paidSats: 5_999,
            paidAmount: null,
            dueSats: 1,
          },
        ],
      }),
    );
    show({
      sundayRest: false,
      loans: [loan({ goalCurrency: 'PHP', goalAmount: '900.00', repaidSats: 5_999 })],
    });
    fireEvent.click(screen.getByRole('button', { name: 'Who gets paid' }));
    expect(await screen.findByText('Bruno')).toBeTruthy();
    expect(screen.queryByText(/Repaid ₱/)).toBeNull();
    expect(screen.getByText("Repaid ₿5'999 · $6.00 of ₱900.00")).toBeTruthy();
  });

  it('falls back to bitcoin and spot when a paid ledger row has no sats', async () => {
    vi.mocked(getRepayment).mockResolvedValue(
      ledger({
        currency: 'PHP',
        repayments: [
          {
            ...ledger().repayments[0]!,
            dayIndex: 0,
            status: 'paid',
            amount: '59.99',
            sats: null,
            dueSats: null,
          },
          { ...ledger().repayments[0]!, dayIndex: 3, status: 'due' },
        ],
      }),
    );
    show({
      sundayRest: false,
      loans: [loan({ goalCurrency: 'PHP', goalAmount: '900.00', repaidSats: 5_999 })],
    });
    fireEvent.click(screen.getByRole('button', { name: 'Who gets paid' }));
    expect(await screen.findByText('Bruno')).toBeTruthy();
    expect(screen.queryByText(/Repaid ₱/)).toBeNull();
    expect(screen.getByText("Repaid ₿5'999 · $6.00 of ₱900.00")).toBeTruthy();
  });

  it('falls back while the paid ledger sats do not match repaidSats', async () => {
    vi.mocked(getRepayment).mockResolvedValue(
      ledger({
        currency: 'PHP',
        repayments: [
          {
            ...ledger().repayments[0]!,
            dayIndex: 0,
            status: 'paid',
            amount: '59.99',
            sats: 5_000,
            dueSats: null,
          },
          { ...ledger().repayments[0]!, dayIndex: 3, status: 'due' },
        ],
      }),
    );
    show({
      sundayRest: false,
      loans: [loan({ goalCurrency: 'PHP', goalAmount: '900.00', repaidSats: 5_999 })],
    });
    fireEvent.click(screen.getByRole('button', { name: 'Who gets paid' }));
    expect(await screen.findByText('Bruno')).toBeTruthy();
    expect(screen.queryByText("Repaid ₱59.99 · ₿5'999 of ₱900.00")).toBeNull();
    expect(screen.getByText("Repaid ₿5'999 · $6.00 of ₱900.00")).toBeTruthy();
  });

  it('falls back to bitcoin for a PHP loan whose ledger uses another currency', async () => {
    vi.mocked(getRepayment).mockResolvedValue(
      ledger({
        currency: 'USD',
        repayments: [
          {
            ...ledger().repayments[0]!,
            dayIndex: 0,
            status: 'paid',
            amount: '59.99',
            sats: 5_999,
            dueSats: null,
          },
          { ...ledger().repayments[0]!, dayIndex: 3, status: 'due' },
        ],
      }),
    );
    show({
      sundayRest: false,
      loans: [loan({ goalCurrency: 'PHP', goalAmount: '900.00', repaidSats: 5_999 })],
    });
    fireEvent.click(screen.getByRole('button', { name: 'Who gets paid' }));
    expect(await screen.findByText('Bruno')).toBeTruthy();
    expect(screen.queryByText("Repaid ₱59.99 · ₿5'999 of ₱900.00")).toBeNull();
    expect(screen.getByText("Repaid ₿5'999 · $6.00 of ₱900.00")).toBeTruthy();
  });

  it('falls back to bitcoin for a PHP loan without a ledger or with a missing amount', async () => {
    vi.mocked(getRepayment).mockResolvedValue(null);
    show({
      sundayRest: false,
      loans: [loan({ goalCurrency: 'PHP', goalAmount: '900.00', repaidSats: 5_999 })],
    });
    fireEvent.click(screen.getByRole('button', { name: 'Who gets paid' }));
    expect(await screen.findByText('Could not load who gets paid for this loan.')).toBeTruthy();
    expect(screen.queryByText(/Repaid ₱/)).toBeNull();
    expect(screen.getByText("Repaid ₿5'999 · $6.00 of ₱900.00")).toBeTruthy();
    cleanup();
    vi.mocked(getRepayment).mockResolvedValue(
      ledger({
        currency: 'PHP',
        repayments: [
          {
            ...ledger().repayments[0]!,
            dayIndex: 0,
            status: 'paid',
            amount: null,
            sats: 5_999,
            dueSats: null,
          },
          { ...ledger().repayments[0]!, dayIndex: 3, status: 'due' },
        ],
      }),
    );
    show({
      sundayRest: false,
      loans: [loan({ goalCurrency: 'PHP', goalAmount: '900.00', repaidSats: 5_999 })],
    });
    fireEvent.click(screen.getByRole('button', { name: 'Who gets paid' }));
    expect(await screen.findByText('Bruno')).toBeTruthy();
    expect(screen.queryByText(/Repaid ₱/)).toBeNull();
    expect(screen.getByText("Repaid ₿5'999 · $6.00 of ₱900.00")).toBeTruthy();
  });

  it('shows the stored next amount beside the next bitcoin amount', () => {
    vi.mocked(getRepayment).mockImplementation(() => new Promise(() => undefined));
    show({
      sundayRest: false,
      loans: [
        loan({
          goalCurrency: 'PHP',
          due: { ...loan().due, payableSats: 0, payablePeople: 0 },
          next: { dueOn: '2026-10-11', sats: 1_000, amount: '199.99' },
        }),
      ],
    });
    expect(screen.getByText("Next: tomorrow, ₱199.99 · ₿1'000")).toBeTruthy();
  });

  it('asks for no amount when every due share waits', () => {
    vi.mocked(getRepayment).mockResolvedValue(null);
    show({
      sundayRest: false,
      loans: [
        loan({
          due: {
            ...loan().due,
            payableSats: 0,
            payablePeople: 0,
            waitingSats: 1_000,
            waitingPeople: 2,
          },
        }),
      ],
    });
    expect(screen.getByText(/Your lenders haven't set up/)).toBeTruthy();
    expect(screen.getByText('Nothing to send now').className).toContain('text-app-fg');
    expect(screen.queryByRole('button', { name: /^Send ₿/ })).toBeNull();
    expect(screen.queryByText("₿1'000")).toBeNull();
    expect(screen.queryByText(/^to \d+ people$/)).toBeNull();
  });

  it('names the stored amount of the fitting shares in the send-now link', async () => {
    const dueRow = ledger().repayments[0]!;
    const carla = {
      ...ledger().givers[0]!,
      accountId: 'giver-2',
      name: 'Carla',
      username: 'carla',
    };
    vi.mocked(getRepayment).mockResolvedValue(
      ledger({
        currency: 'PHP',
        givers: [ledger().givers[0]!, carla],
        repayments: [
          { ...dueRow, amount: '18.00', sats: 500, dueSats: null },
          {
            ...dueRow,
            accountId: 'giver-2',
            name: 'Carla',
            username: 'carla',
            amount: '18.00',
            sats: 500,
            dueSats: null,
          },
        ],
      }),
    );
    show(
      {
        sundayRest: false,
        loans: [
          loan({
            goalCurrency: 'PHP',
            goalAmount: '900.00',
            due: { ...loan().due, payableSats: 1_000, payableAmount: '36.00' },
          }),
        ],
      },
      repay({ balanceSats: 600 }),
    );
    expect(
      await screen.findByRole('button', {
        name: 'Send ₱18.00 · ₿500 now to Bruno, the rest after your top-up',
      }),
    ).toBeTruthy();
    cleanup();
    vi.mocked(getRepayment).mockResolvedValue(
      ledger({
        currency: 'PHP',
        givers: [ledger().givers[0]!, carla],
        repayments: [
          { ...dueRow, amount: null, sats: 500, dueSats: null },
          {
            ...dueRow,
            accountId: 'giver-2',
            name: 'Carla',
            username: 'carla',
            amount: null,
            sats: 500,
            dueSats: null,
          },
        ],
      }),
    );
    show(
      {
        sundayRest: false,
        loans: [
          loan({
            goalCurrency: 'PHP',
            goalAmount: '900.00',
            due: { ...loan().due, payableSats: 1_000, payableAmount: '36.00' },
          }),
        ],
      },
      repay({ balanceSats: 600 }),
    );
    expect(
      await screen.findByRole('button', {
        name: 'Send ₿500 · $0.50 now to Bruno, the rest after your top-up',
      }),
    ).toBeTruthy();
  });

  it('follows the api days behind and counts the summary people without ledgers', () => {
    vi.mocked(getRepayment).mockResolvedValue(null);
    show({
      sundayRest: false,
      loans: [
        loan({
          due: {
            ...loan().due,
            payableSats: 300,
            payablePeople: 3,
            waitingSats: 1_000,
            waitingPeople: 2,
            waitingShares: 4,
            behindDays: 0,
          },
        }),
      ],
    });
    expect(screen.getByText('Due today')).toBeTruthy();
    expect(screen.queryByText(/behind/)).toBeNull();
    expect(screen.getByText('to 3 people')).toBeTruthy();
  });

  it('uses the singular all-waiting notice and the plural partial-waiting notice', () => {
    show({
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
        }),
      ],
    });
    expect(screen.getByText(/Your lender hasn't set up/)).toBeTruthy();
    cleanup();
    show({
      sundayRest: false,
      loans: [
        loan({
          due: { ...loan().due, waitingSats: 400, waitingPeople: 2 },
        }),
      ],
    });
    expect(screen.getByText(/waits for 2 lenders/)).toBeTruthy();
  });

  it('shows priced waiting sats even when the summary has no waiting people', () => {
    show({
      sundayRest: false,
      loans: [
        loan({
          due: {
            ...loan().due,
            waitingSats: 200,
            waitingPeople: 0,
          },
        }),
      ],
    });
    expect(screen.getByText(/₿200 · \$0\.20 waits for 0 lenders/)).toBeTruthy();
  });

  it.each([
    ['unavailable', 'Your 21.gifts wallet is not available here'],
    ['connecting', 'Checking your wallet…'],
    ['preparing', "Sending ₿1'000 · $1.00…"],
    ['sending', "Sending ₿1'000 · $1.00…"],
    ['waiting', "Sending ₿1'000 · $1.00…"],
    ['unconfirmed', 'This payment is not confirmed yet'],
  ] as const)('shows the %s payment state', (phase, text) => {
    show({ sundayRest: false, loans: [loan()] }, repay({ phase }));
    expect(screen.getByRole('status').textContent).toContain(text);
  });

  it.each(['unconfirmed', 'failed'] as const)(
    'keeps due controls idle during a %s pay-more run',
    (phase) => {
      show(
        { sundayRest: false, loans: [loan()] },
        repay({ phase, activeAction: { kind: 'prepay', messageId: 'loan-1' } }),
      );
      expect(screen.getByRole('button', { name: "Send ₿1'000 · $1.00" })).toBeTruthy();
    },
  );

  it('names the defined peso amount while that loan payment is sending', () => {
    const phpLoan = loan({
      goalCurrency: 'PHP',
      goalAmount: '900.00',
      due: { ...loan().due, payableSats: 536, payableAmount: '30.00' },
    });
    show({ sundayRest: false, loans: [phpLoan] }, repay({ phase: 'sending' }));
    expect(screen.getByRole('status').textContent).toContain('Sending ₱30.00 · ₿536…');
    cleanup();
    const view = show({ sundayRest: false, loans: [phpLoan] });
    fireEvent.click(screen.getByRole('button', { name: 'Send ₱30.00 · ₿536' }));
    vi.mocked(useLoanRepay).mockReturnValue(repay({ phase: 'sending' }));
    view.rerender(<LoanRepayScreen />);
    expect(screen.getByRole('status').textContent).toContain('Sending ₱30.00 · ₿536…');
  });

  it('names mixed stored amounts while a multi-currency payment is sending', () => {
    const phpLoan = loan({
      messageId: 'php',
      goalCurrency: 'PHP',
      goalAmount: '900.00',
      due: { ...loan().due, payableSats: 536, payableAmount: '30.00' },
    });
    const usdLoan = loan({
      messageId: 'usd',
      goalCurrency: 'USD',
      goalAmount: '900.00',
      due: { ...loan().due, payableSats: 464, payableAmount: '3.00' },
    });
    show({ sundayRest: false, loans: [phpLoan, usdLoan] }, repay({ phase: 'sending' }));
    expect(screen.getByRole('status').textContent).toContain("Sending ₱30.00 + $3.00 · ₿1'000…");
  });

  it('shows setup failure and a failed run with retry controls', () => {
    show({ sundayRest: false, loans: [loan()] }, repay({ phase: 'setupFailed' }));
    expect(screen.getByRole('alert').textContent).toBe('Wallet setup failed');
    cleanup();
    const state = repay({
      phase: 'failed',
      errorKey: 'forum.payErrorRateLimit',
      sentSats: 500,
      sentNames: ['Bruno'],
    });
    show({ sundayRest: false, loans: [loan()] }, state);
    expect(screen.getByText('Still due today')).toBeTruthy();
    expect(screen.getByText(/Sent ₿500 · \$0\.50 to Bruno/)).toBeTruthy();
    expect(screen.getByRole('alert')).toBeTruthy();
    expect(screen.getByRole('button', { name: /^Send ₿/ })).toBeTruthy();
  });

  it('uses the default payment error for a failed run without an error key', () => {
    show({ sundayRest: false, loans: [loan()] }, repay({ phase: 'failed' }));
    expect(screen.getByRole('alert').textContent).toBe('Could not start the Bitcoin payment');
    expect(screen.getByRole('button', { name: /^Send ₿/ })).toBeTruthy();
  });

  it('treats a zero-send repaid run as idle and waits when the balance is unknown', () => {
    show({ sundayRest: false, loans: [loan()] }, repay({ phase: 'repaid', sentSats: 0 }));
    expect(screen.getByRole('button', { name: /^Send ₿/ })).toBeTruthy();
    expect(screen.queryByText("Repaid ₿1'000 · $1.00")).toBeNull();
    cleanup();
    show({ sundayRest: false, loans: [loan()] }, repay({ balanceSats: null }));
    expect(screen.queryByRole('button', { name: /^Send ₿/ })).toBeNull();
    expect(screen.queryByText(/From your wallet/)).toBeNull();
  });

  it('shows behind and last-payment headings before payment', () => {
    show({
      sundayRest: false,
      loans: [loan({ due: { ...loan().due, behindDays: 1 } })],
    });
    expect(screen.getByText("You're 1 day behind").className).toContain('text-app-danger');
    cleanup();
    show({
      sundayRest: false,
      loans: [loan({ due: { ...loan().due, lastPayment: true } })],
    });
    expect(screen.getByText('Due today · last payment')).toBeTruthy();
    cleanup();
    show({
      sundayRest: false,
      loans: [loan({ due: { ...loan().due, behindDays: 2 } })],
    });
    expect(screen.getByText("You're 2 days behind")).toBeTruthy();
  });

  it('shows Sunday rest and the nothing-due success with tomorrow people', async () => {
    show({ sundayRest: true, loans: [loan()] });
    expect(screen.getByText('No repayments on Sundays')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^Send/ })).toBeNull();
    cleanup();
    const clearLoan = loan({ due: { ...loan().due, payableSats: 0, payablePeople: 0 } });
    show({ sundayRest: false, loans: [clearLoan] });
    expect(screen.getByText('Nothing due today')).toBeTruthy();
    expect(await screen.findByText(/Next: tomorrow, ₿1'000 · \$1\.00 to 1 person/)).toBeTruthy();
  });

  it('shows tomorrow and later next lines when the recipient count is unknown', () => {
    vi.mocked(getRepayment).mockResolvedValue(null);
    const clearDue = { ...loan().due, payableSats: 0, payablePeople: 0 };
    show({
      sundayRest: false,
      loans: [loan({ due: clearDue, next: { dueOn: '2026-10-11', sats: 1_000, amount: null } })],
    });
    expect(screen.getByText("Next: tomorrow, ₿1'000 · $1.00")).toBeTruthy();
    cleanup();
    show({
      sundayRest: false,
      loans: [loan({ due: clearDue, next: { dueOn: '2026-10-13', sats: 1_000, amount: null } })],
    });
    expect(screen.getByText("Next: Tuesday, October 13, ₿1'000 · $1.00")).toBeTruthy();
  });

  it('shows a mixed-currency next amount instead of dropping the stored figures', () => {
    vi.mocked(getRepayment).mockResolvedValue(null);
    const clearDue = { ...loan().due, payableSats: 0, payablePeople: 0 };
    show({
      sundayRest: false,
      loans: [
        loan({
          goalCurrency: 'PHP',
          due: clearDue,
          next: { dueOn: '2026-10-11', sats: 1_000, amount: '30.00' },
        }),
        loan({
          messageId: 'usd-2',
          goalCurrency: 'USD',
          due: clearDue,
          next: { dueOn: '2026-10-11', sats: 1_000, amount: '1.00' },
        }),
      ],
    });
    expect(screen.getByText("Next: tomorrow, ₱30.00 + $1.00 · ₿2'000")).toBeTruthy();
  });

  it('counts next recipients from priced and unpriced loans in the next summary', async () => {
    let resolveFirst: (value: RepaymentLedger | null) => void = () => undefined;
    let resolveSecond: (value: RepaymentLedger | null) => void = () => undefined;
    vi.mocked(getRepayment).mockImplementation(
      (id) =>
        new Promise<RepaymentLedger | null>((resolve) => {
          if (id === 'php-next-1') {
            resolveFirst = resolve;
          } else {
            resolveSecond = resolve;
          }
        }),
    );
    const clearDue = { ...loan().due, payableSats: 0, payablePeople: 0 };
    show({
      sundayRest: false,
      loans: [
        loan({
          messageId: 'php-next-1',
          goalCurrency: 'PHP',
          due: clearDue,
          next: { dueOn: '2026-10-11', amount: '2.00', sats: 40 },
        }),
        loan({
          messageId: 'php-next-2',
          goalCurrency: 'PHP',
          due: clearDue,
          next: { dueOn: '2026-10-11', amount: '3.00', sats: null },
        }),
      ],
    });
    await waitFor(() => expect(getRepayment).toHaveBeenCalledTimes(2));
    await act(async () => {
      resolveFirst(
        ledger({
          repayments: [{ ...ledger().repayments[1]!, accountId: 'giver-1' }],
        }),
      );
      resolveSecond(
        ledger({
          repayments: [{ ...ledger().repayments[1]!, accountId: 'giver-2', name: 'Carla' }],
        }),
      );
      await Promise.resolve();
    });
    expect(await screen.findByText(/Next: tomorrow, ₱2\.00 · ₿40 to 1 person/)).toBeTruthy();
    expect(screen.getByText(/Next: tomorrow, ₱3\.00 to 1 person/)).toBeTruthy();
    expect(screen.queryByText(/null/)).toBeNull();
  });

  it('shows tomorrow and later next lines for several recipients', async () => {
    const clearDue = { ...loan().due, payableSats: 0, payablePeople: 0 };
    vi.mocked(getRepayment).mockResolvedValue(
      ledger({
        repayments: [
          { ...ledger().repayments[1]!, accountId: 'giver-1' },
          { ...ledger().repayments[1]!, accountId: 'giver-2', name: 'Carla' },
        ],
      }),
    );
    show({
      sundayRest: false,
      loans: [loan({ due: clearDue, next: { dueOn: '2026-10-11', sats: 1_000, amount: null } })],
    });
    expect(await screen.findByText(/Next: tomorrow, ₿1'000 · \$1\.00 to 2 people/)).toBeTruthy();
    cleanup();
    show({
      sundayRest: false,
      loans: [loan({ due: clearDue, next: { dueOn: '2026-10-13', sats: 1_000, amount: null } })],
    });
    expect(
      await screen.findByText(/Next: Tuesday, October 13, ₿1'000 · \$1\.00 to 2 people/),
    ).toBeTruthy();
  });

  it('shows a later next line for one known recipient', async () => {
    show({
      sundayRest: false,
      loans: [
        loan({
          due: { ...loan().due, payableSats: 0, payablePeople: 0 },
          next: { dueOn: '2026-10-13', sats: 1_000, amount: null },
        }),
      ],
    });
    expect(
      await screen.findByText(/Next: Tuesday, October 13, ₿1'000 · \$1\.00 to 1 person/),
    ).toBeTruthy();
  });

  it('omits the next line from a nothing-due box when no next payment exists', () => {
    show({
      sundayRest: false,
      loans: [
        loan({
          due: { ...loan().due, payableSats: 0, payablePeople: 0 },
          next: null,
        }),
      ],
    });
    expect(screen.getByText('Nothing due today')).toBeTruthy();
    expect(screen.queryByText(/^Next:/)).toBeNull();
  });

  it('shows a pinned final-payment success, a completed repaid fee, and refreshed waiting', () => {
    const finalLoan = loan({ due: { ...loan().due, lastPayment: true } });
    show(
      { sundayRest: false, loans: [finalLoan] },
      repay({ phase: 'repaid', sentSats: 1_000, pinned: true }),
    );
    expect(screen.getByText('That was your last payment')).toBeTruthy();
    expect(screen.getByText(/fully repaid/)).toBeTruthy();
    cleanup();
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
            next: { dueOn: '2026-10-13', sats: 1_000, amount: null },
          }),
        ],
      },
      repay({ phase: 'repaid', sentSats: 1_000, feeSats: 2 }),
    );
    expect(screen.getByText(/Repaid ₿1'000/)).toBeTruthy();
    expect(screen.getByText('Fee ₿2 · $0.00')).toBeTruthy();
    expect(screen.getByText(/₿200 · \$0\.20 waits until/)).toBeTruthy();
    expect(screen.getByText(/Next: Tuesday, October 13/)).toBeTruthy();
    cleanup();
    show(
      {
        sundayRest: false,
        loans: [
          loan({
            due: {
              ...loan().due,
              payableSats: 0,
              payablePeople: 0,
              waitingSats: null,
              waitingPeople: 1,
              waitingAmount: null,
            },
            next: null,
          }),
        ],
      },
      repay({ phase: 'repaid', sentSats: 1_000 }),
    );
    expect(screen.getByText(/Repaid ₿1'000/)).toBeTruthy();
    expect(screen.queryByText(/waits until/)).toBeNull();
    expect(screen.queryByText(/null/)).toBeNull();
  });

  it('does not replace a zero sent amount for a pinned success and omits empty follow-ups', () => {
    show(
      { sundayRest: false, loans: [loan({ next: null })] },
      repay({ phase: 'repaid', sentSats: 0, pinned: true }),
    );
    expect(screen.getByText(/Repaid ₿0/)).toBeTruthy();
    expect(screen.queryByText(/^Fee/)).toBeNull();
    expect(screen.queryByText(/^Next:/)).toBeNull();
  });

  it.each([
    ['short text', '  Short final loan  ', 'Short final loan'],
    [
      'long text',
      'A very long final loan description that is deliberately longer than sixty characters total',
      'A very long final loan description that is deliberately…',
    ],
    ['long text without a space', 'x'.repeat(65), `${'x'.repeat(60)}…`],
  ])('describes the final loan with %s', (_case, finalText, expectedText) => {
    const clearDue = {
      ...loan().due,
      payableSats: 0,
      payablePeople: 0,
      lastPayment: false,
    };
    show(
      {
        sundayRest: false,
        loans: [
          loan({ messageId: 'ordinary', due: clearDue, next: null }),
          loan({
            messageId: 'final',
            text: finalText,
            due: { ...clearDue, lastPayment: true },
            next: null,
          }),
        ],
      },
      repay({ phase: 'repaid', sentSats: 2_000 }),
    );
    expect(screen.getByText("Repaid ₿2'000 · $2.00")).toBeTruthy();
    expect(screen.getByText(new RegExp(`last payment for “${expectedText}”`))).toBeTruthy();
  });

  it('returns to the regular due box after a settled partial send-now run', () => {
    show(
      {
        sundayRest: false,
        loans: [loan({ due: { ...loan().due, behindDays: 2 } })],
      },
      repay({ phase: 'repaid', sentSats: 500, sentNames: ['Bruno'] }),
    );
    expect(screen.getByText('Still due today')).toBeTruthy();
    expect(screen.getByText('Sent ₿500 · $0.50 to Bruno')).toBeTruthy();
    expect(screen.queryByText('Repaid ₿500 · $0.50')).toBeNull();
    expect(screen.getByRole('button', { name: /^Send ₿/ })).toBeTruthy();
    cleanup();
    show(
      { sundayRest: false, loans: [loan()] },
      repay({ phase: 'idle', sentSats: 500, sentNames: ['Bruno'] }),
    );
    expect(screen.getByText('Still due today')).toBeTruthy();
    expect(screen.getByText('Sent ₿500 · $0.50 to Bruno')).toBeTruthy();
  });

  it('shows partial success when an unpriced payable loan remains', () => {
    show(
      {
        sundayRest: false,
        loans: [
          loan({
            goalCurrency: 'PHP',
            goalAmount: '450.00',
            totalSats: null,
            maxSats: null,
            due: {
              ...loan().due,
              payableSats: null,
              payablePeople: 1,
              payableAmount: '15.00',
            },
          }),
        ],
      },
      repay({ phase: 'repaid', sentSats: 1_000, sentNames: ['Bruno'] }),
    );
    expect(screen.getByText('Still due today')).toBeTruthy();
    expect(screen.getByText('₱15.00')).toBeTruthy();
    expect(screen.getByText("Sent ₿1'000 · $1.00 to Bruno")).toBeTruthy();
    expect(screen.queryByText(/Repaid ₿1'000/)).toBeNull();
    expect(screen.queryByRole('button', { name: /^Send / })).toBeNull();
  });

  it('shows the stored sent amounts for a fiat repayment and partial send', () => {
    const clearDue = { ...loan().due, payableSats: 0, payablePeople: 0 };
    show(
      {
        sundayRest: false,
        loans: [loan({ goalCurrency: 'PHP', goalAmount: '900.00', due: clearDue })],
      },
      repay({
        phase: 'repaid',
        sentSats: 1_000,
        sentAmounts: [{ code: 'PHP', amount: '30.00' }],
        sentNames: ['Bruno'],
      }),
    );
    expect(screen.getByText("Repaid ₱30.00 · ₿1'000")).toBeTruthy();
    cleanup();
    show(
      {
        sundayRest: false,
        loans: [
          loan({
            goalCurrency: 'PHP',
            goalAmount: '900.00',
            due: { ...loan().due, payableSats: 1_000, payableAmount: '30.00' },
          }),
        ],
      },
      repay({
        phase: 'sending',
        sentSats: 1_000,
        sentAmounts: [],
        sentNames: [],
      }),
    );
    expect(screen.getByRole('status').textContent).toContain("Sending ₱30.00 · ₿1'000…");
    cleanup();
    show(
      {
        sundayRest: false,
        loans: [loan({ goalCurrency: 'PHP', goalAmount: '900.00', due: clearDue })],
      },
      repay({
        phase: 'repaid',
        sentSats: 1_000,
        sentAmounts: [{ code: 'PHP', amount: null }],
        sentNames: ['Bruno'],
      }),
    );
    expect(screen.queryByText(/Repaid ₱/)).toBeNull();
    expect(screen.getByText("Repaid ₿1'000 · $1.00")).toBeTruthy();
    cleanup();
    show(
      {
        sundayRest: false,
        loans: [loan({ goalCurrency: 'PHP', goalAmount: '900.00' })],
      },
      repay({
        phase: 'idle',
        sentSats: 500,
        sentAmounts: [{ code: 'PHP', amount: '15.00' }],
        sentNames: ['Bruno'],
      }),
    );
    expect(screen.getByText('Still due today')).toBeTruthy();
    expect(screen.getByText('Sent ₱15.00 · ₿500 to Bruno')).toBeTruthy();
  });

  it('asks for nothing after a partial send when only waiting shares remain', () => {
    show(
      {
        sundayRest: false,
        loans: [
          loan({
            due: { ...loan().due, payableSats: 0, waitingSats: 500, waitingPeople: 1 },
          }),
        ],
      },
      repay({ phase: 'idle', sentSats: 500, sentNames: ['Bruno'] }),
    );
    expect(screen.getByText('Nothing to send now')).toBeTruthy();
    expect(screen.queryByText('Still due today')).toBeNull();
    expect(screen.getByText('Sent ₿500 · $0.50 to Bruno')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^Send ₿/ })).toBeNull();
  });

  it('keeps the last-payment success when the refreshed loan list is empty', () => {
    const finalLoan = loan({ due: { ...loan().due, lastPayment: true } });
    const data = { sundayRest: false, loans: [finalLoan] };
    const reload = vi.fn().mockResolvedValue(data);
    const state = repay();
    vi.mocked(useMyLoans).mockReturnValue({ loans: data, reload });
    vi.mocked(useLoanRepay).mockReturnValue(state);
    const view = renderWithLocale(<LoanRepayScreen />);
    fireEvent.click(screen.getByRole('button', { name: /^Send ₿/ }));
    vi.mocked(useMyLoans).mockReturnValue({
      loans: { sundayRest: false, loans: [] },
      reload,
    });
    vi.mocked(useLoanRepay).mockReturnValue(repay({ phase: 'repaid', sentSats: 1_000 }));
    view.rerender(<LoanRepayScreen />);
    expect(screen.getByText('That was your last payment')).toBeTruthy();
    expect(screen.queryByText('You have no loan to repay.')).toBeNull();
    vi.mocked(useLoanRepay).mockReturnValue(repay({ phase: 'repaid', sentSats: 0, pinned: true }));
    view.rerender(<LoanRepayScreen />);
    expect(screen.getByText('That was your last payment')).toBeTruthy();
  });

  it('keeps a final prepayment success when the refreshed loan list is empty', () => {
    const finalLoan = loan({
      maxSats: 500,
      due: { ...loan().due, payableSats: 0, payablePeople: 0 },
    });
    const data = { sundayRest: false, loans: [finalLoan] };
    const reload = vi.fn().mockResolvedValue(data);
    const state = repay({ activeAction: null });
    vi.mocked(useMyLoans).mockReturnValue({ loans: data, reload });
    vi.mocked(useLoanRepay).mockReturnValue(state);
    const view = renderWithLocale(<LoanRepayScreen />);
    fireEvent.change(screen.getByLabelText('Amount (₿)'), { target: { value: '500' } });
    fireEvent.click(screen.getByRole('button', { name: 'Pay this amount' }));
    expect(state.prepay).toHaveBeenCalledWith(finalLoan, '500');

    vi.mocked(useMyLoans).mockReturnValue({
      loans: { sundayRest: false, loans: [] },
      reload,
    });
    vi.mocked(useLoanRepay).mockReturnValue(
      repay({
        phase: 'repaid',
        activeAction: { kind: 'prepay', messageId: finalLoan.messageId },
        sentSats: 500,
        sentNames: ['Bruno'],
      }),
    );
    view.rerender(<LoanRepayScreen />);
    expect(screen.getByText('That was your last payment')).toBeTruthy();
    expect(screen.getByText(/Your loan is fully repaid/)).toBeTruthy();
    expect(screen.queryByText('You have no loan to repay.')).toBeNull();
  });

  it('keeps a prepayment success tied to its target when another final loan remains', () => {
    const paidTarget = loan({
      maxSats: 500,
      due: { ...loan().due, payableSats: 0, payablePeople: 0 },
    });
    const remaining = loan({
      messageId: 'loan-2',
      text: 'A second loan',
      due: { ...loan().due, lastPayment: true },
    });
    const data = { sundayRest: false, loans: [paidTarget, remaining] };
    const reload = vi.fn().mockResolvedValue(data);
    const state = repay({ activeAction: null });
    vi.mocked(useMyLoans).mockReturnValue({ loans: data, reload });
    vi.mocked(useLoanRepay).mockReturnValue(state);
    const view = renderWithLocale(<LoanRepayScreen />);
    const targetCard = screen.getByText(paidTarget.text).closest('article');
    expect(targetCard).not.toBeNull();
    fireEvent.change(within(targetCard as HTMLElement).getByLabelText('Amount (₿)'), {
      target: { value: '500' },
    });
    fireEvent.click(
      within(targetCard as HTMLElement).getByRole('button', { name: 'Pay this amount' }),
    );

    vi.mocked(useLoanRepay).mockReturnValue(
      repay({
        phase: 'repaid',
        activeAction: { kind: 'prepay', messageId: paidTarget.messageId },
        sentSats: 0,
      }),
    );
    view.rerender(<LoanRepayScreen />);
    expect(screen.queryByText('Repaid ₿500 · $0.50')).toBeNull();

    vi.mocked(useLoanRepay).mockReturnValue(
      repay({
        phase: 'repaid',
        activeAction: { kind: 'prepay', messageId: paidTarget.messageId },
        sentSats: 500,
        sentNames: ['Bruno'],
      }),
    );
    view.rerender(<LoanRepayScreen />);
    expect(screen.queryByText('Repaid ₿500 · $0.50')).toBeNull();

    vi.mocked(useMyLoans).mockReturnValue({
      loans: { sundayRest: false, loans: [remaining] },
      reload,
    });
    vi.mocked(useLoanRepay).mockReturnValue(
      repay({
        phase: 'repaid',
        activeAction: { kind: 'prepay', messageId: paidTarget.messageId },
        sentSats: 500,
        sentNames: ['Bruno'],
      }),
    );
    view.rerender(<LoanRepayScreen />);
    expect(screen.getByText('Repaid ₿500 · $0.50')).toBeTruthy();
    expect(
      screen.getByText(/last payment for “A sewing machine for my repair stall”/),
    ).toBeTruthy();
    expect(screen.queryByText(/last payment for “A second loan”/)).toBeNull();
    expect(screen.getByText('A second loan')).toBeTruthy();

    vi.mocked(useLoanRepay).mockReturnValue(
      repay({
        phase: 'repaid',
        activeAction: { kind: 'prepay', messageId: paidTarget.messageId },
        sentSats: 0,
        pinned: true,
      }),
    );
    view.rerender(<LoanRepayScreen />);
    expect(screen.getByText('Repaid ₿0 · $0.00')).toBeTruthy();
  });

  it('does not invent a completed payment for an empty list without remembered loans', () => {
    show({ sundayRest: false, loans: [] }, repay({ phase: 'repaid', sentSats: 1_000 }));
    expect(screen.getByText('You have no loan to repay.')).toBeTruthy();
    expect(screen.queryByText(/Repaid/)).toBeNull();
    cleanup();
    show({ sundayRest: false, loans: [] }, repay({ phase: 'repaid', sentSats: 0, pinned: false }));
    expect(screen.getByText('You have no loan to repay.')).toBeTruthy();
    cleanup();
    show(
      { sundayRest: false, loans: [loan({ messageId: 'loan-2' })] },
      repay({
        phase: 'repaid',
        activeAction: { kind: 'prepay', messageId: 'loan-1' },
        sentSats: 500,
      }),
    );
    expect(screen.queryByText('Repaid ₿500 · $0.50')).toBeNull();
  });

  it('shows several loan cards, grouping labels, counts, and fiat plans', async () => {
    const second = loan({
      messageId: 'loan/2',
      text: 'School books for my daughter',
      goalCurrency: 'EUR',
      goalAmount: '12.00',
      goalSats: 12_000,
      totalSats: 12_000,
      repaidSats: 6_000,
      termDays: 10,
      daysDue: 5,
    });
    vi.mocked(getRepayment).mockImplementation(async (id) =>
      id === 'loan-1'
        ? ledger()
        : ledger({
            currency: 'EUR',
            repayments: [
              {
                ...ledger().repayments[0]!,
                accountId: 'giver-2',
                name: 'Carla',
                amount: '1.20',
              },
            ],
          }),
    );
    show({ sundayRest: false, loans: [loan(), second] });
    expect(screen.getByText("₿2'000")).toBeTruthy();
    expect(screen.getByText(/2 loans/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Who gets paid' }));
    await screen.findAllByText('A sewing machine for my repair stall');
    expect(screen.getAllByText('School books for my daughter')).toHaveLength(2);
    const list = screen.getByRole('region', { name: 'Your loans' });
    expect(within(list).getByText('EUR 12.00 · 10 days · EUR 1.20 per day')).toBeTruthy();
    expect(
      within(list).getAllByRole('link', { name: 'Repayment list' })[0]?.getAttribute('href'),
    ).toBe('/messages/loan-1/repayment-list');
  });

  it('shows prepay waiting recipients only under the loan that made the request', () => {
    const phpLoan = loan({
      messageId: 'php-waiting',
      goalCurrency: 'PHP',
      goalAmount: '900.00',
      maxAmount: '570.00',
    });
    const usdLoan = loan({
      messageId: 'usd-other',
      goalCurrency: 'USD',
      goalAmount: '30.00',
      maxAmount: '19.00',
    });
    show(
      { sundayRest: false, loans: [phpLoan, usdLoan] },
      repay({
        phase: 'waiting',
        activeAction: { kind: 'prepay', messageId: 'php-waiting' },
        prepayMessageId: 'php-waiting',
        prepayWaiting: [
          {
            dayIndex: 12,
            recipientAccountId: 'giver-waiting',
            name: 'Carla',
            username: 'carla',
            amountSats: 200,
            amount: '2.50',
          },
        ],
      }),
    );

    expect(screen.getAllByText('Waiting for Carla to set up their wallet')).toHaveLength(1);
    expect(screen.getByText('₱2.50 · ₿200')).toBeTruthy();
    expect(screen.queryByText('$2.50')).toBeNull();
  });

  it('keeps an all-waiting prepay result ready for another amount', () => {
    show(
      { sundayRest: false, loans: [loan()] },
      repay({
        phase: 'repaid',
        activeAction: { kind: 'prepay', messageId: 'loan-1' },
        prepayMessageId: 'loan-1',
        prepayWaiting: [
          {
            dayIndex: 12,
            recipientAccountId: 'giver-waiting',
            name: 'Carla',
            username: 'carla',
            amountSats: 200,
            amount: null,
          },
        ],
      }),
    );

    expect(screen.getByText('Waiting for Carla to set up their wallet')).toBeTruthy();
    expect(screen.getByText('₿200 · $0.20')).toBeTruthy();
    expect(screen.getByLabelText('Amount (₿)')).toHaveProperty('disabled', false);
    expect(screen.getByRole('button', { name: 'Pay this amount' })).toHaveProperty(
      'disabled',
      true,
    );
  });

  it('keeps prepay sending and shortfall state out of the due box', () => {
    const data = { sundayRest: false, loans: [loan()] };
    const sending = show(
      data,
      repay({
        phase: 'sending',
        activeAction: { kind: 'prepay', messageId: 'loan-1' },
      }),
    );
    expect(screen.getByText('Paying more…')).toBeTruthy();
    expect(screen.queryByText(/Sending ₿/)).toBeNull();
    sending.unmount();

    show(
      data,
      repay({
        phase: 'idle',
        activeAction: { kind: 'prepay', messageId: 'loan-1' },
        balanceSats: 21_000,
        missingSats: 500,
      }),
    );
    expect(screen.getAllByText('Not enough in your wallet')).toHaveLength(1);
    expect((screen.getByRole('button', { name: /^Send ₿/ }) as HTMLButtonElement).disabled).toBe(
      false,
    );
  });

  it('handles zero totals and unusable backend plan values without inventing progress', () => {
    const zeroLoan = loan({
      messageId: 'zero',
      text: 'Zero total',
      goalSats: 0,
      sats: 0,
      totalSats: 0,
      repaidSats: 0,
      termDays: 0,
      daysDue: 1,
      due: { ...loan().due, payableSats: 0, payablePeople: 0 },
      next: null,
    });
    const malformedFiat = loan({
      messageId: 'malformed',
      text: 'Malformed fiat plan',
      goalCurrency: 'EUR',
      goalAmount: 'not-an-amount',
      termDays: 0,
      repaidSats: 40_000,
      fundedAt: null,
      due: { ...loan().due, payableSats: 0, payablePeople: 0 },
      next: null,
    });
    show({ sundayRest: false, loans: [zeroLoan, malformedFiat] });
    const zeroProgress = screen.getByRole('img', { name: /Repaid ₿0/ });
    expect(zeroProgress.querySelectorAll('rect')[1]?.getAttribute('width')).toBe('0');
    expect(screen.getByText('Malformed fiat plan').nextElementSibling?.textContent).toContain(
      '0 days',
    );
  });

  it('re-reads ledgers after the repayment hook reloads', async () => {
    const data = { sundayRest: false, loans: [loan()] };
    const reload = vi.fn().mockResolvedValue(data);
    show(data, repay(), reload);
    await waitFor(() => expect(getRepayment).toHaveBeenCalledTimes(1));
    const options = vi.mocked(useLoanRepay).mock.calls[0]?.[0];
    await act(async () => {
      await options?.reload();
    });
    await waitFor(() => expect(getRepayment).toHaveBeenCalledTimes(2));
    reload.mockResolvedValue(null);
    let failedReload: MyLoans | null | undefined;
    await act(async () => {
      failedReload = await options?.reload();
    });
    expect(failedReload).toBeNull();
    expect(getRepayment).toHaveBeenCalledTimes(2);
  });
});
