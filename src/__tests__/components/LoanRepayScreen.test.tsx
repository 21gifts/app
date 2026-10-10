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
    balanceSats: 21_000,
    sentSats: 0,
    sentNames: [],
    feeSats: 0,
    missingSats: null,
    errorKey: null,
    topUpOpen: false,
    openTopUp: vi.fn(),
    pay: vi.fn(),
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

  it('shows the no-loans state', () => {
    show({ sundayRest: false, loans: [] });
    expect(screen.getByRole('heading', { name: 'Loan repayment' }).className).toContain('sr-only');
    expect(screen.getByText('You have no loan to repay.')).toBeTruthy();
  });

  it('shows only the list for a collecting loan', () => {
    show({ sundayRest: false, loans: [loan({ fundedAt: null, sats: 12_000 })] });
    expect(screen.getByText('Not fully funded yet.')).toBeTruthy();
    expect(screen.queryByText('Due today')).toBeNull();
    expect(screen.getByText("₿30'000 · $30.00 · 30 days · ₿1'000 · $1.00 per day")).toBeTruthy();
    expect(screen.queryByRole('img', { name: /Repaid/ })).toBeNull();
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
    expect(screen.getByText("₿1'000 · $1.00")).toBeTruthy();
    expect(screen.getByText("From your wallet · ₿21'000 · $21.00")).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: "Send ₿1'000 · $1.00" }));
    expect(state.pay).toHaveBeenCalledWith(
      [expect.objectContaining({ messageId: 'loan-1' })],
      undefined,
    );
    const list = screen.getByRole('region', { name: 'Your loan' });
    expect(within(list).getByText("Repaid ₿11'000 · $11.00 of ₿30'000 · $30.00")).toBeTruthy();
    expect(within(list).getByText('Day 12 of 30')).toBeTruthy();
    expect(within(list).getByRole('img').getAttribute('viewBox')).toBe('0 0 100 8');
    expect(within(list).getByRole('link', { name: 'Repayment list' }).getAttribute('href')).toBe(
      '/messages/loan-1/repayment-list',
    );
  });

  it('omits every fiat part when no spot rate exists', () => {
    vi.mocked(useSpotRate).mockReturnValue(null);
    show({ sundayRest: false, loans: [loan()] });
    expect(screen.getByText("₿1'000")).toBeTruthy();
    expect(screen.getByRole('button', { name: "Send ₿1'000" })).toBeTruthy();
    expect(screen.queryByText(/\$/)).toBeNull();
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
    expect(screen.getByText("$1.00 · ₿1'000")).toBeTruthy();
    expect(screen.queryByText('$1.00')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Who gets paid' }));
    await waitFor(() => expect(screen.getAllByText("$1.00 · ₿1'000")).toHaveLength(2));
  });

  it('falls back to zero defined units for an unusable payable-amount value', () => {
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
    expect(screen.getByText("EUR 0.00 · ₿1'000")).toBeTruthy();
    expect(screen.getByText('$1.00')).toBeTruthy();
  });

  it('puts a shared fiat loan currency first and shows waiting shares as notices', async () => {
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
    expect(screen.getByText('₱30.00 · ₿536')).toBeTruthy();
    expect(screen.getByText('$0.54')).toBeTruthy();
    expect(screen.getByText(/waits for a lender/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Who gets paid' }));
    await screen.findByText('No wallet yet · waits');
    expect(screen.getByText(/₱10.00 · ₿200 · \$0.20/)).toBeTruthy();
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
      name: /Send ₿500 · \$0.50 now to Bruno/,
    });
    fireEvent.click(sendNow);
    expect(state.pay).toHaveBeenCalledWith(expect.any(Array), 600);
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
    cleanup();
    useAuthStore.setState({ session: 'token', account: {} as never });
    show({ sundayRest: false, loans: [loan()] }, repay({ balanceSats: 600, topUpOpen: true }));
    expect(screen.queryByTestId('own-address')).toBeNull();
  });

  it('shows all waiting without Send and falls back to summary people without ledgers', () => {
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
    expect(screen.queryByRole('button', { name: /^Send ₿/ })).toBeNull();
    expect(screen.getByText('to 0 people')).toBeTruthy();
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
    expect(screen.getByText(/Sent ₿500 · \$0.50 to Bruno/)).toBeTruthy();
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
    expect(await screen.findByText(/Next: tomorrow, ₿1'000 · \$1.00 to 1 person/)).toBeTruthy();
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
    expect(await screen.findByText(/Next: tomorrow, ₿1'000 · \$1.00 to 2 people/)).toBeTruthy();
    cleanup();
    show({
      sundayRest: false,
      loans: [loan({ due: clearDue, next: { dueOn: '2026-10-13', sats: 1_000, amount: null } })],
    });
    expect(
      await screen.findByText(/Next: Tuesday, October 13, ₿1'000 · \$1.00 to 2 people/),
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
      await screen.findByText(/Next: Tuesday, October 13, ₿1'000 · \$1.00 to 1 person/),
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
    expect(screen.getByText(/Repaid ₿1'000 · \$1.00/)).toBeTruthy();
    expect(screen.getByText('Fee ₿2 · $0.00')).toBeTruthy();
    expect(screen.getByText(/₿200 · \$0.20 waits until/)).toBeTruthy();
    expect(screen.getByText(/Next: Tuesday, October 13/)).toBeTruthy();
  });

  it('does not replace a zero sent amount for a pinned success and omits empty follow-ups', () => {
    show(
      { sundayRest: false, loans: [loan({ next: null })] },
      repay({ phase: 'repaid', sentSats: 0, pinned: true }),
    );
    expect(screen.getByText('Repaid ₿0 · $0.00')).toBeTruthy();
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

  it('does not invent a completed payment for an empty list without remembered loans', () => {
    show({ sundayRest: false, loans: [] }, repay({ phase: 'repaid', sentSats: 1_000 }));
    expect(screen.getByText('You have no loan to repay.')).toBeTruthy();
    expect(screen.queryByText(/Repaid/)).toBeNull();
    cleanup();
    show({ sundayRest: false, loans: [] }, repay({ phase: 'repaid', sentSats: 0, pinned: false }));
    expect(screen.getByText('You have no loan to repay.')).toBeTruthy();
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
