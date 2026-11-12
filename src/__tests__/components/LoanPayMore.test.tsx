import { cleanup, fireEvent, screen, within } from '@testing-library/react';
import type { ReactElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LoanPayMore, type LoanPayMoreProps } from '@/components/LoanPayMore';
import type { LoanRepayActionError } from '@/hooks/useLoanRepay';
import type { MyLoan } from '@/lib/api';
import { formatBitcoin, type FiatRateDay } from '@/lib/stats-money';
import { useAuthStore } from '@/stores/auth-store';
import { renderWithLocale } from '@/__tests__/render-with-locale';

vi.mock('@/components/WalletSetupNote', () => ({
  WalletSetupNote: () => <p role="alert">Wallet setup failed</p>,
}));

const RATE_DAY: FiatRateDay = {
  sats: 100_000_000,
  usd: '100000.00',
  chf: '80000.00',
  eur: '90000.00',
  php: '5600000.00',
};

function testSats(sats: number): string {
  return formatBitcoin(sats, 'ch');
}

function loan(overrides: Partial<MyLoan> = {}): MyLoan {
  return {
    messageId: 'loan-1',
    text: 'Tools for a repair stall',
    createdAt: '2026-09-01T00:00:00.000Z',
    goalSats: 10_000,
    sats: 10_000,
    goalCurrency: 'BTC',
    goalAmount: '10000',
    goalAmountUsd: null,
    goalAmountChf: null,
    goalAmountEur: null,
    goalAmountPhp: null,
    amountUsd: null,
    amountChf: null,
    amountEur: null,
    amountPhp: null,
    termDays: 10,
    fundedAt: '2026-09-02T00:00:00.000Z',
    closedAt: '2026-09-02T00:00:00.000Z',
    maxSats: 7_500,
    maxAmount: null,
    daysDue: 2,
    daysPaid: 1,
    repaidSats: 1_000,
    totalSats: 10_000,
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
    next: null,
    ...overrides,
  };
}

function show(
  item: MyLoan = loan(),
  actionError: LoanRepayActionError | null = null,
): {
  onPay: ReturnType<typeof vi.fn>;
  onCloseCollecting: ReturnType<typeof vi.fn>;
  rerender: ReturnType<typeof renderWithLocale>['rerender'];
} {
  const onPay = vi.fn();
  const onCloseCollecting = vi.fn();
  const view = renderWithLocale(
    <LoanPayMore
      loan={item}
      phase="idle"
      actionError={actionError}
      errorKey={null}
      balanceSats={21_000}
      missingSats={null}
      showShortfall
      sundayRest={false}
      rateDay={RATE_DAY}
      showWalletStatus
      topUpOpen={false}
      username="ada"
      formatSats={testSats}
      onOpenTopUp={vi.fn()}
      onPay={onPay}
      onCloseCollecting={onCloseCollecting}
    />,
  );
  return { onPay, onCloseCollecting, rerender: view.rerender };
}

function payMoreState(
  item: MyLoan,
  onPay: ReturnType<typeof vi.fn>,
  onCloseCollecting: ReturnType<typeof vi.fn>,
  overrides: Partial<LoanPayMoreProps> = {},
): ReactElement {
  return (
    <LoanPayMore
      loan={item}
      phase="idle"
      actionError={null}
      errorKey={null}
      balanceSats={21_000}
      missingSats={null}
      showShortfall
      sundayRest={false}
      rateDay={RATE_DAY}
      showWalletStatus
      topUpOpen={false}
      username="ada"
      formatSats={testSats}
      onOpenTopUp={vi.fn()}
      onPay={onPay}
      onCloseCollecting={onCloseCollecting}
      {...overrides}
    />
  );
}

afterEach(() => {
  cleanup();
  useAuthStore.setState({ session: null, account: null });
});

