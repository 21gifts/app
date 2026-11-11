import { cleanup, fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LoanPayMore } from '@/components/LoanPayMore';
import type { LoanRepayActionError } from '@/hooks/useLoanRepay';
import type { MyLoan } from '@/lib/api';
import { renderWithLocale } from '@/__tests__/render-with-locale';

vi.mock('@/components/WalletSetupNote', () => ({
  WalletSetupNote: () => <p role="alert">Wallet setup failed</p>,
}));

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
      showWalletStatus
      topUpOpen={false}
      username="ada"
      formatSats={(sats) => `₿${sats}`}
      onOpenTopUp={vi.fn()}
      onPay={onPay}
      onCloseCollecting={onCloseCollecting}
    />,
  );
  return { onPay, onCloseCollecting, rerender: view.rerender };
}

afterEach(cleanup);

describe('LoanPayMore', () => {
  it('fills Max exactly and pays a valid BTC amount', () => {
    const { onPay } = show();
    const input = screen.getByLabelText('Amount (₿)') as HTMLInputElement;
    expect(
      (screen.getByRole('button', { name: 'Pay this amount' }) as HTMLButtonElement).disabled,
    ).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Max' }));
    expect(input.value).toBe('7500');
    fireEvent.click(screen.getByRole('button', { name: 'Pay this amount' }));
    expect(onPay).toHaveBeenCalledWith(expect.objectContaining({ messageId: 'loan-1' }), '7500');
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
    expect(screen.getByText('Enter at most ₱480.28.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Max' }));
    expect(input.value).toBe('480.28');
    fireEvent.click(screen.getByRole('button', { name: 'Pay this amount' }));
    expect(onPay).toHaveBeenCalledWith(expect.anything(), '480.28');
    cleanup();

    show({ ...php, maxSats: null, maxAmount: null });
    expect(screen.getByText(/No PHP exchange rate is available now/)).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Max' }) as HTMLButtonElement).disabled).toBe(true);
    expect(
      (screen.getByRole('button', { name: 'Pay this amount' }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });

  it('confirms that a first payment ends collecting', () => {
    const collecting = loan({ fundedAt: null, closedAt: null, sats: 4_000, maxSats: 4_000 });
    const { onPay } = show(collecting);
    fireEvent.change(screen.getByLabelText('Amount (₿)'), { target: { value: '1000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Pay this amount' }));
    const dialog = screen.getByRole('dialog', { name: 'Pay and end collecting?' });
    expect(dialog.textContent).toContain('This first payment ends collecting permanently.');
    fireEvent.click(screen.getByRole('button', { name: "Pay ₿1'000 and end collecting" }));
    expect(onPay).toHaveBeenCalledWith(expect.anything(), '1000');
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
        actionError={{ code: 'amount_too_high', maxSats: 6_000, maxAmount: null }}
        errorKey="forum.payErrorRequest"
        balanceSats={21_000}
        missingSats={null}
        showShortfall
        sundayRest={false}
        showWalletStatus
        topUpOpen={false}
        username="ada"
        formatSats={(sats) => `₿${sats}`}
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
        actionError={{ code: 'payment_open', maxSats: null, maxAmount: null }}
        errorKey="forum.payErrorRequest"
        balanceSats={21_000}
        missingSats={null}
        showShortfall
        sundayRest={false}
        showWalletStatus
        topUpOpen={false}
        username="ada"
        formatSats={(sats) => `₿${sats}`}
        onOpenTopUp={vi.fn()}
        onPay={opened.onPay}
        onCloseCollecting={opened.onCloseCollecting}
      />,
    );
    expect(screen.getByRole('alert').textContent).toBe(
      'An earlier payment for this share is still open. Try again later.',
    );
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
        formatSats={(sats) => `₿${sats}`}
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
        actionError={null}
        errorKey={null}
        balanceSats={500}
        missingSats={500}
        showShortfall
        sundayRest={false}
        showWalletStatus
        topUpOpen={false}
        username="ada"
        formatSats={(sats) => `₿${sats}`}
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
        actionError={null}
        errorKey={null}
        balanceSats={500}
        missingSats={500}
        showShortfall
        sundayRest={false}
        showWalletStatus
        topUpOpen
        username={null}
        formatSats={(sats) => `₿${sats}`}
        onOpenTopUp={openTopUp}
        onPay={onPay}
        onCloseCollecting={onCloseCollecting}
      />,
    );
    expect(screen.getByRole('status').textContent).toBe('Waiting for your top-up…');
  });

  it('shows prepay waiting recipients with the same muted waiting copy', () => {
    renderWithLocale(
      <LoanPayMore
        loan={loan()}
        phase="waiting"
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
        ]}
        balanceSats={21_000}
        missingSats={null}
        showShortfall
        sundayRest={false}
        showWalletStatus
        topUpOpen={false}
        username="ada"
        formatSats={(sats) => `₿${sats}`}
        onOpenTopUp={vi.fn()}
        onPay={vi.fn()}
        onCloseCollecting={vi.fn()}
      />,
    );
    expect(screen.getByText('Waiting for Carla to set up their wallet')).toBeTruthy();
    expect(screen.getByText('₿200')).toBeTruthy();
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
      <LoanPayMore {...common} phase="setupFailed" sundayRest={false} showWalletStatus />,
    );
    expect(screen.getByRole('alert').textContent).toBe('Wallet setup failed');
  });
});
