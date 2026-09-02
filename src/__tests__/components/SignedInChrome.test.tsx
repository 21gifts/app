import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SignedInChrome } from '@/components/SignedInChrome';
import { usePasskeyLogin } from '@/hooks/usePasskeyLogin';
import { fetchGiftStats } from '@/lib/api';
import { isInAppBrowser } from '@/lib/in-app-browser';
import { shouldOfferIosInstall } from '@/lib/pwa-install';
import { isStandaloneDisplay } from '@/lib/push';
import { useAuthStore } from '@/stores/auth-store';
import { renderWithLocale } from '@/__tests__/render-with-locale';

const replace = vi.fn();
const refresh = vi.fn();
const cancel = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: (): { replace: typeof replace; refresh: typeof refresh } => ({
    replace,
    refresh,
  }),
}));
vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    onClick,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
    onClick?: (event: { preventDefault: () => void }) => void;
    [key: string]: unknown;
  }) => (
    <a
      href={href}
      {...rest}
      onClick={(event) => {
        event.preventDefault();
        onClick?.(event);
      }}
    >
      {children}
    </a>
  ),
}));
vi.mock('@/hooks/usePasskeyLogin', () => ({ usePasskeyLogin: vi.fn() }));
vi.mock('@/lib/session-storage', () => ({
  loadSession: vi.fn(),
  saveSession: vi.fn(),
  clearSession: vi.fn(),
}));
vi.mock('@/lib/pwa-install', () => ({
  shouldOfferIosInstall: vi.fn(() => false),
}));
vi.mock('@/lib/push', () => ({
  isIosSafari: vi.fn(() => false),
  isStandaloneDisplay: vi.fn(() => false),
}));
vi.mock('@/lib/in-app-browser', () => ({
  isInAppBrowser: vi.fn(() => false),
}));
vi.mock('@/lib/api', () => ({
  fetchGiftStats: vi.fn().mockResolvedValue({
    totalSats: 0,
    totalBtc: '0.00000000',
    totalUsd: '0.00',
    giftCount: 0,
    recipientCount: 0,
    firstPaidAt: null,
    lastPaidAt: null,
    spendOverTime: [],
    byRecipient: [],
    byMonth: [],
    fx: {
      quote: 'BTC-USD',
      dayBasis: 'utc',
      source: 'coinbase-exchange-daily-close',
    },
  }),
}));

function menuPanel(): HTMLElement {
  const panel = document.getElementById('signed-in-menu');
  expect(panel).not.toBeNull();
  return panel as HTMLElement;
}

function expectMenuClosed(): void {
  expect(menuPanel().className.includes('hidden')).toBe(true);
  expect(screen.getByRole('button', { name: 'Menu' }).getAttribute('aria-expanded')).toBe('false');
}

function expectMenuOpen(): void {
  expect(menuPanel().className.includes('hidden')).toBe(false);
  expect(screen.getByRole('button', { name: 'Menu' }).getAttribute('aria-expanded')).toBe('true');
}

beforeEach(() => {
  replace.mockClear();
  refresh.mockClear();
  cancel.mockClear();
  vi.mocked(shouldOfferIosInstall).mockReturnValue(false);
  vi.mocked(isStandaloneDisplay).mockReturnValue(false);
  vi.mocked(isInAppBrowser).mockReturnValue(false);
  vi.mocked(fetchGiftStats).mockResolvedValue({
    totalSats: 0,
    totalBtc: '0.00000000',
    totalUsd: '0.00',
    giftCount: 0,
    recipientCount: 0,
    firstPaidAt: null,
    lastPaidAt: null,
    spendOverTime: [],
    byRecipient: [],
    byMonth: [],
    fx: {
      quote: 'BTC-USD',
      dayBasis: 'utc',
      source: 'coinbase-exchange-daily-close',
    },
  });
  vi.mocked(usePasskeyLogin).mockReturnValue({
    status: 'idle',
    login: vi.fn(),
    register: vi.fn(),
    authenticate: vi.fn(),
    retry: vi.fn(),
    cancel,
    error: null,
  });
  useAuthStore.setState({
    session: 'tok',
    account: {
      id: 'acc_1',
      linkingKey: null,
      role: 'basis',
      name: 'Ada',
      lightningAddress: 'alice@walletofsatoshi.com',
      lightningAddressVerified: false,
      forumLawsDismissed: false,
      createdAt: 1,
      rulesAgreedAt: 1_700_000_001,
      viewKey: 'a'.repeat(64),
    },
  });
});

afterEach(() => {
  cleanup();
});

