import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SignedInChrome } from '@/components/SignedInChrome';
import { usePasskeyLogin } from '@/hooks/usePasskeyLogin';
import { fetchGiftStats } from '@/lib/api';
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

beforeEach(() => {
  replace.mockClear();
  refresh.mockClear();
  cancel.mockClear();
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
    expect(screen.queryByLabelText('Language')).toBeNull();
    expect(screen.queryByRole('button', { name: /log out/i })).toBeNull();
  });

  it('opens the menu with Profile, Language, Log out, and zero totals', async () => {
    renderWithLocale(<SignedInChrome />);
    fireEvent.click(screen.getByRole('button', { name: 'Menu' }));
    expect(screen.getByRole('link', { name: /Profile/ }).getAttribute('href')).toBe('/profile');
    expect(screen.getByLabelText('Language')).toBeTruthy();
    expect(screen.getByRole('button', { name: /log out/i })).toBeTruthy();
    await waitFor(() => {
      expect(screen.getByLabelText('Given 0 sats')).toBeTruthy();
      expect(screen.getByLabelText('Received 0 sats')).toBeTruthy();
    });
  });

  it('ignores non-Escape keydown while the menu is open', () => {
    renderWithLocale(<SignedInChrome />);
    fireEvent.click(screen.getByRole('button', { name: 'Menu' }));
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(screen.getByLabelText('Language')).toBeTruthy();
  });

  it('closes the menu on Escape and restores focus to Menu', () => {
    renderWithLocale(<SignedInChrome />);
    const menuButton = screen.getByRole('button', { name: 'Menu' });
    fireEvent.click(menuButton);
    screen.getByLabelText('Language').focus();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByLabelText('Language')).toBeNull();
    expect(document.activeElement).toBe(menuButton);
  });

  it('first Escape collapses Language; second Escape closes Menu', () => {
    renderWithLocale(<SignedInChrome />);
    const menuButton = screen.getByRole('button', { name: 'Menu' });
    fireEvent.click(menuButton);
    const languageButton = screen.getByLabelText('Language');
    fireEvent.click(languageButton);
    expect(screen.getByRole('option', { name: 'Deutsch' })).toBeTruthy();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.getByRole('link', { name: /Profile/ })).toBeTruthy();
    expect(screen.getByLabelText('Language')).toBeTruthy();
    expect(screen.queryByRole('option')).toBeNull();
    expect(document.activeElement).toBe(languageButton);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByLabelText('Language')).toBeNull();
    expect(document.activeElement).toBe(menuButton);
  });

  it('closes the menu on outside mousedown', () => {
    renderWithLocale(<SignedInChrome />);
    fireEvent.click(screen.getByRole('button', { name: 'Menu' }));
    expect(screen.getByLabelText('Language')).toBeTruthy();
    fireEvent.mouseDown(document.body);
    expect(screen.queryByLabelText('Language')).toBeNull();
  });

  it('formats a single received sat with forum.satsOne', async () => {
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
    await waitFor(() => {
      expect(screen.getByLabelText('Received 1 sat')).toBeTruthy();
    });
  });

  it('closes the menu when Profile is clicked', () => {
    renderWithLocale(<SignedInChrome />);
    fireEvent.click(screen.getByRole('button', { name: 'Menu' }));
    expect(screen.getByLabelText('Language')).toBeTruthy();
    fireEvent.click(screen.getByRole('link', { name: /Profile/ }));
    expect(screen.queryByLabelText('Language')).toBeNull();
  });
});
