import { cleanup, fireEvent, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HeaderWalletButton } from '@/components/HeaderWalletButton';
import { useLatestRateDay } from '@/hooks/useLatestRateDay';
import type { FiatRateDay } from '@/lib/stats-money';
import { unlockWalletPhrase } from '@/lib/wallet/wallet-phrase';
import { connectWallet } from '@/lib/wallet/wallet-service';
import { useAuthStore } from '@/stores/auth-store';
import { useWalletStore, type WalletStatus } from '@/stores/wallet-store';
import { renderWithLocale } from '@/__tests__/render-with-locale';

const navigation = vi.hoisted(() => ({ pathname: '/profile' }));

vi.mock('next/navigation', () => ({
  usePathname: (): string => navigation.pathname,
}));
vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
    [key: string]: unknown;
  }) => (
    <a href={href} data-client-link="true" {...rest}>
      {children}
    </a>
  ),
}));
vi.mock('@/hooks/useLatestRateDay', () => ({
  useLatestRateDay: vi.fn(),
}));
vi.mock('@/lib/wallet/wallet-phrase', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/wallet/wallet-phrase')>();
  return { ...actual, unlockWalletPhrase: vi.fn() };
});
vi.mock('@/lib/wallet/wallet-service', () => ({
  connectWallet: vi.fn(),
}));
vi.mock('@/lib/wallet/wallet-sdk', () => ({
  walletNeedsReload: vi.fn(() => false),
}));

const RATE_DAY: FiatRateDay = {
  sats: 100_000_000,
  usd: '100000.00',
  chf: '80000.00',
  eur: '90000.00',
  php: '5600000.00',
};

const account = {
  id: 'acc_1',
  linkingKey: null,
  role: 'basis' as const,
  name: 'Ada',
  username: 'ada',
  location: null,
  lightningAddress: null,
  lightningAddressVerified: false,
  forumLawsDismissed: false,
  createdAt: 1,
  rulesAgreedAt: 1,
  viewKey: 'a'.repeat(64),
  aboutMe: null,
  aboutMeHasPhoto: false,
  setup: null,
  missing: [],
  walletRequired: true,
  passkeyCredentialId: 'credential',
};

const ORIGINAL_E2E_NOW = process.env.NEXT_PUBLIC_E2E_NOW;

function setWallet(status: WalletStatus, balanceSats: number | null = null): void {
  useWalletStore.setState({ status, balanceSats, identityPubkey: null });
}

beforeEach(() => {
  navigation.pathname = '/profile';
  window.history.replaceState({}, '', '/profile');
  delete process.env.NEXT_PUBLIC_E2E_NOW;
  useAuthStore.setState({ session: 'token', account });
  setWallet('locked');
  vi.mocked(useLatestRateDay).mockReset().mockReturnValue(null);
  vi.mocked(unlockWalletPhrase).mockReset().mockResolvedValue('unlocked');
  vi.mocked(connectWallet).mockReset().mockResolvedValue(undefined);
});

afterEach(() => {
  cleanup();
  if (ORIGINAL_E2E_NOW === undefined) {
    delete process.env.NEXT_PUBLIC_E2E_NOW;
  } else {
    process.env.NEXT_PUBLIC_E2E_NOW = ORIGINAL_E2E_NOW;
  }
});

function expectNoWalletStart(): void {
  expect(unlockWalletPhrase).not.toHaveBeenCalled();
  expect(connectWallet).not.toHaveBeenCalled();
}

