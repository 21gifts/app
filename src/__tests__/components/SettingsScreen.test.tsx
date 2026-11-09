import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SettingsScreen } from '@/components/SettingsScreen';
import { saveAmountUnit } from '@/lib/amount-unit';
import { fetchPreviousWallets, setHeartSats, setUsername } from '@/lib/api';
import type { Account } from '@/lib/api-types';
import { useAuthStore } from '@/stores/auth-store';
import { renderWithLocale } from '@/__tests__/render-with-locale';
import { fetchFxSpot } from '@/lib/api';

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
  fetchPreviousWallets: vi.fn(),
  setHeartSats: vi.fn(),
  fetchFxSpot: vi.fn(),
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
  vi.mocked(fetchPreviousWallets).mockReset().mockResolvedValue([]);
  vi.mocked(setHeartSats).mockReset();
  useAuthStore.setState({ session: 'sess', account });
});

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  vi.useRealTimers();
  vi.mocked(saveAmountUnit).mockClear();
  HTMLElement.prototype.scrollIntoView = originalScrollIntoView;
  Reflect.deleteProperty(navigator, 'clipboard');
  window.history.replaceState(null, '', '/');
  useAuthStore.setState({ session: null, account: null });
});

describe('SettingsScreen', () => {
  it('renders nothing without a session, even with an account loaded', () => {
    useAuthStore.setState({ session: null });
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

  it('leaves securing the account to /security: the Wallet section holds the address and the default amount', () => {
    useAuthStore.setState({
      account: { ...account, passkeyCredentialId: 'cred-seed', sparkWalletVerified: true },
    });
    renderWithLocale(<SettingsScreen />);
    const section = screen.getByRole('region', { name: 'Wallet' });
    expect(Array.from(section.children).map((node) => node.id)).toEqual([
      'wallet-heading',
      'address',
      '',
      '',
    ]);
    for (const name of [
      'Recovery phrase',
      'Add recovery phrase',
      'Secure my account',
      'Shares I keep for others',
      'Transfer remaining balance',
    ]) {
      expect(screen.queryByRole('link', { name })).toBeNull();
    }
    expect(screen.queryByText(ADD_HINT)).toBeNull();
    expect(screen.queryByText('Available once your wallet is connected.')).toBeNull();
    for (const id of ['recovery', 'social-recovery', 'previous-wallets']) {
      expect(document.getElementById(id)).toBeNull();
    }
    expect(fetchPreviousWallets).not.toHaveBeenCalled();
  });

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
      vi.advanceTimersByTime(1999);
    });
    expect(screen.getByText('Copied')).toBeTruthy();
    act(() => {
      vi.advanceTimersByTime(1);
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
    expect(writeText).toHaveBeenCalledWith('ada@21.gifts');
    expect(screen.queryByText('Copied')).toBeNull();
    expect(screen.getByText('ada@21.gifts')).toBeTruthy();
  });

  it('offers the username form in place of the address while no username is set', async () => {
    useAuthStore.setState({ account: { ...account, username: null } });
    vi.mocked(setUsername).mockResolvedValue({ ...account, username: 'grace' });
    renderWithLocale(<SettingsScreen />);
    expect(screen.getByText('Set a username first.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Copy 21.gifts address' })).toBeNull();
    const address = within(document.getElementById('address') as HTMLElement);
    fireEvent.change(address.getByRole('textbox', { name: 'Your 21.gifts name' }), {
      target: { value: 'grace' },
    });
    await act(async () => {
      fireEvent.click(address.getByRole('button', { name: 'Continue' }));
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

  it('shows a default heart amount of ₿1 and the stored amount', () => {
    vi.mocked(fetchFxSpot).mockResolvedValue({
      asOf: '2026-08-28T12:00:00.000Z',
      source: 'test',
      rates: { USD: '100000.00', CHF: '80000.00', EUR: '90000.00', PHP: '5600000.00' },
    });
    renderWithLocale(<SettingsScreen />);
    const wallet = screen.getByRole('region', { name: 'Wallet' });
    expect(within(wallet).getAllByText('Heart amount').length).toBeGreaterThan(0);
    expect((within(wallet).getByLabelText('Heart amount') as HTMLInputElement).value).toBe('1');
    expect(
      within(wallet).getByText(
        'Each heart you tap sends this much. The post still counts as only one heart.',
      ),
    ).toBeTruthy();
    expect(within(wallet).getByRole('group', { name: 'Bitcoin or fiat' })).toBeTruthy();
    expect(within(wallet).getByText('No exchange rate yet')).toBeTruthy();
    cleanup();
    useAuthStore.setState({ session: 'sess', account: { ...account, heartSats: 21 } });
    renderWithLocale(<SettingsScreen />);
    const storedWallet = screen.getByRole('region', { name: 'Wallet' });
    expect((within(storedWallet).getByLabelText('Heart amount') as HTMLInputElement).value).toBe(
      '21',
    );
  });

  it('converts a stored whole-sat heart amount after the fiat rate arrives', async () => {
    vi.mocked(fetchFxSpot).mockResolvedValue({
      asOf: '2026-08-28T12:00:00.000Z',
      source: 'test',
      rates: { USD: '100000.00', CHF: '80000.00', EUR: '90000.00', PHP: '5600000.00' },
    });
    useAuthStore.setState({
      session: 'sess',
      account: { ...account, amountUnit: 'fiat', heartSats: 21 },
    });
    renderWithLocale(<SettingsScreen />, 'en', 'ch', 'USD');
    const wallet = screen.getByRole('region', { name: 'Wallet' });
    await waitFor(() => {
      expect((within(wallet).getByLabelText('Heart amount') as HTMLInputElement).value).toBe(
        '0.021',
      );
    });
    expect(within(wallet).getAllByText(/₿21/).length).toBeGreaterThan(0);
  });

  it('keeps the fiat draft in step when the stored whole-sat amount changes', async () => {
    vi.mocked(fetchFxSpot).mockResolvedValue({
      asOf: '2026-08-28T12:00:00.000Z',
      source: 'test',
      rates: { USD: '100000.00', CHF: '80000.00', EUR: '90000.00', PHP: '5600000.00' },
    });
    useAuthStore.setState({
      session: 'sess',
      account: { ...account, amountUnit: 'fiat', heartSats: 21 },
    });
    renderWithLocale(<SettingsScreen />, 'en', 'ch', 'USD');
    const wallet = screen.getByRole('region', { name: 'Wallet' });
    await waitFor(() => {
      expect((within(wallet).getByLabelText('Heart amount') as HTMLInputElement).value).toBe(
        '0.021',
      );
    });
    act(() => {
      useAuthStore.setState({
        session: 'sess',
        account: { ...account, amountUnit: 'fiat', heartSats: 42 },
      });
    });
    await waitFor(() => {
      expect((within(wallet).getByLabelText('Heart amount') as HTMLInputElement).value).toBe(
        '0.042',
      );
    });
  });

  it('saves a whole heart amount and confirms it', async () => {
    vi.mocked(setHeartSats).mockResolvedValue({ ...account, heartSats: 21 });
    renderWithLocale(<SettingsScreen />);
    const wallet = screen.getByRole('region', { name: 'Wallet' });
    const field = within(wallet).getByLabelText('Heart amount');
    fireEvent.change(field, { target: { value: '21' } });
    await act(async () => {
      fireEvent.click(within(wallet).getByRole('button', { name: 'Save' }));
      await Promise.resolve();
    });
    expect(setHeartSats).toHaveBeenCalledWith('sess', 21);
    expect(within(wallet).getByText('Saved: ₿21 per heart.')).toBeTruthy();
  });

  it.each(['', '0', '1.5', '10000001'])('keeps the invalid heart amount %p local', (value) => {
    renderWithLocale(<SettingsScreen />);
    const wallet = screen.getByRole('region', { name: 'Wallet' });
    fireEvent.change(within(wallet).getByLabelText('Heart amount'), { target: { value } });
    fireEvent.click(within(wallet).getByRole('button', { name: 'Save' }));
    expect(setHeartSats).not.toHaveBeenCalled();
    expect(within(wallet).getByText('Enter a whole number from 1 to 10,000,000.')).toBeTruthy();
  });

  it('shows the server error and rolls back when saving the heart amount fails', async () => {
    vi.mocked(setHeartSats).mockRejectedValue(new Error('offline'));
    renderWithLocale(<SettingsScreen />);
    const wallet = screen.getByRole('region', { name: 'Wallet' });
    fireEvent.change(within(wallet).getByLabelText('Heart amount'), { target: { value: '21' } });
    await act(async () => {
      fireEvent.click(within(wallet).getByRole('button', { name: 'Save' }));
      await Promise.resolve();
    });
    expect(within(wallet).getByText('Could not save the heart amount.')).toBeTruthy();
    expect(useAuthStore.getState().account?.heartSats).toBe(1);
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
    expect(within(notifications).getByRole('group', { name: 'Posts' })).toBeTruthy();
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

  it('scrolls to the address row named by the address hash', () => {
    const scrollIntoView = vi.fn();
    HTMLElement.prototype.scrollIntoView = scrollIntoView;
    window.history.replaceState(null, '', '/settings#address');
    renderWithLocale(<SettingsScreen />);
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    expect(scrollIntoView.mock.contexts[0]).toBe(document.getElementById('address'));
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
