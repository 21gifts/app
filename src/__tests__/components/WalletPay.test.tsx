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

function hookWith(
  view: WalletPayView,
  feeSats: number | null = 0,
  missingSats: number | null = null,
): UseWalletPayResult {
  const result = { view, feeSats, missingSats, unlock: vi.fn(), pay: vi.fn(), retry: vi.fn() };
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

  it('says this phone or browser cannot hold a wallet and Try again retries', () => {
    const hook = hookWith('prfUnsupported');
    renderPay();
    expect(screen.getByRole('alert').textContent).toBe(
      'This phone or browser cannot hold a 21.gifts wallet. Please use an up-to-date phone or browser that supports passkeys.',
    );
    expect(
      screen.queryByText('Your wallet could not prepare this payment. Please try again.'),
    ).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(hook.retry).toHaveBeenCalledTimes(1);
    expect(hook.unlock).not.toHaveBeenCalled();
  });

  it('offers Unlock and pay with the amount and its fiat as the only button', () => {
    const hook = hookWith('unlock');
    renderPay();
    const button = screen.getByRole('button', { name: /^Unlock and pay ₿21/ });
    expect(button.textContent).toBe('Unlock and pay ₿21 · $0.02');
    expect(button.children).toHaveLength(1);
    fireEvent.click(button);
    expect(hook.unlock).toHaveBeenCalledTimes(1);
    expect(hook.pay).not.toHaveBeenCalled();
    expect(screen.getAllByRole('button')).toHaveLength(1);
    expect(screen.queryByText('Unlock wallet')).toBeNull();
  });

  it('shows Unlock and pay without fiat while no rate is known', () => {
    hookWith('unlock');
    renderWithLocale(
      <WalletPay sparkInvoice="spark1x" pr="lnbc210n1x" amountSats={21} rateDay={null} />,
    );
    expect(screen.getByRole('button').textContent).toBe('Unlock and pay ₿21');
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

  it('says Bitcoin was received while it pays on its own after a top-up', () => {
    hookWith('received');
    renderPay();
    expect(screen.getByRole('status').textContent).toBe('Bitcoin received — paying…');
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
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
    expect(screen.queryByText(/Still missing/)).toBeNull();
  });

  it('says how much is still missing, in ₿ and fiat, above the own address', () => {
    hookWith('insufficient', 3, 1_234);
    renderPay();
    const missing = screen.getByText(/^Still missing: ₿1'234/, { selector: 'p' });
    expect(missing.textContent).toBe("Still missing: ₿1'234 · $1.23");
    expect(screen.getByText(/^ada@/)).toBeTruthy();
    cleanup();
    hookWith('insufficient', 3, 1_234);
    renderWithLocale(
      <WalletPay sparkInvoice="spark1x" pr="lnbc210n1x" amountSats={21} rateDay={null} />,
    );
    expect(screen.getByText(/^Still missing/).textContent).toBe("Still missing: ₿1'234");
  });

  it('shows the alert alone when the member has no username', () => {
    useAuthStore.setState({ account: { username: null } as never });
    hookWith('insufficient');
    renderPay();
    expect(screen.getByRole('alert')).toBeTruthy();
    expect(screen.queryByText('To add Bitcoin, send it to your address:')).toBeNull();
    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('shows the alert alone when a blank username gives no address', () => {
    useAuthStore.setState({ account: { username: '  ' } as never });
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
