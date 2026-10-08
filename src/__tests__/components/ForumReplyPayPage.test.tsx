import { cleanup, fireEvent, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ForumReplyPayPage } from '@/components/ForumReplyPayPage';
import { payFromWallet } from '@/lib/wallet/wallet-service';
import { renderWithLocale } from '@/__tests__/render-with-locale';
import {
  SPARK_INVOICE,
  confirmResult,
  resetWallet,
  setWalletUsable,
} from '@/__tests__/wallet-pay-fixture';

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
  it('shows the preview, fiat suffix, wallet slot, waiting line, and Close', () => {
    const onCancel = vi.fn();
    renderWithLocale(
      <ForumReplyPayPage
        preview="Hi Bob"
        amountSats={21}
        pr="lnbc21n1example"
        payWaiting
        rateDay={RATE_DAY}
        onCancel={onCancel}
      />,
    );
    const root = document.querySelector('[data-reply-pay-page]');
    expect(root).toBeTruthy();
    expect(root?.hasAttribute('data-pay-sheet')).toBe(true);
    expect(screen.getByText('Hi Bob')).toBeTruthy();
    expect(screen.getByText('Hi Bob').className).toContain('pl-12');
    expect(screen.getByText(/Pay ₿21/)).toBeTruthy();
    expect(screen.getByText('$0.02')).toBeTruthy();
    expect(screen.getByRole('status').textContent).toBe(
      'Your 21.gifts wallet is not available here, so this cannot be paid.',
    );
    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.getByText('Waiting for payment…')).toBeTruthy();
    expect(screen.queryByLabelText('Your reaction')).toBeNull();
    expect(screen.queryByLabelText('Amount')).toBeNull();
    expect(document.querySelector('textarea')).toBeNull();
    const close = screen.getByRole('button', { name: 'Close' });
    expect(screen.queryByRole('button', { name: 'Back' })).toBeNull();
    expect(close.parentElement?.className).toContain('absolute');
    expect(close.parentElement?.className).toContain('left-3');
    expect(close.parentElement?.className).toContain('top-3');
    fireEvent.click(close);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('omits the preview paragraph when the preview is empty', () => {
    const { container } = renderWithLocale(
      <ForumReplyPayPage
        preview=""
        amountSats={21}
        pr="lnbc21n1example"
        payWaiting={false}
        rateDay={null}
        onCancel={() => undefined}
      />,
    );
    expect(container.querySelector('p.whitespace-pre-wrap')).toBeNull();
    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.queryByText('Waiting for payment…')).toBeNull();
  });

  it('omits the preview paragraph when the preview is whitespace only', () => {
    const { container } = renderWithLocale(
      <ForumReplyPayPage
        preview="   "
        amountSats={21}
        pr="lnbc21n1example"
        payWaiting={false}
        rateDay={null}
        onCancel={() => undefined}
      />,
    );
    expect(container.querySelector('p.whitespace-pre-wrap')).toBeNull();
  });
});

describe('ForumReplyPayPage in-app wallet', () => {
  function renderPage(sparkInvoice?: string | null): void {
    renderWithLocale(
      <ForumReplyPayPage
        preview="Hi Bob"
        amountSats={21}
        pr="lnbc21n1example"
        {...(sparkInvoice === undefined ? {} : { sparkInvoice })}
        payWaiting
        rateDay={RATE_DAY}
        onCancel={vi.fn()}
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
    fireEvent.click(await screen.findByRole('button', { name: 'Send' }));
    expect(payFromWallet).toHaveBeenCalledWith({ type: 'input', input: SPARK_INVOICE });
    expect(await screen.findByText('Paying from your wallet…')).toBeTruthy();
    expect(screen.queryByRole('img')).toBeNull();
    expect(
      screen.getAllByRole('button').map((button) => button.getAttribute('aria-label')),
    ).toEqual(['Close']);
    expect(screen.getByText('Waiting for payment…')).toBeTruthy();
  });

  it('pays the payment request from the wallet without a sparkInvoice', async () => {
    setWalletUsable('ready');
    renderPage(null);
    expect(await screen.findByRole('button', { name: 'Send' })).toBeTruthy();
    expect(payFromWallet).toHaveBeenCalledWith({ type: 'input', input: 'lnbc21n1example' });
    expect(screen.queryByRole('img')).toBeNull();
  });

  it('says the wallet is not available when it is not configured, and offers nothing else', () => {
    setWalletUsable('disabled');
    renderPage(SPARK_INVOICE);
    expect(
      screen.getByText('Your 21.gifts wallet is not available here, so this cannot be paid.'),
    ).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Send' })).toBeNull();
    expect(screen.queryByRole('img')).toBeNull();
    expect(
      screen.getAllByRole('button').map((button) => button.getAttribute('aria-label')),
    ).toEqual(['Close']);
    expect(payFromWallet).not.toHaveBeenCalled();
  });
});