describe('HeaderWalletButton', () => {
  it.each<WalletStatus>(['locked', 'connecting', 'error'])(
    'shows the Wallet label and icon without a balance while %s',
    (status) => {
      setWallet(status);
      const { container } = renderWithLocale(<HeaderWalletButton />);
      const link = screen.getByRole('link', { name: 'Wallet' });
      expect(link.getAttribute('href')).toBe('/wallet');
      expect(link.getAttribute('data-client-link')).toBe('true');
      expect(link.textContent).toBe('Wallet');
      expect(link.querySelector('svg.lucide-wallet')).not.toBeNull();
      expect(container.querySelector('.animate-spin')).toBeNull();
      expect(container.textContent).not.toContain('₿');
      expect(useLatestRateDay).toHaveBeenLastCalledWith(false);
      expectNoWalletStart();
    },
  );

  it('shows the Wallet label while ready before the balance arrives', () => {
    setWallet('ready', null);
    renderWithLocale(<HeaderWalletButton />);
    expect(screen.getByRole('link', { name: 'Wallet' }).textContent).toBe('Wallet');
    expect(useLatestRateDay).toHaveBeenLastCalledWith(false);
  });

  it('shows the ready balance in ₿ and the default fiat', () => {
    setWallet('ready', 21_000);
    vi.mocked(useLatestRateDay).mockReturnValue(RATE_DAY);
    renderWithLocale(<HeaderWalletButton />);
    const link = screen.getByRole('link', { name: "Wallet, balance ₿21'000" });
    expect(link.getAttribute('href')).toBe('/wallet');
    expect(link.textContent).toBe("₿21'000$21.00");
    expect(link.querySelector('.tabular-nums')).not.toBeNull();
    expect(link.querySelector('svg.lucide-wallet')?.getAttribute('class')).toContain('sm:block');
    expect(useLatestRateDay).toHaveBeenLastCalledWith(true);
    expectNoWalletStart();
  });

  it('leaves out the fiat line without a usable rate', () => {
    setWallet('ready', 1_234);
    renderWithLocale(<HeaderWalletButton />);
    expect(screen.getByRole('link', { name: "Wallet, balance ₿1'234" }).textContent).toBe("₿1'234");
  });

  it('opens /wallet client-side without asking for the passkey', () => {
    setWallet('locked');
    renderWithLocale(<HeaderWalletButton />);
    fireEvent.click(screen.getByRole('link', { name: 'Wallet' }));
    expectNoWalletStart();
  });

  it('is hidden on /wallet itself', () => {
    navigation.pathname = '/wallet';
    setWallet('ready', 21_000);
    const { container } = renderWithLocale(<HeaderWalletButton />);
    expect(container.firstChild).toBeNull();
    expect(useLatestRateDay).toHaveBeenLastCalledWith(false);
  });

  it('is shown on the recovery phrase page under /wallet', () => {
    navigation.pathname = '/wallet/phrase';
    renderWithLocale(<HeaderWalletButton />);
    expect(screen.getByRole('link', { name: 'Wallet' })).toBeTruthy();
  });

  it('is hidden when this build has no wallet', () => {
    setWallet('disabled');
    const { container } = renderWithLocale(<HeaderWalletButton />);
    expect(container.firstChild).toBeNull();
  });

  it('is hidden for an account that cannot hold the wallet', () => {
    useAuthStore.setState({ account: { ...account, walletRequired: false } });
    const { container } = renderWithLocale(<HeaderWalletButton />);
    expect(container.firstChild).toBeNull();
  });

  it('is hidden before the account is hydrated, even with a Playwright pin', () => {
    process.env.NEXT_PUBLIC_E2E_NOW = '2026-01-07T12:00:00.000Z';
    window.history.replaceState({}, '', '/profile?visual=balance-ready');
    useAuthStore.setState({ session: null, account: null });
    const { container } = renderWithLocale(<HeaderWalletButton />);
    expect(container.firstChild).toBeNull();
  });

  it('ignores the balance pin in a production build', () => {
    setWallet('disabled');
    window.history.replaceState({}, '', '/profile?visual=balance-ready');
    const { container } = renderWithLocale(<HeaderWalletButton />);
    expect(container.firstChild).toBeNull();
  });

  it('shows the pinned balance in a Playwright build', () => {
    process.env.NEXT_PUBLIC_E2E_NOW = '2026-01-07T12:00:00.000Z';
    setWallet('disabled');
    window.history.replaceState({}, '', '/profile?visual=balance-ready');
    renderWithLocale(<HeaderWalletButton />);
    expect(screen.getByRole('link', { name: "Wallet, balance ₿21'000" })).toBeTruthy();
  });
});
