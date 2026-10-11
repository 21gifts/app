import { act, cleanup, fireEvent, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SettingsScreen } from '@/components/SettingsScreen';
import { saveAmountUnit } from '@/lib/amount-unit';
import { setUsername } from '@/lib/api';
import type { Account } from '@/lib/api-types';
import { useAuthStore } from '@/stores/auth-store';
import { renderWithLocale } from '@/__tests__/render-with-locale';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn() }),
  usePathname: (): string => '/settings',
  useSearchParams: (): URLSearchParams => new URLSearchParams(),
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
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock('@/lib/amount-unit', () => ({
  saveAmountUnit: vi.fn(() => Promise.resolve()),
}));

vi.mock('@/lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api')>()),
  setUsername: vi.fn(),
}));

const account: Account = {
  id: 'acc_1',
  linkingKey: '02abcdef',
  role: 'basis',
  name: 'Ada',
  username: 'ada',
  location: null,
  lightningAddress: null,
  lightningAddressVerified: false,
  forumLawsDismissed: false,
  createdAt: 1_700_000_000,
  rulesAgreedAt: 1_700_000_001,
  viewKey: 'a'.repeat(64),
  aboutMe: null,
  aboutMeHasPhoto: false,
  setup: null,
  missing: [],
};

const originalScrollIntoView = HTMLElement.prototype.scrollIntoView;

const ADD_HINT =
  'This creates a recovery phrase on this device. Your existing login passkey stays.';

beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_APP_VERSION', '42');
  useAuthStore.setState({ session: 'sess', account });
});

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  vi.useRealTimers();
  vi.mocked(saveAmountUnit).mockClear();
  HTMLElement.prototype.scrollIntoView = originalScrollIntoView;
  window.history.replaceState(null, '', '/');
  useAuthStore.setState({ session: null, account: null });
});

