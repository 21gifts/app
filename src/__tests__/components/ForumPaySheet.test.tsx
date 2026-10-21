import { cleanup, fireEvent, screen, within } from '@testing-library/react';
import type { ReactElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Collapse } from '@/components/Collapse';
import { ForumPaySheet, type ForumPayError } from '@/components/ForumPaySheet';
import { PAY_SHEET_HOLD_MS } from '@/components/PaySheet';
import { useWalletPay } from '@/hooks/useWalletPay';
import { renderWithLocale } from '@/__tests__/render-with-locale';
import { payFromWallet } from '@/lib/wallet/wallet-service';
import { confirmResult, resetWallet, setWalletUsable } from '@/__tests__/wallet-pay-fixture';
import type { FiatRateDay } from '@/lib/stats-money';

vi.mock('@/hooks/useWalletPay', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/hooks/useWalletPay')>();
  return { ...actual, useWalletPay: vi.fn(actual.useWalletPay) };
});

vi.mock('@/lib/wallet/wallet-service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/wallet/wallet-service')>();
  return { ...actual, payFromWallet: vi.fn() };
});

const DAY: FiatRateDay = {
  sats: 100_000_000,
  usd: '100000.00',
  chf: '80000.00',
  eur: '90000.00',
  php: '5600000.00',
};

function sheet(
  error: ForumPayError,
  invoice: boolean,
  extra?: { payBusy?: boolean; ratePending?: boolean },
): {
  onPaySubmit: ReturnType<typeof vi.fn>;
  onPayCancel: ReturnType<typeof vi.fn>;
  onPayDraftChange: ReturnType<typeof vi.fn>;
} {
  const onPaySubmit = vi.fn(() => undefined);
  const onPayCancel = vi.fn();
  const onPayDraftChange = vi.fn();
  renderWithLocale(
    <ForumPaySheet
      messageId="c-1"
      payDraft="21"
      payBusy={extra?.payBusy ?? false}
      payError={error}
      payInvoice={invoice ? { messageId: 'c-1', pr: 'lnbc1', amountSats: 21 } : null}
      onPayDraftChange={onPayDraftChange}
      onPayUnitChange={vi.fn()}
      onPaySubmit={onPaySubmit}
      onPayCancel={onPayCancel}
      rateDay={DAY}
      {...(extra?.ratePending === undefined ? {} : { ratePending: extra.ratePending })}
      onInteract={vi.fn()}
      recipient="Ana"
    />,
  );
  return { onPaySubmit, onPayCancel, onPayDraftChange };
}