describe('SignedInChrome', () => {
  it('shows Menu while Language and Log out stay hidden', () => {
    renderWithLocale(<SignedInChrome />);
    expect(screen.getByRole('button', { name: 'Menu' })).toBeTruthy();
    expectMenuClosed();
  });

  it('opens the menu with Profile, Language, Log out, and zero totals', async () => {
    renderWithLocale(<SignedInChrome />);
    fireEvent.click(screen.getByRole('button', { name: 'Menu' }));
    expectMenuOpen();
    expect(screen.getByRole('link', { name: /Profile/ }).getAttribute('href')).toBe('/profile');
    expect(screen.getByRole('link', { name: 'Living room rules' }).getAttribute('href')).toBe(
      '/rules',
    );
    expect(screen.getByRole('link', { name: 'Messages' }).getAttribute('href')).toBe('/messages');
    expect(screen.getByRole('link', { name: 'Contact' }).getAttribute('href')).toBe('/contact');
    expect(screen.getByLabelText('Language')).toBeTruthy();
    expect(screen.getByLabelText('Theme')).toBeTruthy();
    expect(screen.getByRole('button', { name: /log out/i })).toBeTruthy();
    await waitFor(() => {
      expect(screen.getByLabelText('Given ₿0')).toBeTruthy();
      expect(screen.getByLabelText('Received ₿0')).toBeTruthy();
    });
    const profile = screen.getByRole('link', { name: /Profile/ });
    expect(profile.className.includes('items-center')).toBe(true);
    expect(profile.className.includes('flex-col')).toBe(false);
    expect(profile.querySelector('[aria-label="Given ₿0"]')).toBeTruthy();
    expect(profile.querySelector('[aria-label="Received ₿0"]')).toBeTruthy();
    expect(profile.querySelector('svg')).toBeTruthy();
    expect(
      screen.getByRole('link', { name: 'Living room rules' }).querySelector('svg'),
    ).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Contact' }).querySelector('svg')).toBeTruthy();
  });

  it('ignores non-Escape keydown while the menu is open', () => {
    renderWithLocale(<SignedInChrome />);
    fireEvent.click(screen.getByRole('button', { name: 'Menu' }));
    fireEvent.keyDown(document, { key: 'Tab' });
    expectMenuOpen();
    expect(screen.getByLabelText('Language')).toBeTruthy();
  });

  it('closes the menu on Escape and restores focus to Menu', () => {
    renderWithLocale(<SignedInChrome />);
    const menuButton = screen.getByRole('button', { name: 'Menu' });
    fireEvent.click(menuButton);
    expectMenuOpen();
    screen.getByLabelText('Language').focus();
    fireEvent.keyDown(document, { key: 'Escape' });
    expectMenuClosed();
    expect(document.activeElement).toBe(menuButton);
  });

  it('first Escape collapses Language; second Escape closes Menu', () => {
    renderWithLocale(<SignedInChrome />);
    const menuButton = screen.getByRole('button', { name: 'Menu' });
    fireEvent.click(menuButton);
    expectMenuOpen();
    const languageButton = screen.getByLabelText('Language');
    fireEvent.click(languageButton);
    expect(screen.getByRole('option', { name: 'Deutsch' })).toBeTruthy();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.getByRole('link', { name: /Profile/ })).toBeTruthy();
    expect(screen.getByLabelText('Language')).toBeTruthy();
    expect(screen.queryByRole('option')).toBeNull();
    expect(document.activeElement).toBe(languageButton);
    fireEvent.keyDown(document, { key: 'Escape' });
    expectMenuClosed();
    expect(document.activeElement).toBe(menuButton);
  });

  it('closes the menu on outside mousedown', () => {
    renderWithLocale(<SignedInChrome />);
    fireEvent.click(screen.getByRole('button', { name: 'Menu' }));
    expectMenuOpen();
    expect(screen.getByLabelText('Language')).toBeTruthy();
    fireEvent.mouseDown(document.body);
    expectMenuClosed();
  });

  it('formats a single received amount as BIP-177 ₿1', async () => {
    vi.mocked(fetchGiftStats).mockResolvedValue({
      totalSats: 1,
      totalBtc: '0.00000001',
      totalUsd: '0.00',
      giftCount: 1,
      recipientCount: 1,
      firstPaidAt: null,
      lastPaidAt: null,
      spendOverTime: [],
      byRecipient: [
        {
          recipient: 'alice',
          giftCount: 1,
          sats: 1,
          btc: '0.00000001',
          usd: '0.00',
        },
      ],
      byMonth: [],
      fx: {
        quote: 'BTC-USD',
        dayBasis: 'utc',
        source: 'coinbase-exchange-daily-close',
      },
    });
    renderWithLocale(<SignedInChrome />);
    fireEvent.click(screen.getByRole('button', { name: 'Menu' }));
    expectMenuOpen();
    await waitFor(() => {
      expect(screen.getByLabelText('Received ₿1')).toBeTruthy();
    });
  });

  it('closes the menu when Profile is clicked', () => {
    renderWithLocale(<SignedInChrome />);
    fireEvent.click(screen.getByRole('button', { name: 'Menu' }));
    expectMenuOpen();
    expect(screen.getByLabelText('Language')).toBeTruthy();
    fireEvent.click(screen.getByRole('link', { name: /Profile/ }));
    expectMenuClosed();
  });

  it('closes the menu when Living room rules is clicked', () => {
    renderWithLocale(<SignedInChrome />);
    fireEvent.click(screen.getByRole('button', { name: 'Menu' }));
    expectMenuOpen();
    fireEvent.click(screen.getByRole('link', { name: 'Living room rules' }));
    expectMenuClosed();
  });

  it('closes the menu when Contact is clicked', () => {
    renderWithLocale(<SignedInChrome />);
    fireEvent.click(screen.getByRole('button', { name: 'Menu' }));
    expectMenuOpen();
    fireEvent.click(screen.getByRole('link', { name: 'Contact' }));
    expectMenuClosed();
  });

  it('closes the menu when Messages is clicked', () => {
    renderWithLocale(<SignedInChrome />);
    fireEvent.click(screen.getByRole('button', { name: 'Menu' }));
    expectMenuOpen();
    fireEvent.click(screen.getByRole('link', { name: 'Messages' }));
    expectMenuClosed();
  });

  it('closes the menu when Install app is clicked and keeps the iOS sheet', async () => {
    vi.mocked(shouldOfferIosInstall).mockReturnValue(true);
    renderWithLocale(<SignedInChrome />);
    fireEvent.click(screen.getByRole('button', { name: 'Menu' }));
    expectMenuOpen();
    fireEvent.click(await screen.findByRole('button', { name: 'Install app' }));
    expectMenuClosed();
    expect(screen.getByRole('dialog')).toBeTruthy();
  });
});
