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

function wallet(
  status: UseWalletResult['status'],
  balanceSats: number | null,
  retrying = false,
): void {
  vi.mocked(useWallet).mockReturnValue({
    status,
    balanceSats,
    retry: vi.fn(),
    downloading: false,
    setupFailed: false,
    retrying,
  });
}

beforeEach(() => {
  vi.mocked(useSpotRate).mockReset().mockReturnValue(RATE_DAY);
  vi.mocked(useIncomingPayment).mockReset().mockReturnValue({ payment: null, dismiss: vi.fn() });
});

afterEach(cleanup);

describe('HeaderBalance', () => {
  it.each([
    ['error', null],
    ['disabled', null],
  ] as const)('renders nothing while the wallet is %s and not retried', (status, sats) => {
    wallet(status, sats);
    const { container } = renderWithLocale(<HeaderBalance />);
    expect(container.firstChild).toBeNull();
  });

  it.each([
    ['connecting', false],
    ['ready', false],
    ['error', true],
  ] as const)(
    'shows the skeleton while the wallet is %s without a balance (retrying: %s)',
    (status, retrying) => {
      wallet(status, null, retrying);
      const { container } = renderWithLocale(<HeaderBalance />);
      const skeleton = container.querySelector('[data-balance-skeleton]') as HTMLElement;
      expect(skeleton.tagName).toBe('DIV');
      // The screens that need the wallet announce its state; the header does not repeat it.
      expect(skeleton.getAttribute('aria-hidden')).toBe('true');
      expect(screen.queryByRole('status')).toBeNull();
      expect(skeleton.getAttribute('data-wallet-tour')).toBeNull();
      expect(screen.queryByRole('link')).toBeNull();
      const bars = skeleton.querySelectorAll('.animate-pulse');
      expect(bars).toHaveLength(2);
      for (const bar of bars) {
        expect(bar.className).toContain('bg-app-border');
        expect(bar.className).toContain('motion-reduce:animate-none');
      }
    },
  );

  it('gives the skeleton the box of the balance link, so the header does not move', () => {
    wallet('connecting', null);
    const loading = renderWithLocale(<HeaderBalance />);
    const skeleton = loading.container.querySelector('[data-balance-skeleton]') as HTMLElement;
    const [first, second] = Array.from(skeleton.children);
    // text-sm and text-[10px] at leading-tight: 17.5 px and 12.5 px lines.
    expect(first?.className).toContain('h-[17.5px]');
    expect(second?.className).toContain('h-[12.5px]');
    const box = ['mr-1', 'min-h-9', 'shrink-0', 'flex-col', 'items-end', 'justify-center', 'px-2'];
    for (const name of box) {
      expect(skeleton.className.split(' ')).toContain(name);
    }
    loading.unmount();
    wallet('ready', 21_000);
    renderWithLocale(<HeaderBalance />);
    const link = screen.getByRole('link');
    for (const name of box) {
      expect(link.className.split(' ')).toContain(name);
    }
    expect(link.className).toContain('leading-tight');
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

  it('turns the success colour and shows the arrived amount in bitcoin', () => {
    vi.mocked(useIncomingPayment).mockReturnValue({ payment: PAYMENT, dismiss: vi.fn() });
    wallet('ready', 21_500);
    renderWithLocale(<HeaderBalance />);
    const link = screen.getByRole('link', { name: "Balance ₿21'500 $21.50" });
    expect(link.className).toContain('text-app-success');
    const bump = link.querySelector('[aria-hidden="true"]');
    expect(bump?.textContent).toBe('+₿500');
  });
});
