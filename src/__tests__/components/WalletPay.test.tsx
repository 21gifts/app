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
  const result = { view, feeSats, unlock: vi.fn(), pay: vi.fn(), retry: vi.fn() };
  vi.mocked(useWalletPay).mockReturnValue(result);
  return result;
}

function renderPay(sparkInvoice: string | null = 'spark1x'): void {
  renderWithLocale(
    <WalletPay sparkInvoice={sparkInvoice} pr="lnbc210n1x" amountSats={21} rateDay={RATE_DAY} />,
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
  it('passes both requests and the amount to the hook', () => {
    hookWith('preparing');
    renderPay(null);
    expect(useWalletPay).toHaveBeenCalledWith(null, 'lnbc210n1x', 21);
  });

  it('says the wallet is not available here, without any button', () => {
    hookWith('unavailable');
    renderPay();
    expect(screen.getByRole('status').textContent).toBe(
      'Your 21.gifts wallet is not available here, so this cannot be paid.',
    );
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByRole('img')).toBeNull();
  });

  it('says the payment could not be prepared and Try again retries', () => {
    const hook = hookWith('failed');
    renderPay();
    expect(screen.getByRole('alert').textContent).toBe(
      'Your wallet could not prepare this payment. Please try again.',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(hook.retry).toHaveBeenCalledTimes(1);
    expect(hook.unlock).not.toHaveBeenCalled();
    expect(hook.pay).not.toHaveBeenCalled();
  });

  it('offers Unlock wallet as the only button', () => {
    const hook = hookWith('unlock');
    renderPay();
    expect(screen.getByText('Unlock your wallet to pay from your Bitcoin balance.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Unlock wallet' }));
    expect(hook.unlock).toHaveBeenCalledTimes(1);
    expect(screen.getAllByRole('button')).toHaveLength(1);
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

  it('shows the alert and the fallback when the member has no username', () => {
    useAuthStore.setState({ account: { username: null } as never });
    hookWith('insufficient');
    renderPay();
    expect(screen.getByRole('alert')).toBeTruthy();
    expect(screen.queryByText('To add Bitcoin, send it to your address:')).toBeNull();
    expect(screen.getByRole('button', { name: 'Pay with Wallet of Satoshi' })).toBeTruthy();
  });

  it('shows the fallback when a blank username gives no address', () => {
    useAuthStore.setState({ account: { username: '  ' } as never });
    hookWith('insufficient');
    renderPay();
    expect(screen.getByRole('button', { name: 'Pay with Wallet of Satoshi' })).toBeTruthy();
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
