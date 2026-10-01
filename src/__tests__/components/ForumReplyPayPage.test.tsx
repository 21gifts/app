import { cleanup, fireEvent, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ForumReplyPayPage } from '@/components/ForumReplyPayPage';
import { payFromWallet } from '@/lib/wallet/wallet-service';
import { walletOfSatoshiHref } from '@/lib/wos-deep-link';
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

const locationAssign = vi.fn();
const locationStub = { assign: locationAssign, href: 'http://localhost/' };

const RATE_DAY = {
  sats: 100_000_000,
  usd: '100000.00',
  chf: '80000.00',
  eur: '90000.00',
  php: '5600000.00',
};

beforeEach(() => {
  locationAssign.mockReset();
  locationStub.href = 'http://localhost/';
  vi.stubGlobal('location', locationStub);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('ForumReplyPayPage', () => {
  it('shows the preview, fiat suffix, QR, waiting line, and Close', async () => {
    const onCancel = vi.fn();
    renderWithLocale(
      <ForumReplyPayPage
        preview="Hi Bob"
        amountSats={21}
        pr="lnbc21n1example"
        payWaiting
        payBusy={false}
        showPaymentQr
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
    expect(await screen.findByRole('img', { name: 'Bitcoin payment QR code' })).toBeTruthy();
    expect(screen.getByText('Waiting for payment…')).toBeTruthy();
    expect(screen.queryByLabelText('Your reaction')).toBeNull();
    expect(screen.queryByLabelText('Amount')).toBeNull();
    expect(document.querySelector('textarea')).toBeNull();
    const close = screen.getByRole('button', { name: 'Close' });
    expect(screen.queryByRole('button', { name: 'Back' })).toBeNull();
    expect(close.parentElement?.className).toContain('absolute');
    expect(close.parentElement?.className).toContain('left-2');
    expect(close.parentElement?.className).toContain('top-2');
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
        payBusy={false}
        showPaymentQr={false}
        rateDay={null}
        onCancel={() => undefined}
      />,
    );
    expect(container.querySelector('p.whitespace-pre-wrap')).toBeNull();
    expect(screen.queryByRole('img', { name: 'Bitcoin payment QR code' })).toBeNull();
    expect(screen.queryByText('Waiting for payment…')).toBeNull();
  });

  it('omits the preview paragraph when the preview is whitespace only', () => {
    const { container } = renderWithLocale(
      <ForumReplyPayPage
        preview="   "
        amountSats={21}
        pr="lnbc21n1example"
        payWaiting={false}
        payBusy={false}
        showPaymentQr={false}
        rateDay={null}
        onCancel={() => undefined}
      />,
    );
    expect(container.querySelector('p.whitespace-pre-wrap')).toBeNull();
  });

  it('sets the wallet href when Pay with Wallet of Satoshi is clicked', () => {
    renderWithLocale(
      <ForumReplyPayPage
        preview="Hi Bob"
        amountSats={21}
        pr="lnbc21n1example"
        payWaiting={false}
        payBusy={false}
        showPaymentQr={false}
        rateDay={null}
        onCancel={() => undefined}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Pay with Wallet of Satoshi' }));
    expect(locationStub.href).toBe(walletOfSatoshiHref('lnbc21n1example'));
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
        payBusy={false}
        showPaymentQr
        rateDay={RATE_DAY}
        onCancel={vi.fn()}
      />,
    );
  }

  beforeEach(() => {
    vi.mocked(payFromWallet).mockReset().mockResolvedValue(confirmResult());
  });

  afterEach(resetWallet);

  it('pays the sparkInvoice from a usable wallet instead of the QR and wallet button', async () => {
    setWalletUsable('ready');
    renderPage(SPARK_INVOICE);
    expect(await screen.findByRole('button', { name: 'Pay from wallet' })).toBeTruthy();
    expect(payFromWallet).toHaveBeenCalledWith({ type: 'input', input: SPARK_INVOICE });
    expect(screen.queryByRole('img', { name: 'Bitcoin payment QR code' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Pay with Wallet of Satoshi' })).toBeNull();
    expect(screen.getByText('Waiting for payment…')).toBeTruthy();
  });

  it('keeps the existing path without a sparkInvoice', async () => {
    setWalletUsable('ready');
    renderPage(null);
    expect(await screen.findByRole('img', { name: 'Bitcoin payment QR code' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Pay with Wallet of Satoshi' })).toBeTruthy();
    expect(payFromWallet).not.toHaveBeenCalled();
  });

  it('keeps the existing path when the wallet is not usable', async () => {
    setWalletUsable('disabled');
    renderPage(SPARK_INVOICE);
    expect(screen.getByRole('button', { name: 'Pay with Wallet of Satoshi' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Pay from wallet' })).toBeNull();
    expect(payFromWallet).not.toHaveBeenCalled();
  });
});
