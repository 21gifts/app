import { cleanup, fireEvent, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WalletPay } from '@/components/WalletPay';
import { useWalletPay, type UseWalletPayResult, type WalletPayView } from '@/hooks/useWalletPay';
import type { FiatRateDay } from '@/lib/stats-money';
import { useAuthStore } from '@/stores/auth-store';
import { renderWithLocale } from '@/__tests__/render-with-locale';

vi.mock('@/hooks/useWalletPay', () => ({ useWalletPay: vi.fn() }));

const RATE_DAY: FiatRateDay = {
  sats: 100_000_000,
  usd: '100000.00',
  chf: '80000.00',
  eur: '90000.00',
  php: '5600000.00',
};

function hookWith(view: WalletPayView, feeSats: number | null = 0): UseWalletPayResult {
  const result = { view, feeSats, unlock: vi.fn(), pay: vi.fn() };
  vi.mocked(useWalletPay).mockReturnValue(result);
  return result;
}

function renderPay(sparkInvoice: string | null = 'spark1x'): void {
  renderWithLocale(
    <WalletPay
      sparkInvoice={sparkInvoice}
      amountSats={21}
      rateDay={RATE_DAY}
      fallback={<button type="button">Pay with Wallet of Satoshi</button>}
    />,
  );
}

beforeEach(() => {
  vi.mocked(useWalletPay).mockReset();
  useAuthStore.setState({
    session: 'token',
    account: { username: 'ada' } as never,
  });
});

afterEach(cleanup);

describe('WalletPay', () => {
  it('passes the request to the hook and renders the fallback unchanged', () => {
    hookWith('fallback');
    renderPay(null);
    expect(useWalletPay).toHaveBeenCalledWith(null, 21);
    expect(screen.getByRole('button', { name: 'Pay with Wallet of Satoshi' })).toBeTruthy();
  });

  it('offers Unlock wallet and hides the fallback', () => {
    const hook = hookWith('unlock');
    renderPay();
    expect(screen.getByText('Unlock your wallet to pay from your Bitcoin balance.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Unlock wallet' }));
    expect(hook.unlock).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: 'Pay with Wallet of Satoshi' })).toBeNull();
  });

  it('shows checking and paying as status lines without buttons', () => {
    hookWith('preparing');
    renderPay();
    expect(screen.getByRole('status').textContent).toBe('Checking your wallet…');
    expect(screen.queryByRole('button')).toBeNull();
    cleanup();
    hookWith('paying');
    renderPay();
    expect(screen.getByRole('status').textContent).toBe('Paying from your wallet…');
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('shows the fee with its fiat line before Pay from wallet', () => {
    const hook = hookWith('confirm', 0);
    renderPay();
    expect(screen.getByText(/Fee ₿0/)).toBeTruthy();
    expect(screen.getByText(/\$0\.00/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Pay from wallet' }));
    expect(hook.pay).toHaveBeenCalledTimes(1);
  });

  it('says the balance is too low and shows the own address and QR to add funds', () => {
    hookWith('insufficient');
    renderPay();
    expect(screen.getByRole('alert').textContent).toBe(
      'Your wallet does not have enough Bitcoin for this payment.',
    );
    expect(screen.getByText('To add Bitcoin, send it to your address:')).toBeTruthy();
    expect(screen.getByText(/^ada@/)).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Open CryptoPay QR code' })).toBeTruthy();
  });

  it('shows only the alert when the member has no username', () => {
    useAuthStore.setState({ account: { username: null } as never });
    hookWith('insufficient');
    renderPay();
    expect(screen.getByRole('alert')).toBeTruthy();
    expect(screen.queryByText('To add Bitcoin, send it to your address:')).toBeNull();
    expect(screen.queryByRole('img')).toBeNull();
  });

  it('shows the neutral not-confirmed sentence', () => {
    hookWith('unconfirmed');
    renderPay();
    expect(screen.getByRole('status').textContent).toBe(
      'This payment is not confirmed yet. Check your balance again later.',
    );
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