describe('SettingsScreen', () => {
  it('renders nothing without a session', () => {
    useAuthStore.setState({ session: null, account: null });
    const { container } = renderWithLocale(<SettingsScreen />);
    expect(container.innerHTML).toBe('');
  });

  it('renders nothing before the account has loaded', () => {
    useAuthStore.setState({ account: null });
    const { container } = renderWithLocale(<SettingsScreen />);
    expect(container.innerHTML).toBe('');
  });

  it('shows Wallet, Display, Notifications, Account, and About & legal in that order', () => {
    renderWithLocale(<SettingsScreen />);
    expect(screen.getByRole('heading', { level: 1, name: 'Settings' })).toBeTruthy();
    const names = screen.getAllByRole('heading', { level: 2 }).map((node) => node.textContent);
    expect(names).toEqual(['Wallet', 'Display', 'Notifications', 'Account', 'About & legal']);
    expect(screen.getByRole('region', { name: 'Notifications' }).id).toBe('notifications');
  });

  it('links Recovery phrase to /wallet/phrase in the Wallet section when the account has a phrase', () => {
    useAuthStore.setState({ account: { ...account, passkeyCredentialId: 'cred-seed' } });
    renderWithLocale(<SettingsScreen />);
    const section = screen.getByRole('region', { name: 'Wallet' });
    const link = screen.getByRole('link', { name: 'Recovery phrase' });
    expect(section.contains(link)).toBe(true);
    expect(link.getAttribute('href')).toBe('/wallet/phrase');
    expect(link.closest('#recovery')).not.toBeNull();
    expect(screen.queryByRole('link', { name: 'Add recovery phrase' })).toBeNull();
    expect(screen.queryByText(ADD_HINT)).toBeNull();
  });

  it.each([
    ['missing', undefined],
    ['empty', ''],
    ['null', null],
  ])(
    'offers the add hint and Add recovery phrase when passkeyCredentialId is %s',
    (_label, credentialId) => {
      useAuthStore.setState({
        account: { ...account, passkeyCredentialId: credentialId } as Account,
      });
      renderWithLocale(<SettingsScreen />);
      const section = screen.getByRole('region', { name: 'Wallet' });
      const link = screen.getByRole('link', { name: 'Add recovery phrase' });
      expect(section.contains(link)).toBe(true);
      expect(link.getAttribute('href')).toBe('/wallet/phrase');
      expect(screen.getByText(ADD_HINT)).toBeTruthy();
      expect(screen.queryByRole('link', { name: 'Recovery phrase' })).toBeNull();
    },
  );

  it('shows the 21.gifts address with an icon-only Copy that says Copied for two seconds', async () => {
    vi.useFakeTimers();
    const writeText = vi.fn(() => Promise.resolve());
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    renderWithLocale(<SettingsScreen />);
    const wallet = screen.getByRole('region', { name: 'Wallet' });
    expect(within(wallet).getByText('21.gifts address')).toBeTruthy();
    expect(within(wallet).getByText('ada@21.gifts')).toBeTruthy();
    const copy = screen.getByRole('button', { name: 'Copy 21.gifts address' });
    expect(screen.queryByText('Copy 21.gifts address')).toBeNull();
    await act(async () => {
      fireEvent.click(copy);
      await Promise.resolve();
    });
    expect(writeText).toHaveBeenCalledWith('ada@21.gifts');
    expect(screen.getByText('Copied')).toBeTruthy();
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(screen.queryByText('Copied')).toBeNull();
  });

  it('keeps the address readable when the clipboard refuses', async () => {
    const writeText = vi.fn(() => Promise.reject(new Error('denied')));
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    renderWithLocale(<SettingsScreen />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Copy 21.gifts address' }));
      await Promise.resolve();
    });
    expect(screen.queryByText('Copied')).toBeNull();
    expect(screen.getByText('ada@21.gifts')).toBeTruthy();
  });

  it('offers the username form in place of the address while no username is set', async () => {
    useAuthStore.setState({ account: { ...account, username: null } });
    vi.mocked(setUsername).mockResolvedValue({ ...account, username: 'grace' });
    renderWithLocale(<SettingsScreen />);
    expect(screen.getByText('Set a username first.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Copy 21.gifts address' })).toBeNull();
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'grace' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
      await Promise.resolve();
    });
    expect(setUsername).toHaveBeenCalledWith('sess', 'grace', 'enforce');
    expect(await screen.findByText('grace@21.gifts')).toBeTruthy();
    expect(screen.queryByText('Set a username first.')).toBeNull();
  });

  it('saves the default amount unit through the shared amount-unit save', () => {
    renderWithLocale(<SettingsScreen />);
    const group = screen.getByRole('group', { name: 'Default amount' });
    const btc = within(group).getByRole('button', { name: '₿' });
    const fiat = within(group).getByRole('button', { name: 'USD' });
    expect(btc.getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByText('Amount fields start in this unit.')).toBeTruthy();
    fireEvent.click(btc);
    expect(saveAmountUnit).not.toHaveBeenCalled();
    fireEvent.click(fiat);
    expect(saveAmountUnit).toHaveBeenCalledWith('sess', account, 'fiat');
  });

  it('presses fiat when the account stores fiat', () => {
    useAuthStore.setState({ account: { ...account, amountUnit: 'fiat' } });
    renderWithLocale(<SettingsScreen />);
    const group = screen.getByRole('group', { name: 'Default amount' });
    expect(within(group).getByRole('button', { name: 'USD' }).getAttribute('aria-pressed')).toBe(
      'true',
    );
  });

  it('holds language, theme, fiat, and number format under Display, saved-on-device notes under theme and number format', () => {
    renderWithLocale(<SettingsScreen />);
    const display = screen.getByRole('region', { name: 'Display' });
    for (const name of ['Language', 'Theme', 'Fiat currency', 'Number format']) {
      expect(within(display).getByRole('group', { name })).toBeTruthy();
    }
    expect(within(display).getAllByText('Saved on this device')).toHaveLength(2);
  });

  it('holds the notification level and hearts under Notifications', () => {
    renderWithLocale(<SettingsScreen />);
    const notifications = screen.getByRole('region', { name: 'Notifications' });
    expect(within(notifications).getByRole('group', { name: 'Notification level' })).toBeTruthy();
    expect(within(notifications).getByRole('group', { name: 'Hearts' })).toBeTruthy();
  });

  it('holds Log out under Account', () => {
    renderWithLocale(<SettingsScreen />);
    const section = screen.getByRole('region', { name: 'Account' });
    expect(within(section).getByRole('button', { name: 'Log out' })).toBeTruthy();
  });

  it('links the handbook, legal, terms, rules, and contact, and shows the version', () => {
    renderWithLocale(<SettingsScreen />);
    const about = screen.getByRole('region', { name: 'About & legal' });
    const links = within(about)
      .getAllByRole('link')
      .map((link) => [link.textContent, link.getAttribute('href')]);
    expect(links).toEqual([
      ['Handbook', '/handbook'],
      ['Legal & Privacy', '/legal'],
      ['Terms of Use', '/terms'],
      ['Living room rules', '/rules'],
      ['Contact', '/contact'],
    ]);
    expect(within(about).getByText('Version 42')).toBeTruthy();
  });

  it('scrolls the part named by the address hash into view', () => {
    const scrollIntoView = vi.fn();
    HTMLElement.prototype.scrollIntoView = scrollIntoView;
    window.history.replaceState(null, '', '/settings#notifications');
    renderWithLocale(<SettingsScreen />);
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    expect(scrollIntoView.mock.contexts[0]).toBe(
      screen.getByRole('region', { name: 'Notifications' }),
    );
  });

  it('scrolls nothing without a hash, for an unknown one, or for a malformed one', () => {
    const scrollIntoView = vi.fn();
    HTMLElement.prototype.scrollIntoView = scrollIntoView;
    renderWithLocale(<SettingsScreen />);
    cleanup();
    window.history.replaceState(null, '', '/settings#nowhere');
    renderWithLocale(<SettingsScreen />);
    cleanup();
    window.history.replaceState(null, '', '/settings#%');
    renderWithLocale(<SettingsScreen />);
    expect(screen.getByRole('heading', { level: 1, name: 'Settings' })).toBeTruthy();
    expect(scrollIntoView).not.toHaveBeenCalled();
  });
});