describe('LoanPayMore', () => {
  it("uses the loan unit instead of the signed-in member's account amount unit", () => {
    useAuthStore.setState({
      session: 'session',
      account: { amountUnit: 'fiat' } as never,
    });
    show();
    expect(screen.getByLabelText('Amount (₿)')).toBeTruthy();
    expect(screen.queryByRole('group', { name: 'Bitcoin or fiat' })).toBeNull();
  });

  it('fills Max exactly and pays a valid BTC amount', () => {
    const { onPay } = show();
    const input = screen.getByLabelText('Amount (₿)') as HTMLInputElement;
    expect(
      (screen.getByRole('button', { name: 'Pay this amount' }) as HTMLButtonElement).disabled,
    ).toBe(true);
    window.history.replaceState({}, '', '/loans/repay');
    fireEvent.click(screen.getByRole('button', { name: 'Max' }));
    expect(input.value).toBe('7500');
    fireEvent.click(screen.getByRole('button', { name: 'Pay this amount' }));
    expect(onPay).toHaveBeenCalledWith(expect.objectContaining({ messageId: 'loan-1' }), '7500');
  });

  it('uses AmountEntry with the fixed loan unit, live counter, and exact BTC api amount', () => {
    const { onPay } = show();
    fireEvent.change(screen.getByLabelText('Amount (₿)'), { target: { value: '1000' } });
    expect(screen.getByText('$1.00')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Max' }));
    expect((screen.getByLabelText('Amount (₿)') as HTMLInputElement).value).toBe('7500');
    expect(screen.queryByRole('group', { name: 'Bitcoin or fiat' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Pay this amount' }));
    expect(onPay).toHaveBeenCalledWith(expect.anything(), '7500');
  });

  it('shows preferred fiat beside BTC in max validation and collecting confirmation', () => {
    const collecting = loan({ fundedAt: null, closedAt: null, maxSats: 4_000 });
    const onPay = vi.fn();
    const onCloseCollecting = vi.fn();
    renderWithLocale(
      payMoreState(collecting, onPay, onCloseCollecting, {
        formatSats: (sats) => {
          if (sats === 4_000) {
            return "₿4'000 · $4.00";
          }
          if (sats === 1_000) {
            return "₿1'000 · $1.00";
          }
          return `₿${sats}`;
        },
      }),
    );
    fireEvent.change(screen.getByLabelText('Amount (₿)'), { target: { value: '4001' } });
    expect(screen.getByText(/Enter at most ₿4'000 · \$4.00/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Amount (₿)'), { target: { value: '1000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Pay this amount' }));
    expect(
      screen.getByRole('button', { name: "Pay ₿1'000 · $1.00 and end collecting" }),
    ).toBeTruthy();
  });

  it('validates while typing and never submits above the maximum', () => {
    const { onPay } = show();
    const input = screen.getByLabelText('Amount (₿)') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '7501' } });
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByText("Enter at most ₿7'500.")).toBeTruthy();
    expect(
      (screen.getByRole('button', { name: 'Pay this amount' }) as HTMLButtonElement).disabled,
    ).toBe(true);
    expect(onPay).not.toHaveBeenCalled();
  });

  it('keeps a server invalid amount on the field and blocks retry until the draft changes', () => {
    const item = loan();
    const view = show(item);
    const input = screen.getByLabelText('Amount (₿)') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '1000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Pay this amount' }));
    expect(view.onPay).toHaveBeenCalledTimes(1);

    view.rerender(
      payMoreState(item, view.onPay, view.onCloseCollecting, {
        phase: 'failed',
        actionError: {
          messageId: 'loan-1',
          code: 'invalid_amount',
          maxSats: null,
          maxAmount: null,
        },
      }),
    );

    const rejected = screen.getByLabelText('Amount (₿)') as HTMLInputElement;
    expect(rejected.getAttribute('aria-invalid')).toBe('true');
    expect(rejected.getAttribute('aria-describedby')).toBe(`${rejected.id}-error`);
    expect(screen.getByRole('alert').textContent).toBe('Enter a whole ₿ amount greater than zero.');
    const blocked = screen.getByRole('button', {
      name: 'Pay this amount',
    }) as HTMLButtonElement;
    expect(blocked.disabled).toBe(true);
    fireEvent.click(blocked);
    expect(view.onPay).toHaveBeenCalledTimes(1);

    fireEvent.change(rejected, { target: { value: '999' } });
    expect(rejected.getAttribute('aria-invalid')).toBeNull();
    expect(rejected.getAttribute('aria-describedby')).toBeNull();
    expect(blocked.disabled).toBe(false);

    cleanup();
    const php = loan({
      goalCurrency: 'PHP',
      goalAmount: '480.28',
      maxSats: 9_283,
      maxAmount: '480.28',
    });
    const fiatView = show(php);
    fireEvent.change(screen.getByLabelText('Amount (PHP)'), { target: { value: '100.00' } });
    fireEvent.click(screen.getByRole('button', { name: 'Pay this amount' }));
    fiatView.rerender(
      payMoreState(php, fiatView.onPay, fiatView.onCloseCollecting, {
        phase: 'failed',
        actionError: {
          messageId: 'loan-1',
          code: 'invalid_amount',
          maxSats: null,
          maxAmount: null,
        },
      }),
    );
    expect(screen.getByRole('alert').textContent).toBe(
      'Enter an amount greater than zero with at most two decimals.',
    );
    expect(
      (screen.getByRole('button', { name: 'Pay this amount' }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });

  it('does not reapply a consumed invalid-amount refusal after an unrelated rerender', () => {
    const item = loan();
    const view = show(item);
    fireEvent.change(screen.getByLabelText('Amount (₿)'), { target: { value: '1000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Pay this amount' }));
    const refusal: LoanRepayActionError = {
      messageId: 'loan-1',
      code: 'invalid_amount',
      maxSats: null,
      maxAmount: null,
    };
    view.rerender(
      payMoreState(item, view.onPay, view.onCloseCollecting, {
        phase: 'failed',
        activeAction: { kind: 'prepay', messageId: 'loan-1' },
        actionError: refusal,
      }),
    );
    const input = screen.getByLabelText('Amount (₿)') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '999' } });
    view.rerender(
      payMoreState({ ...item }, view.onPay, view.onCloseCollecting, {
        phase: 'failed',
        activeAction: { kind: 'prepay', messageId: 'loan-1' },
        actionError: { ...refusal },
        formatSats: (sats) => `₿${sats}`,
      }),
    );
    expect(input.value).toBe('999');
    expect(input.getAttribute('aria-invalid')).toBeNull();
  });

  it('uses unique amount and error ids when more than one loan is shown', () => {
    const onPay = vi.fn();
    const onCloseCollecting = vi.fn();
    renderWithLocale(
      <>
        {payMoreState(loan({ messageId: 'loan-1' }), onPay, onCloseCollecting)}
        {payMoreState(loan({ messageId: 'loan-2' }), onPay, onCloseCollecting)}
      </>,
    );
    const inputs = screen.getAllByLabelText('Amount (₿)') as HTMLInputElement[];
    expect(inputs).toHaveLength(2);
    expect(inputs[0]?.id).toBeTruthy();
    expect(inputs[1]?.id).toBeTruthy();
    expect(inputs[0]?.id).not.toBe(inputs[1]?.id);

    fireEvent.change(inputs[0] as HTMLInputElement, { target: { value: 'bad' } });
    fireEvent.change(inputs[1] as HTMLInputElement, { target: { value: 'bad' } });
    expect(inputs[0]?.getAttribute('aria-describedby')).toBe(`${inputs[0]?.id}-error`);
    expect(inputs[1]?.getAttribute('aria-describedby')).toBe(`${inputs[1]?.id}-error`);
    expect(inputs[0]?.getAttribute('aria-describedby')).not.toBe(
      inputs[1]?.getAttribute('aria-describedby'),
    );
  });

  it('uses currency-specific validation copy for malformed BTC and fiat amounts', () => {
    show();
    fireEvent.change(screen.getByLabelText('Amount (₿)'), { target: { value: '1.5' } });
    expect(screen.getByText('Enter a whole ₿ amount greater than zero.')).toBeTruthy();
    cleanup();

    show(
      loan({
        goalCurrency: 'PHP',
        goalAmount: '480.28',
        maxSats: 9_283,
        maxAmount: '480.28',
      }),
    );
    fireEvent.change(screen.getByLabelText('Amount (PHP)'), { target: { value: 'bad' } });
    expect(
      screen.getByText('Enter an amount greater than zero with at most two decimals.'),
    ).toBeTruthy();
  });

  it('keeps a fiat-loan draft in the loan currency and submits the typed string', () => {
    const php = loan({
      goalCurrency: 'PHP',
      goalAmount: '480.28',
      maxSats: 9_283,
      maxAmount: '480.28',
    });
    const { onPay } = show(php);
    fireEvent.change(screen.getByLabelText('Amount (PHP)'), { target: { value: '56.00' } });
    expect(screen.getByText("₿1'000")).toBeTruthy();
    expect(screen.queryByRole('group', { name: 'Bitcoin or fiat' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Pay this amount' }));
    expect(onPay).toHaveBeenCalledWith(expect.anything(), '56.00');
  });

  it('never submits sats for a fiat loan when conversion is unavailable', () => {
    const php = loan({
      goalCurrency: 'PHP',
      goalAmount: '480.28',
      maxSats: 9_283,
      maxAmount: '480.28',
    });
    const onPay = vi.fn();
    renderWithLocale(payMoreState(php, onPay, vi.fn(), { rateDay: null }));
    fireEvent.change(screen.getByLabelText('Amount (PHP)'), { target: { value: '1.00' } });
    expect(screen.getByText(/No PHP exchange rate is available now/)).toBeTruthy();
    const pay = screen.getByRole('button', { name: 'Pay this amount' }) as HTMLButtonElement;
    expect(pay.disabled).toBe(true);
    fireEvent.click(pay);
    expect(onPay).not.toHaveBeenCalled();
  });

  it('keeps fiat cents exact and disables the form without a maximum rate', () => {
    const php = loan({
      goalCurrency: 'PHP',
      goalAmount: '480.28',
      maxSats: 9_283,
      maxAmount: '480.28',
    });
    const { onPay } = show(php);
    const input = screen.getByLabelText('Amount (PHP)') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '480.29' } });
    expect(screen.getByText("Enter at most ₱480.28 · ₿9'283.")).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Max' }));
    expect(input.value).toBe('480.28');
    fireEvent.click(screen.getByRole('button', { name: 'Pay this amount' }));
    expect(onPay).toHaveBeenCalledWith(expect.anything(), '480.28');
    cleanup();

    show({ ...php, maxSats: null });
    expect(screen.getByText(/No PHP exchange rate is available now/)).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Max' }) as HTMLButtonElement).disabled).toBe(true);
    expect(
      (screen.getByRole('button', { name: 'Pay this amount' }) as HTMLButtonElement).disabled,
    ).toBe(true);
    window.history.replaceState({}, '', '/loans/repay');
  });

  it.each([null, 'not-an-amount'])(
    'reports a fiat maximum as unavailable when max sats exist but maxAmount is %s',
    (maxAmount) => {
      show(
        loan({
          goalCurrency: 'PHP',
          goalAmount: '480.28',
          maxSats: 9_283,
          maxAmount,
        }),
      );
      expect(screen.getByText(/No PHP repayment maximum is available now/)).toBeTruthy();
      expect(screen.queryByText(/No PHP exchange rate is available now/)).toBeNull();
      expect((screen.getByRole('button', { name: 'Max' }) as HTMLButtonElement).disabled).toBe(
        true,
      );
    },
  );

  it('checks a fiat-loan draft against the corresponding sat maximum', () => {
    show(
      loan({
        goalCurrency: 'PHP',
        goalAmount: '480.28',
        maxSats: 10,
        maxAmount: '480.28',
      }),
    );
    fireEvent.change(screen.getByLabelText('Amount (PHP)'), { target: { value: '1.00' } });
    expect(screen.getByText('Enter at most ₱480.28 · ₿10.')).toBeTruthy();
    expect(
      (screen.getByRole('button', { name: 'Pay this amount' }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });

  it('explains a missing conversion rate for a fiat-loan draft', () => {
    const php = loan({
      goalCurrency: 'PHP',
      goalAmount: '480.28',
      maxSats: 9_283,
      maxAmount: '480.28',
    });
    const fiat = renderWithLocale(payMoreState(php, vi.fn(), vi.fn()));
    fireEvent.change(screen.getByLabelText('Amount (PHP)'), { target: { value: '1.00' } });
    fiat.rerender(payMoreState(php, vi.fn(), vi.fn(), { rateDay: null }));
    expect(screen.getByText(/No PHP exchange rate is available now/)).toBeTruthy();
  });

  it('submits a fiat loan Max as the unchanged loan-currency string', () => {
    const php = loan({
      goalCurrency: 'PHP',
      goalAmount: '480.28',
      maxSats: 9_283,
      maxAmount: '480.28',
    });
    const { onPay } = show(php);
    fireEvent.click(screen.getByRole('button', { name: 'Max' }));
    expect((screen.getByLabelText('Amount (PHP)') as HTMLInputElement).value).toBe('480.28');
    fireEvent.click(screen.getByRole('button', { name: 'Pay this amount' }));
    expect(onPay).toHaveBeenCalledWith(expect.anything(), '480.28');
  });

  it('uses maximum-unavailable copy instead of an exchange-rate error for BTC', () => {
    show(loan({ maxSats: null }));
    expect(screen.getByText(/No BTC repayment maximum is available now/)).toBeTruthy();
    expect(screen.queryByText(/No BTC exchange rate/)).toBeNull();
  });

  it('shows the exact fiat figure and its bitcoin in the collecting confirmation', () => {
    const collecting = loan({
      goalCurrency: 'PHP',
      goalAmount: '480.28',
      fundedAt: null,
      closedAt: null,
      maxSats: 9_283,
      maxAmount: '480.28',
    });
    const { onPay } = show(collecting);
    fireEvent.change(screen.getByLabelText('Amount (PHP)'), { target: { value: '56.00' } });
    fireEvent.click(screen.getByRole('button', { name: 'Pay this amount' }));
    fireEvent.click(screen.getByRole('button', { name: "Pay ₱56.00 · ₿1'000 and end collecting" }));
    expect(onPay).toHaveBeenCalledWith(expect.anything(), '56.00');
  });

  it('confirms that a first payment ends collecting when closedAt is omitted', () => {
    const collecting = loan({ fundedAt: null, sats: 4_000, maxSats: 4_000 });
    delete collecting.closedAt;
    const { onPay } = show(collecting);
    fireEvent.change(screen.getByLabelText('Amount (₿)'), { target: { value: '1000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Pay this amount' }));
    const dialog = screen.getByRole('dialog', { name: 'Pay and end collecting?' });
    expect(dialog.textContent).toContain('This first payment ends collecting permanently.');
    fireEvent.click(screen.getByRole('button', { name: "Pay ₿1'000 and end collecting" }));
    expect(onPay).toHaveBeenCalledWith(expect.anything(), '1000');
  });

  it('keeps an invalidated pay dialog on a disabled pay action, never the close action', () => {
    const collecting = loan({ fundedAt: null, closedAt: null, sats: 4_000, maxSats: 4_000 });
    const { onPay, onCloseCollecting } = show(collecting);
    fireEvent.change(screen.getByLabelText('Amount (₿)'), { target: { value: '1000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Pay this amount' }));
    fireEvent.change(screen.getByLabelText('Amount (₿)'), { target: { value: 'bad' } });

    const dialog = screen.getByRole('dialog', { name: 'Pay and end collecting?' });
    expect(
      (within(dialog).getByRole('button', { name: 'Pay this amount' }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect(within(dialog).queryByRole('button', { name: 'End collecting permanently' })).toBeNull();
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toBeTruthy();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Pay this amount' }));
    expect(onPay).not.toHaveBeenCalled();
    expect(onCloseCollecting).not.toHaveBeenCalled();
  });

  it('confirms the final end-collecting action and does not show it after close', () => {
    const collecting = loan({ fundedAt: null, closedAt: null, sats: 4_000, maxSats: 4_000 });
    const { onCloseCollecting } = show(collecting);
    fireEvent.click(screen.getByRole('button', { name: 'End collecting' }));
    expect(screen.getByRole('dialog', { name: 'End collecting?' }).textContent).toContain(
      'This is final.',
    );
    fireEvent.click(screen.getByRole('button', { name: 'End collecting permanently' }));
    expect(onCloseCollecting).toHaveBeenCalledWith(collecting);
    cleanup();

    show({ ...collecting, closedAt: '2026-10-01T00:00:00.000Z' });
    expect(screen.queryByRole('button', { name: 'End collecting' })).toBeNull();
    expect(screen.getByRole('heading', { name: 'Pay more' })).toBeTruthy();
  });

  it('applies a smaller server maximum and explains an open earlier payment', () => {
    const item = loan();
    const view = show(item);
    fireEvent.change(screen.getByLabelText('Amount (₿)'), { target: { value: '7000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Pay this amount' }));
    view.rerender(
      <LoanPayMore
        loan={item}
        phase="failed"
        actionError={{
          messageId: 'loan-1',
          code: 'amount_too_high',
          maxSats: 6_000,
          maxAmount: null,
        }}
        errorKey="forum.payErrorRequest"
        balanceSats={21_000}
        missingSats={null}
        showShortfall
        sundayRest={false}
        showWalletStatus
        topUpOpen={false}
        username="ada"
        formatSats={testSats}
        onOpenTopUp={vi.fn()}
        onPay={view.onPay}
        onCloseCollecting={view.onCloseCollecting}
      />,
    );
    expect((screen.getByLabelText('Amount (₿)') as HTMLInputElement).value).toBe('6000');
    expect(screen.getByRole('alert').textContent).toContain("maximum changed to ₿6'000");
    fireEvent.change(screen.getByLabelText('Amount (₿)'), { target: { value: '6001' } });
    expect(screen.getByText("Enter at most ₿6'000.")).toBeTruthy();
    cleanup();

    const opened = show(item);
    fireEvent.change(screen.getByLabelText('Amount (₿)'), { target: { value: '1000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Pay this amount' }));
    opened.rerender(
      <LoanPayMore
        loan={item}
        phase="failed"
        actionError={{
          messageId: 'loan-1',
          code: 'payment_open',
          maxSats: null,
          maxAmount: null,
        }}
        errorKey="forum.payErrorRequest"
        balanceSats={21_000}
        missingSats={null}
        showShortfall
        sundayRest={false}
        showWalletStatus
        topUpOpen={false}
        username="ada"
        formatSats={testSats}
        onOpenTopUp={vi.fn()}
        onPay={opened.onPay}
        onCloseCollecting={opened.onCloseCollecting}
      />,
    );
    expect(screen.getByRole('alert').textContent).toBe(
      'An earlier payment for this share is still open. Try again later.',
    );
  });

  it.each(['amount_too_high', 'too_many_shares'] as const)(
    'does not reapply a consumed %s maximum after an unrelated rerender',
    (code) => {
      const item = loan();
      const view = show(item);
      fireEvent.change(screen.getByLabelText('Amount (₿)'), { target: { value: '7000' } });
      fireEvent.click(screen.getByRole('button', { name: 'Pay this amount' }));
      const refusal: LoanRepayActionError = {
        messageId: 'loan-1',
        code,
        maxSats: 6_000,
        maxAmount: null,
      };
      view.rerender(
        payMoreState(item, view.onPay, view.onCloseCollecting, {
          phase: 'failed',
          activeAction: { kind: 'prepay', messageId: 'loan-1' },
          actionError: refusal,
        }),
      );
      const input = screen.getByLabelText('Amount (₿)') as HTMLInputElement;
      expect(input.value).toBe('6000');
      fireEvent.change(input, { target: { value: '5000' } });
      view.rerender(
        payMoreState({ ...item }, view.onPay, view.onCloseCollecting, {
          phase: 'failed',
          activeAction: { kind: 'prepay', messageId: 'loan-1' },
          actionError: { ...refusal },
          formatSats: (sats) => `₿${sats}`,
        }),
      );
      expect(input.value).toBe('5000');
      expect(screen.queryByText(/maximum changed/)).toBeNull();
    },
  );

  it("does not apply another loan's action error", () => {
    const item = loan();
    const view = show(item);
    fireEvent.change(screen.getByLabelText('Amount (₿)'), { target: { value: '7000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Pay this amount' }));
    view.rerender(
      payMoreState(item, view.onPay, view.onCloseCollecting, {
        phase: 'failed',
        activeAction: { kind: 'prepay', messageId: 'loan-2' },
        actionError: {
          messageId: 'loan-2',
          code: 'amount_too_high',
          maxSats: 6_000,
          maxAmount: null,
        },
      }),
    );
    expect((screen.getByLabelText('Amount (₿)') as HTMLInputElement).value).toBe('7000');
    expect(screen.queryByText(/maximum changed/)).toBeNull();
  });

  it('ignores its pay-more visual pin outside a Playwright build', () => {
    window.history.replaceState({}, '', '/loans/repay?visual=repay-pay-more-sending');
    renderWithLocale(
      payMoreState(loan(), vi.fn(), vi.fn(), { phase: 'sending', activeAction: null }),
    );
    expect(screen.queryByText('Paying more…')).toBeNull();
    expect(
      (screen.getByRole('button', { name: 'Pay this amount' }) as HTMLButtonElement).disabled,
    ).toBe(true);
    window.history.replaceState({}, '', '/loans/repay');
  });

  it('applies a fiat server maximum and handles a response without a current maximum', () => {
    const php = loan({
      goalCurrency: 'PHP',
      goalAmount: '480.28',
      maxSats: 9_283,
      maxAmount: '480.28',
    });
    const fiat = show(php);
    fireEvent.change(screen.getByLabelText('Amount (PHP)'), { target: { value: '100.00' } });
    fireEvent.click(screen.getByRole('button', { name: 'Pay this amount' }));
    fiat.rerender(
      payMoreState(php, fiat.onPay, fiat.onCloseCollecting, {
        phase: 'failed',
        actionError: {
          messageId: 'loan-1',
          code: 'too_many_shares',
          maxSats: 2_000,
          maxAmount: '90.50',
        },
      }),
    );
    expect((screen.getByLabelText('Amount (PHP)') as HTMLInputElement).value).toBe('90.50');
    expect(screen.getByRole('alert').textContent).toContain("maximum changed to ₱90.50 · ₿2'000");
    cleanup();

    const btc = show();
    fireEvent.change(screen.getByLabelText('Amount (₿)'), { target: { value: '1000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Pay this amount' }));
    btc.rerender(
      payMoreState(loan(), btc.onPay, btc.onCloseCollecting, {
        phase: 'failed',
        actionError: {
          messageId: 'loan-1',
          code: 'amount_too_high',
          maxSats: null,
          maxAmount: null,
        },
      }),
    );
    expect(screen.getAllByRole('alert')).toHaveLength(1);
    expect(screen.getByRole('alert').textContent).toBe(
      'No BTC repayment maximum is available now, so paying more is disabled.',
    );
  });

  it('disables fiat repayment when a server maximum loses its rate', () => {
    const php = loan({
      goalCurrency: 'PHP',
      goalAmount: '480.28',
      maxSats: 9_283,
      maxAmount: '480.28',
    });
    const view = show(php);
    fireEvent.change(screen.getByLabelText('Amount (PHP)'), { target: { value: '100.00' } });
    fireEvent.click(screen.getByRole('button', { name: 'Pay this amount' }));
    view.rerender(
      payMoreState(php, view.onPay, view.onCloseCollecting, {
        phase: 'failed',
        actionError: {
          messageId: 'loan-1',
          code: 'amount_too_high',
          maxSats: null,
          maxAmount: '90.50',
        },
      }),
    );

    expect((screen.getByLabelText('Amount (PHP)') as HTMLInputElement).value).toBe('100.00');
    expect(screen.getByText(/No PHP exchange rate is available now/)).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Max' }) as HTMLButtonElement).disabled).toBe(true);
    expect(
      (screen.getByRole('button', { name: 'Pay this amount' }) as HTMLButtonElement).disabled,
    ).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Pay this amount' }));
    expect(view.onPay).toHaveBeenCalledTimes(1);
  });

  it('replaces an earlier fiat server maximum with a consecutive response without a rate', () => {
    const php = loan({
      goalCurrency: 'PHP',
      goalAmount: '480.28',
      maxSats: 9_283,
      maxAmount: '480.28',
    });
    const view = show(php);
    fireEvent.change(screen.getByLabelText('Amount (PHP)'), { target: { value: '100.00' } });
    fireEvent.click(screen.getByRole('button', { name: 'Pay this amount' }));
    view.rerender(
      payMoreState(php, view.onPay, view.onCloseCollecting, {
        phase: 'failed',
        actionError: {
          messageId: 'loan-1',
          code: 'too_many_shares',
          maxSats: 2_000,
          maxAmount: '90.50',
        },
      }),
    );
    expect((screen.getByLabelText('Amount (PHP)') as HTMLInputElement).value).toBe('90.50');
    fireEvent.click(screen.getByRole('button', { name: 'Pay this amount' }));
    expect(view.onPay).toHaveBeenCalledTimes(2);

    view.rerender(
      payMoreState(php, view.onPay, view.onCloseCollecting, {
        phase: 'failed',
        actionError: {
          messageId: 'loan-1',
          code: 'amount_too_high',
          maxSats: null,
          maxAmount: null,
        },
      }),
    );
    expect(screen.getByText(/No PHP exchange rate is available now/)).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Max' }) as HTMLButtonElement).disabled).toBe(true);
    expect(
      (screen.getByRole('button', { name: 'Pay this amount' }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });

  it('clears a completed free payment and shows an untyped wallet failure', () => {
    const item = loan();
    const completed = show(item);
    fireEvent.change(screen.getByLabelText('Amount (₿)'), { target: { value: '1000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Pay this amount' }));
    completed.rerender(
      payMoreState(item, completed.onPay, completed.onCloseCollecting, {
        phase: 'repaid',
        activeAction: { kind: 'prepay', messageId: 'loan-1' },
      }),
    );
    expect((screen.getByLabelText('Amount (₿)') as HTMLInputElement).value).toBe('');
    cleanup();

    const failed = show(item);
    fireEvent.change(screen.getByLabelText('Amount (₿)'), { target: { value: '1000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Pay this amount' }));
    failed.rerender(
      payMoreState(item, failed.onPay, failed.onCloseCollecting, {
        phase: 'failed',
        activeAction: { kind: 'prepay', messageId: 'loan-1' },
        errorKey: 'forum.payErrorRequest',
      }),
    );
    expect(screen.getByRole('alert').textContent).toBe('Could not start the Bitcoin payment');
  });

  it('reuses the wallet top-up controls after a free payment is short', () => {
    const item = loan();
    const openTopUp = vi.fn();
    const onPay = vi.fn();
    const onCloseCollecting = vi.fn();
    const view = renderWithLocale(
      <LoanPayMore
        loan={item}
        phase="idle"
        actionError={null}
        errorKey={null}
        balanceSats={500}
        missingSats={null}
        showShortfall
        sundayRest={false}
        showWalletStatus
        topUpOpen={false}
        username="ada"
        formatSats={testSats}
        onOpenTopUp={openTopUp}
        onPay={onPay}
        onCloseCollecting={onCloseCollecting}
      />,
    );
    fireEvent.change(screen.getByLabelText('Amount (₿)'), { target: { value: '1000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Pay this amount' }));
    view.rerender(
      <LoanPayMore
        loan={item}
        phase="idle"
        activeAction={{ kind: 'prepay', messageId: 'loan-1' }}
        actionError={null}
        errorKey={null}
        balanceSats={500}
        missingSats={500}
        showShortfall
        sundayRest={false}
        showWalletStatus
        topUpOpen={false}
        username="ada"
        formatSats={testSats}
        onOpenTopUp={openTopUp}
        onPay={onPay}
        onCloseCollecting={onCloseCollecting}
      />,
    );
    expect(screen.getByText('Your wallet has ₿500. Still missing ₿500.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Top up your wallet' }));
    expect(openTopUp).toHaveBeenCalledTimes(1);
    view.rerender(
      <LoanPayMore
        loan={item}
        phase="idle"
        activeAction={{ kind: 'prepay', messageId: 'loan-1' }}
        actionError={null}
        errorKey={null}
        balanceSats={500}
        missingSats={500}
        showShortfall
        sundayRest={false}
        showWalletStatus
        topUpOpen
        username={null}
        formatSats={testSats}
        onOpenTopUp={openTopUp}
        onPay={onPay}
        onCloseCollecting={onCloseCollecting}
      />,
    );
    expect(screen.getByRole('status').textContent).toBe('Waiting for your top-up…');
  });

  it('shows pinned sending, unconfirmed, and address-backed shortfall states', async () => {
    const beforeNow = process.env.NEXT_PUBLIC_E2E_NOW;
    const beforePath = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    try {
      process.env.NEXT_PUBLIC_E2E_NOW = '2026-11-11T12:00:00.000Z';
      window.history.replaceState({}, '', '/loans/repay?visual=repay-pay-more-sending');
      const item = loan();
      const onPay = vi.fn();
      const onCloseCollecting = vi.fn();
      const view = renderWithLocale(
        payMoreState(item, onPay, onCloseCollecting, {
          phase: 'sending',
          activeAction: { kind: 'prepay', messageId: 'loan-1' },
        }),
      );
      expect(screen.getByRole('status').textContent).toBe('Paying more…');

      view.rerender(
        payMoreState(item, onPay, onCloseCollecting, {
          phase: 'unconfirmed',
          activeAction: { kind: 'prepay', messageId: 'loan-1' },
        }),
      );
      expect(screen.getByRole('status').textContent).toContain('not confirmed');

      view.rerender(
        payMoreState(item, onPay, onCloseCollecting, {
          balanceSats: null,
          missingSats: 500,
          topUpOpen: true,
          activeAction: { kind: 'prepay', messageId: 'loan-1' },
        }),
      );
      expect(screen.getByText('Your wallet has –. Still missing ₿500.')).toBeTruthy();
      expect(await screen.findByText(/ada@/)).toBeTruthy();
    } finally {
      cleanup();
      window.history.replaceState({}, '', beforePath);
      if (beforeNow === undefined) {
        delete process.env.NEXT_PUBLIC_E2E_NOW;
      } else {
        process.env.NEXT_PUBLIC_E2E_NOW = beforeNow;
      }
    }
  });

  it('shows prepay waiting recipients with the same muted waiting copy', () => {
    renderWithLocale(
      <LoanPayMore
        loan={loan({
          goalCurrency: 'PHP',
          goalAmount: '480.28',
          maxSats: 9_283,
          maxAmount: '480.28',
        })}
        phase="waiting"
        activeAction={{ kind: 'prepay', messageId: 'loan-1' }}
        actionError={null}
        errorKey={null}
        prepayWaiting={[
          {
            dayIndex: 2,
            recipientAccountId: 'acc_waiting',
            name: 'Carla',
            username: 'carla',
            amountSats: 200,
            amount: null,
          },
          {
            dayIndex: 3,
            recipientAccountId: 'acc_waiting_fiat',
            name: 'Diego',
            username: 'diego',
            amountSats: 50,
            amount: '2.50',
          },
        ]}
        balanceSats={21_000}
        missingSats={null}
        showShortfall
        sundayRest={false}
        showWalletStatus
        topUpOpen={false}
        username="ada"
        formatSats={(sats) => (sats === 200 ? '₿200 · $0.20' : `₿${sats}`)}
        onOpenTopUp={vi.fn()}
        onPay={vi.fn()}
        onCloseCollecting={vi.fn()}
      />,
    );
    expect(screen.getByText('Waiting for Carla to set up their wallet')).toBeTruthy();
    expect(screen.getByText('Waiting for Diego to set up their wallet')).toBeTruthy();
    expect(screen.getByText('₿200 · $0.20')).toBeTruthy();
    expect(screen.getByText('₱2.50 · ₿50')).toBeTruthy();
  });

  it('shows close progress and a close-specific action error', () => {
    const collecting = loan({ fundedAt: null, closedAt: null, sats: 4_000, maxSats: 4_000 });
    const view = show(collecting);
    fireEvent.click(screen.getByRole('button', { name: 'End collecting' }));
    fireEvent.click(screen.getByRole('button', { name: 'End collecting permanently' }));
    view.rerender(
      payMoreState(collecting, view.onPay, view.onCloseCollecting, {
        phase: 'sending',
        activeAction: { kind: 'close', messageId: 'loan-1' },
      }),
    );
    expect(screen.getByRole('status').textContent).toBe('Ending collecting…');

    view.rerender(
      payMoreState(collecting, view.onPay, view.onCloseCollecting, {
        phase: 'failed',
        actionError: {
          messageId: 'loan-1',
          code: 'request_failed',
          maxSats: null,
          maxAmount: null,
        },
      }),
    );
    expect(screen.getByRole('alert')).toBeTruthy();
  });

  it('keeps a collecting confirmation open when repayment becomes unavailable', () => {
    const collecting = loan({ fundedAt: null, closedAt: null, sats: 4_000, maxSats: 4_000 });
    const view = show(collecting);
    fireEvent.change(screen.getByLabelText('Amount (₿)'), { target: { value: '1000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Pay this amount' }));
    view.rerender(
      payMoreState(collecting, view.onPay, view.onCloseCollecting, { sundayRest: true }),
    );
    fireEvent.click(screen.getByRole('button', { name: "Pay ₿1'000 and end collecting" }));
    expect(view.onPay).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog', { name: 'Pay and end collecting?' })).toBeTruthy();

    view.rerender(
      payMoreState(collecting, view.onPay, view.onCloseCollecting, { phase: 'unconfirmed' }),
    );
    fireEvent.click(screen.getByRole('button', { name: "Pay ₿1'000 and end collecting" }));
    expect(view.onPay).not.toHaveBeenCalled();
  });

  it('dismisses collecting confirmations from both close controls', () => {
    const collecting = loan({ fundedAt: null, closedAt: null, sats: 4_000, maxSats: 4_000 });
    show(collecting);
    fireEvent.click(screen.getByRole('button', { name: 'End collecting' }));
    const dialog = screen.getByRole('dialog', { name: 'End collecting?' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'End collecting' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('keeps free repayment disabled on Sunday and while the wallet is unavailable', () => {
    const item = loan();
    const onPay = vi.fn();
    const common = {
      loan: item,
      actionError: null,
      errorKey: null,
      balanceSats: null,
      missingSats: null,
      showShortfall: true,
      topUpOpen: false,
      username: null,
      formatSats: (sats: number) => `₿${sats}`,
      onOpenTopUp: vi.fn(),
      onPay,
      onCloseCollecting: vi.fn(),
    };
    const view = renderWithLocale(
      <LoanPayMore {...common} phase="unavailable" sundayRest showWalletStatus />,
    );
    fireEvent.change(screen.getByLabelText('Amount (₿)'), { target: { value: '1000' } });
    expect(screen.getByText('Repayments rest on Sundays. Try again tomorrow.')).toBeTruthy();
    expect(screen.getByText(/wallet is not available here/)).toBeTruthy();
    expect(
      (screen.getByRole('button', { name: 'Pay this amount' }) as HTMLButtonElement).disabled,
    ).toBe(true);
    expect(onPay).not.toHaveBeenCalled();

    view.rerender(
      <LoanPayMore {...common} phase="connecting" sundayRest={false} showWalletStatus />,
    );
    expect(screen.getByRole('status').textContent).toBe('Checking your wallet…');
    view.rerender(
      <LoanPayMore
        {...common}
        phase="unavailable"
        activeAction={{ kind: 'prepay', messageId: 'loan-2' }}
        sundayRest={false}
        showWalletStatus
      />,
    );
    expect(screen.queryByText(/wallet is not available here/)).toBeNull();
    view.rerender(
      <LoanPayMore {...common} phase="setupFailed" sundayRest={false} showWalletStatus />,
    );
    expect(screen.getByRole('alert').textContent).toBe('Wallet setup failed');
  });
});
