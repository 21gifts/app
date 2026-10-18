import { cleanup, fireEvent, screen, within } from '@testing-library/react';
import type { ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Collapse } from '@/components/Collapse';
import { ForumReplyPayPage } from '@/components/ForumReplyPayPage';
import { PAY_SHEET_HOLD_MS } from '@/components/PaySheet';
import { useWalletPay } from '@/hooks/useWalletPay';
import { payFromWallet } from '@/lib/wallet/wallet-service';
import { renderWithLocale } from '@/__tests__/render-with-locale';
import {
  SPARK_INVOICE,
  confirmResult,
  resetWallet,
  setWalletUsable,
} from '@/__tests__/wallet-pay-fixture';

vi.mock('@/hooks/useWalletPay', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/hooks/useWalletPay')>();
  return { ...actual, useWalletPay: vi.fn(actual.useWalletPay) };
});

vi.mock('@/lib/wallet/wallet-service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/wallet/wallet-service')>();
  return { ...actual, payFromWallet: vi.fn() };
});

const RATE_DAY = {
  sats: 100_000_000,
  usd: '100000.00',
  chf: '80000.00',
  eur: '90000.00',
  php: '5600000.00',
};

afterEach(cleanup);

describe('ForumReplyPayPage', () => {
  it('pays as a paid reaction', () => {
    renderWithLocale(
      <ForumReplyPayPage
        amountSats={21}
        pr="lnbc21n1example"
        rateDay={RATE_DAY}
        onCancel={vi.fn()}
      />,
    );
    expect(vi.mocked(useWalletPay).mock.calls.at(-1)?.[3]).toBe('reaction');
  });

  it('shows the title, amount with fiat, wallet slot, and Close in a sheet', () => {
    const onCancel = vi.fn();
    renderWithLocale(
      <ForumReplyPayPage
        amountSats={21}
        pr="lnbc21n1example"
        rateDay={RATE_DAY}
        onCancel={onCancel}
        recipient="Bob"
      />,
    );
    expect(document.querySelector('[data-reply-pay-page]')).toBeNull();
    const dialog = screen.getByRole('dialog');
    expect(dialog.getAttribute('data-pay-sheet')).toBe('pay');
    expect(dialog.getAttribute('aria-label')).toBe('Send to Bob');
    expect(within(dialog).getByRole('heading', { level: 2 }).textContent).toBe('Send to Bob');
    expect(within(dialog).getByText('₿21')).toBeTruthy();
    expect(within(dialog).getByText('$0.02')).toBeTruthy();
    expect(screen.getByRole('status').textContent).toBe(
      'Your 21.gifts wallet is not available here, so this cannot be paid.',
    );
    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.queryByText(/Waiting for payment/)).toBeNull();
    expect(screen.queryByLabelText('Your reaction')).toBeNull();
    expect(screen.queryByLabelText('Amount')).toBeNull();
    expect(document.querySelector('textarea')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Back' })).toBeNull();
    const closes = screen.getAllByRole('button', { name: 'Close' });
    // The dimmed page comes first, then the sheet's X.
    expect(closes).toHaveLength(2);
    expect(dialog.contains(closes[0] as HTMLElement)).toBe(false);
    expect(dialog.contains(closes[1] as HTMLElement)).toBe(true);
    fireEvent.click(closes[1] as HTMLElement);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('reads Send without a name and shows no fiat line without a rate', () => {
    renderWithLocale(
      <ForumReplyPayPage amountSats={21} pr="lnbc21n1example" rateDay={null} onCancel={vi.fn()} />,
    );
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByRole('heading', { level: 2 }).textContent).toBe('Send');
    expect(within(dialog).queryByText(/\$/)).toBeNull();
    expect(screen.queryByRole('img')).toBeNull();
  });
});

describe('ForumReplyPayPage in-app wallet', () => {
  function renderPage(sparkInvoice?: string | null): void {
    renderWithLocale(
      <ForumReplyPayPage
        amountSats={21}
        pr="lnbc21n1example"
        {...(sparkInvoice === undefined ? {} : { sparkInvoice })}
        rateDay={RATE_DAY}
        onCancel={vi.fn()}
        recipient="Bob"
      />,
    );
  }

  beforeEach(() => {
    vi.mocked(payFromWallet).mockReset().mockResolvedValue(confirmResult());
  });

  afterEach(resetWallet);

  it('pays the sparkInvoice from the wallet, with no invoice QR and no wallet-app button', async () => {
    setWalletUsable('ready');
    renderPage(SPARK_INVOICE);
    const send = await screen.findByRole('button', { name: 'Send ₿21' });
    expect(send.textContent).toBe('Send ₿21');
    fireEvent.click(send);
    expect(payFromWallet).toHaveBeenCalledWith({ type: 'input', input: SPARK_INVOICE });
    expect(await screen.findByText('Paying from your wallet…')).toBeTruthy();
    expect(screen.queryByRole('img')).toBeNull();
    expect(
      screen.getAllByRole('button').map((button) => button.getAttribute('aria-label')),
    ).toEqual(['Close', 'Close']);
    expect(screen.queryByText(/Waiting for payment/)).toBeNull();
  });

  it('pays the payment request from the wallet without a sparkInvoice', async () => {
    setWalletUsable('ready');
    renderPage(null);
    expect(await screen.findByRole('button', { name: 'Send ₿21' })).toBeTruthy();
    expect(payFromWallet).toHaveBeenCalledWith({ type: 'input', input: 'lnbc21n1example' });
    expect(screen.queryByRole('img')).toBeNull();
  });

  it('words a loan that still collects as lending, with a Lend button and no notice', async () => {
    vi.mocked(payFromWallet).mockResolvedValue(confirmResult(undefined, 210));
    setWalletUsable('ready');
    renderWithLocale(
      <ForumReplyPayPage
        amountSats={210}
        pr="lnbc21n1example"
        sparkInvoice={SPARK_INVOICE}
        rateDay={RATE_DAY}
        onCancel={vi.fn()}
        loan={{ name: 'Maria', days: 30, full: false }}
        recipient="Maria"
      />,
    );
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Lend to Maria');
    expect(document.querySelector('[data-loan-notice]')).toBeNull();
    expect(await screen.findByRole('button', { name: 'Lend ₿210' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^Send/ })).toBeNull();
  });

  it('keeps Lend bitcoin-only without a rate and without a name', async () => {
    vi.mocked(payFromWallet).mockResolvedValue(confirmResult(undefined, 210));
    setWalletUsable('ready');
    renderWithLocale(
      <ForumReplyPayPage
        amountSats={210}
        pr="lnbc21n1example"
        sparkInvoice={SPARK_INVOICE}
        rateDay={null}
        onCancel={vi.fn()}
        loan={{ name: 'Maria', days: 30, full: false }}
      />,
    );
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Send');
    expect(await screen.findByRole('button', { name: 'Lend ₿210' })).toBeTruthy();
  });

  it('keeps Send on a full loan', async () => {
    setWalletUsable('ready');
    renderWithLocale(
      <ForumReplyPayPage
        amountSats={21}
        pr="lnbc21n1example"
        sparkInvoice={SPARK_INVOICE}
        rateDay={RATE_DAY}
        onCancel={vi.fn()}
        loan={{ name: 'Maria', days: 30, full: true }}
        recipient="Maria"
      />,
    );
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Send to Maria');
    expect(document.querySelector('[data-loan-notice]')).toBeNull();
    expect(await screen.findByRole('button', { name: 'Send ₿21' })).toBeTruthy();
  });

  it.each([
    ['a gift to a named member', 'Bob', undefined, 'Sent to Bob'],
    ['a loan that still collects', 'Maria', false, 'Lent to Maria'],
    ['a full loan', 'Maria', true, 'Sent to Maria'],
    ['a gift without a name', undefined, undefined, 'Sent'],
  ] as const)(
    'shows the success step of %s once the host closes the payment',
    async (_label, recipient, full, success) => {
      vi.mocked(payFromWallet).mockResolvedValue(confirmResult());
      setWalletUsable('ready');
      const ui = (show: boolean): ReactElement => (
        <Collapse show={show} holdMs={PAY_SHEET_HOLD_MS}>
          <ForumReplyPayPage
            amountSats={21}
            pr="lnbc21n1example"
            sparkInvoice={SPARK_INVOICE}
            rateDay={RATE_DAY}
            onCancel={vi.fn()}
            {...(recipient === undefined ? {} : { recipient })}
            {...(full === undefined ? {} : { loan: { name: 'Maria', days: 30, full } })}
          />
        </Collapse>
      );
      const { rerender } = renderWithLocale(ui(true));
      fireEvent.click(await screen.findByRole('button', { name: /₿21$/ }));
      rerender(ui(false));
      expect(screen.getByRole('dialog').getAttribute('data-pay-sheet')).toBe('success');
      const status = (await screen.findByText(success)).closest('[role="status"]');
      expect(status?.textContent).toContain('₿21');
    },
  );

  it('says the wallet is not available when it is not configured, and offers nothing else', () => {
    setWalletUsable('disabled');
    renderPage(SPARK_INVOICE);
    expect(
      screen.getByText('Your 21.gifts wallet is not available here, so this cannot be paid.'),
    ).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^Send/ })).toBeNull();
    expect(screen.queryByRole('img')).toBeNull();
    expect(
      screen.getAllByRole('button').map((button) => button.getAttribute('aria-label')),
    ).toEqual(['Close', 'Close']);
    expect(payFromWallet).not.toHaveBeenCalled();
  });
});