describe('ForumPaySheet', () => {
  afterEach(() => {
    cleanup();
    resetWallet();
  });

  it.each([
    ['a gift', {}, 'gift'],
    ['a posting fee', { postsOnPay: true }, 'post_fee'],
  ])('pays %s under its flow', (_label, extra, flow) => {
    renderWithLocale(
      <ForumPaySheet
        messageId="c-1"
        payDraft="21"
        payBusy={false}
        payError={null}
        payInvoice={{ messageId: 'c-1', pr: 'lnbc1', amountSats: 21, ...extra }}
        onPayDraftChange={vi.fn()}
        onPayUnitChange={vi.fn()}
        onPaySubmit={vi.fn()}
        onPayCancel={vi.fn()}
        rateDay={DAY}
        onInteract={vi.fn()}
      />,
    );
    expect(vi.mocked(useWalletPay).mock.calls.at(-1)?.[3]).toBe(flow);
  });

  it('shows the typed fiat on the confirmation, not the spot of the sats', () => {
    renderWithLocale(
      <ForumPaySheet
        messageId="c-1"
        payDraft="21"
        payBusy={false}
        payError={null}
        payInvoice={{
          messageId: 'c-1',
          pr: 'lnbc1',
          amountSats: 21,
          figure: { code: 'USD', amount: '12' },
        }}
        onPayDraftChange={vi.fn()}
        onPayUnitChange={vi.fn()}
        onPaySubmit={vi.fn()}
        onPayCancel={vi.fn()}
        rateDay={DAY}
        onInteract={vi.fn()}
        recipient="Ana"
      />,
    );
    expect(screen.getAllByText('$12.00').length).toBeGreaterThan(0);
    expect(screen.queryByText('$0.02')).toBeTruthy();
  });

  it('shows the amount form and submits the draft', () => {
    const { onPaySubmit, onPayCancel } = sheet(null, false);
    expect(screen.getByLabelText('Amount')).toBeTruthy();
    expect(screen.getByText('$0.02')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(onPaySubmit).toHaveBeenCalledTimes(1);
    const close = screen.getByRole('button', { name: 'Close' });
    expect(close.parentElement?.className).toBe('absolute left-3 top-3');
    const form = close.closest('[data-pay-amount]');
    expect(form?.className).toContain('pl-12');
    expect(form?.className).toContain('pt-12');
    fireEvent.click(close);
    expect(onPayCancel).toHaveBeenCalledTimes(1);
  });

  it('shows the habit amount sentence, not the forum amount sentence', () => {
    sheet('habitAmount', false);
    expect(screen.getByRole('alert').textContent).toBe(
      'Expected a JSON body with an integer "amountSats"',
    );
    expect(screen.queryByText('Enter a whole number greater than zero')).toBeNull();
  });

  it('does not submit while busy or while the rate is still loading', () => {
    const busy = sheet(null, false, { payBusy: true });
    const busyButton = screen.getByRole('button', { name: 'Continue' }) as HTMLButtonElement;
    expect(busyButton.disabled).toBe(true);
    fireEvent.submit(busyButton.closest('form') as HTMLFormElement);
    expect(busy.onPaySubmit).not.toHaveBeenCalled();
    cleanup();

    const pending = sheet(null, false, { ratePending: true });
    const pendingButton = screen.getByRole('button', { name: 'Continue' }) as HTMLButtonElement;
    expect(pendingButton.disabled).toBe(true);
    fireEvent.submit(pendingButton.closest('form') as HTMLFormElement);
    expect(pending.onPaySubmit).not.toHaveBeenCalled();
  });

  it.each([
    [
      'a loan that still collects',
      false,
      'Maria',
      'Lend to Maria',
      'Lend ₿210',
      'lend',
      'Lent to Maria',
    ],
    ['a full loan', true, 'Maria', 'Send to Maria', 'Send ₿210', 'full', 'Sent to Maria'],
    ['a loan without a name', false, undefined, 'Send', 'Lend ₿210', 'lend', 'Sent'],
  ] as const)(
    'words the pay sheet of %s and keeps the notice in the amount form',
    async (_label, full, recipient, title, button, notice, success) => {
      vi.mocked(payFromWallet).mockReset().mockResolvedValue(confirmResult(undefined, 210));
      setWalletUsable('ready');
      const ui = (show: boolean): ReactElement => (
        <Collapse show={show} holdMs={PAY_SHEET_HOLD_MS}>
          <ForumPaySheet
            messageId="c-1"
            payDraft="210"
            payBusy={false}
            payError={null}
            payInvoice={{ messageId: 'c-1', pr: 'lnbc1', amountSats: 210, sparkInvoice: 'spark1x' }}
            onPayDraftChange={vi.fn()}
            onPaySubmit={vi.fn()}
            onPayCancel={vi.fn()}
            rateDay={null}
            onInteract={vi.fn()}
            loan={{ name: 'Maria', days: 30, full }}
            {...(recipient === undefined ? {} : { recipient })}
          />
        </Collapse>
      );
      const { rerender } = renderWithLocale(ui(true));
      const dialog = screen.getByRole('dialog');
      expect(dialog.getAttribute('aria-label')).toBe(title);
      expect(within(dialog).getByRole('heading', { level: 2 }).textContent).toBe(title);
      expect(within(dialog).getByText('₿210')).toBeTruthy();
      expect(dialog.querySelector('[data-loan-notice]')).toBeNull();
      const form = document.querySelector('form[data-pay-amount=""]');
      expect(form?.querySelector('[data-loan-notice]')?.getAttribute('data-loan-notice')).toBe(
        notice,
      );
      fireEvent.click(await within(dialog).findByRole('button', { name: button }));
      rerender(ui(false));
      expect((await screen.findByText(success)).closest('[role="status"]')).not.toBeNull();
      expect(screen.getByRole('dialog').getAttribute('data-pay-sheet')).toBe('success');
      resetWallet();
    },
  );

  it('keeps the amount form behind the sheet, disabled, while the invoice is open', () => {
    const { onPaySubmit, onPayCancel } = sheet(null, true);
    const form = document.querySelector('form[data-pay-amount=""]') as HTMLFormElement;
    expect(form).not.toBeNull();
    expect(form.hasAttribute('data-pay-sheet')).toBe(false);
    expect(document.querySelectorAll('[data-pay-sheet]')).toHaveLength(1);
    expect((screen.getByLabelText('Amount') as HTMLInputElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Continue' }) as HTMLButtonElement).disabled).toBe(
      true,
    );
    const dialog = screen.getByRole('dialog');
    expect(dialog.getAttribute('data-pay-sheet')).toBe('pay');
    expect(within(dialog).getByRole('heading', { level: 2 }).textContent).toBe('Send to Ana');
    expect(within(dialog).getByText('₿21')).toBeTruthy();
    expect(within(dialog).getByText('$0.02')).toBeTruthy();
    expect(
      within(dialog).getByText(
        'Your 21.gifts wallet is not available here, so this cannot be paid.',
      ),
    ).toBeTruthy();
    expect(screen.queryByRole('img', { name: 'Bitcoin payment QR code' })).toBeNull();
    expect(screen.queryByText(/Waiting for payment/)).toBeNull();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Close' }));
    expect(onPayCancel).toHaveBeenCalledTimes(1);
    expect(onPaySubmit).not.toHaveBeenCalled();
  });

  it('closes the sheet from the dimmed page', () => {
    const { onPayCancel } = sheet(null, true);
    const closes = screen.getAllByRole('button', { name: 'Close' });
    // amount form X, scrim, sheet X
    expect(closes).toHaveLength(3);
    const scrim = closes[1] as HTMLElement;
    expect(scrim.getAttribute('tabindex')).toBe('-1');
    fireEvent.click(scrim);
    expect(onPayCancel).toHaveBeenCalledTimes(1);
  });

  it('shows the success step once the host closes the payment without the member', async () => {
    vi.mocked(payFromWallet).mockReset().mockResolvedValue(confirmResult());
    setWalletUsable('ready');
    const ui = (show: boolean): ReactElement => (
      <Collapse show={show} holdMs={PAY_SHEET_HOLD_MS}>
        <ForumPaySheet
          messageId="c-1"
          payDraft="21"
          payBusy={false}
          payError={null}
          payInvoice={{ messageId: 'c-1', pr: 'lnbc1', amountSats: 21, sparkInvoice: 'spark1x' }}
          onPayDraftChange={vi.fn()}
          onPaySubmit={vi.fn()}
          onPayCancel={vi.fn()}
          rateDay={DAY}
          onInteract={vi.fn()}
          recipient="Ana"
        />
      </Collapse>
    );
    const { rerender } = renderWithLocale(ui(true));
    fireEvent.click(await screen.findByRole('button', { name: 'Send ₿21 · $0.02' }));
    expect(payFromWallet).toHaveBeenCalledWith({ type: 'input', input: 'spark1x' });
    rerender(ui(false));
    const status = (await screen.findByText('Sent to Ana')).closest('[role="status"]');
    expect(screen.getByRole('dialog').getAttribute('data-pay-sheet')).toBe('success');
    expect(status).not.toBeNull();
    expect(status?.textContent).toContain('₿21');
    expect(status?.textContent).toContain('$0.02');
    resetWallet();
  });

  it('pays a posting fee without an amount form and without a loan notice', async () => {
    vi.mocked(payFromWallet).mockReset().mockResolvedValue(confirmResult());
    setWalletUsable('ready');
    const ui = (show: boolean): ReactElement => (
      <Collapse show={show} holdMs={PAY_SHEET_HOLD_MS}>
        <ForumPaySheet
          messageId="c-1"
          payDraft=""
          payBusy={false}
          payError={null}
          payInvoice={{
            messageId: 'c-1',
            pr: 'lnbc1',
            amountSats: 21,
            postsOnPay: true,
            sparkInvoice: 'spark1x',
          }}
          onPayDraftChange={vi.fn()}
          onPaySubmit={vi.fn()}
          onPayCancel={vi.fn()}
          rateDay={DAY}
          onInteract={vi.fn()}
          loan={{ name: 'Maria', days: 30, full: false }}
          recipient="Maria"
        />
      </Collapse>
    );
    const { rerender } = renderWithLocale(ui(true));
    expect(screen.queryByLabelText('Amount')).toBeNull();
    expect(document.querySelector('form[data-pay-amount]')).toBeNull();
    expect(document.querySelector('[data-loan-notice]')).toBeNull();
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByRole('heading', { level: 2 }).textContent).toBe('Pay to post');
    fireEvent.click(await within(dialog).findByRole('button', { name: 'Pay ₿21 and post' }));
    rerender(ui(false));
    expect((await screen.findByText('Paid and posted')).closest('[role="status"]')).not.toBeNull();
    resetWallet();
  });

  it('reads Send without a recipient and shows no sheet for another card', () => {
    renderWithLocale(
      <ForumPaySheet
        messageId="c-1"
        payDraft="21"
        payBusy={false}
        payError={null}
        payInvoice={{ messageId: 'c-1', pr: 'lnbc1', amountSats: 21 }}
        onPayDraftChange={vi.fn()}
        onPaySubmit={vi.fn()}
        onPayCancel={vi.fn()}
        rateDay={DAY}
        onInteract={vi.fn()}
      />,
    );
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Send');
    cleanup();
    renderWithLocale(
      <ForumPaySheet
        messageId="c-2"
        payDraft="21"
        payBusy={false}
        payError={null}
        payInvoice={{ messageId: 'c-1', pr: 'lnbc1', amountSats: 21 }}
        onPayDraftChange={vi.fn()}
        onPaySubmit={vi.fn()}
        onPayCancel={vi.fn()}
        rateDay={DAY}
        onInteract={vi.fn()}
      />,
    );
    expect(screen.queryByRole('dialog')).toBeNull();
    expect((screen.getByLabelText('Amount') as HTMLInputElement).disabled).toBe(false);
  });
});
