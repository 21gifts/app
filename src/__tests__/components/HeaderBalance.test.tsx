import { cleanup, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HeaderBalance } from '@/components/HeaderBalance';
import { useIncomingPayment } from '@/hooks/useIncomingPayment';
import { useSpotRate } from '@/hooks/useSpotRate';
import { useWallet, type UseWalletResult } from '@/hooks/useWallet';
import type { FiatRateDay } from '@/lib/stats-money';
import type { WalletPayment } from '@/lib/wallet/wallet-sdk';
import { renderWithLocale } from '@/__tests__/render-with-locale';

vi.mock('@/hooks/useSpotRate', () => ({ useSpotRate: vi.fn() }));
vi.mock('@/hooks/useWallet', () => ({ useWallet: vi.fn() }));
vi.mock('@/hooks/useIncomingPayment', () => ({ useIncomingPayment: vi.fn() }));

const RATE_DAY: FiatRateDay = {
  sats: 100_000_000,
  usd: '100000.00',
  chf: '80000.00',
  eur: '90000.00',
  php: '5600000.00',
};

const PAYMENT: WalletPayment = {
  id: 'p1',
  direction: 'received',
  amountSats: 500,
  feesSats: 0,
  timestamp: 1,
  status: 'completed',
  method: 'lightning',
  senderComment: null,
  info: {},
};

function wallet(status: UseWalletResult['status'], balanceSats: number | null): void {
  vi.mocked(useWallet).mockReturnValue({ status, balanceSats, retry: vi.fn(), setupFailed: false });
}

beforeEach(() => {
  vi.mocked(useSpotRate).mockReset().mockReturnValue(RATE_DAY);
  vi.mocked(useIncomingPayment).mockReset().mockReturnValue({ payment: null, dismiss: vi.fn() });
});

afterEach(cleanup);

describe('HeaderBalance', () => {
  it.each([
    ['connecting', null],
    ['error', null],
    ['disabled', null],
    ['ready', null],
  ] as const)('renders nothing while the wallet is %s without a balance', (status, sats) => {
    wallet(status, sats);
    const { container } = renderWithLocale(<HeaderBalance />);
    expect(container.firstChild).toBeNull();
  });

  it('links the ₿ balance and its fiat to /wallet', () => {
    wallet('ready', 21_000);
    renderWithLocale(<HeaderBalance />);
    const link = screen.getByRole('link', { name: "Balance ₿21'000 $21.00" });
    expect(link.getAttribute('href')).toBe('/wallet');
    expect(link.getAttribute('data-wallet-tour')).toBe('balance');
    expect(link.className).toContain('min-h-9');
    expect(link.className).toContain('text-app-fg');
    expect(screen.getByText("₿21'000").className).toContain('text-sm');
    expect(screen.getByText('$21.00').className).toContain('text-[10px]');
    expect(useSpotRate).toHaveBeenCalledWith(true);
    expect(useIncomingPayment).toHaveBeenCalledWith(2400);
  });

  it('leaves out the fiat line only without a rate', () => {
    vi.mocked(useSpotRate).mockReturnValue(null);
    wallet('ready', 21_000);
    renderWithLocale(<HeaderBalance />);
    expect(screen.getByRole('link', { name: "Balance ₿21'000" })).toBeTruthy();
  });

  it('turns the success colour and shows the arrived amount with its fiat', () => {
    vi.mocked(useIncomingPayment).mockReturnValue({ payment: PAYMENT, dismiss: vi.fn() });
    wallet('ready', 21_500);
    renderWithLocale(<HeaderBalance />);
    const link = screen.getByRole('link', { name: "Balance ₿21'500 $21.50" });
    expect(link.className).toContain('text-app-success');
    const bump = link.querySelector('[aria-hidden="true"]');
    expect(bump?.textContent).toBe('+₿500 · $0.50');
  });
});
