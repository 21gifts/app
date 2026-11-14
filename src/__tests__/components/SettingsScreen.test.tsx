import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SettingsScreen } from '@/components/SettingsScreen';
import { saveAmountUnit } from '@/lib/amount-unit';
import { fetchPreviousWallets, setAccountFiat, setHeartSats, setUsername } from '@/lib/api';
import type { Account } from '@/lib/api-types';
import { dfxLoginUrl } from '@/lib/dfx-login';
import { useAuthStore } from '@/stores/auth-store';
import { useWalletStore } from '@/stores/wallet-store';
import { renderWithLocale } from '@/__tests__/render-with-locale';
import { fetchFxSpot } from '@/lib/api';
import { SPOT_REFRESH_MS } from '@/hooks/useSpotRate';

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

vi.mock('@/lib/dfx-login', () => ({
  dfxLoginUrl: vi.fn(),
}));

vi.mock('@/lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api')>()),
  setUsername: vi.fn(),
  fetchPreviousWallets: vi.fn(),
  setHeartSats: vi.fn(),
  setAccountFiat: vi.fn(),
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

const DFX_HINT =
  'Opens DFX in a new tab, signed in with your 21.gifts wallet, so you can buy Bitcoin with a bank transfer.';
const DFX_ERROR =
  'DFX could not be opened. Try again. If no new tab opens, allow new tabs for this site.';
const DFX_BUY =
  'https://app.dfx.swiss/buy?session=header.payload.sig&blockchain=Spark&asset-out=BTC';

/**
 * A tab opened by the row. The href setter records `opener` at the moment of
 * navigation, so a test can see that it was cleared first.
 *
 * @param failNavigation - Throw from the href setter.
 * @returns The tab stand-in.
 */
function fakeTab(failNavigation = false): {
  opener: Window | null;
  closed: boolean;
  close: ReturnType<typeof vi.fn>;
  location: Location;
  href: string;
  openerAtNavigation: Window | null | 'pending';
} {
  const tab = {
    opener: window as Window | null,
    closed: false,
    close: vi.fn(),
    location: {} as Location,
    href: '',
    openerAtNavigation: 'pending' as Window | null | 'pending',
  };
  Object.defineProperty(tab.location, 'href', {
    configurable: true,
    get: () => tab.href,
    set: (value: string) => {
      tab.openerAtNavigation = tab.opener;
      tab.href = value;
      if (failNavigation) {
        throw new Error('nav');
      }
    },
  });
  return tab;
}

/**
 * Runs the button's click handler while React leaves it disabled.
 * A real click does not reach the handler then, so the in-flight guard
 * would stay uncovered.
 *
 * @param button - Disabled button.
 */
function pressDespiteDisabled(button: HTMLElement): void {
  const reactPropsKey = Object.getOwnPropertyNames(button).find((key) =>
    key.startsWith('__reactProps$'),
  );
  if (reactPropsKey === undefined) {
    throw new Error('missing react props');
  }
  const reactProps = (button as unknown as Record<string, { onClick?: () => void } | undefined>)[
    reactPropsKey
  ];
  const onClick = reactProps?.onClick;
  if (typeof onClick !== 'function') {
    throw new Error('missing onClick');
  }
  act(() => {
    onClick();
  });
}

beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_APP_VERSION', '42');
  vi.mocked(fetchPreviousWallets).mockReset().mockResolvedValue([]);
  vi.mocked(setHeartSats).mockReset();
  vi.mocked(setAccountFiat).mockReset();
  vi.mocked(fetchFxSpot).mockReset();
  vi.mocked(dfxLoginUrl).mockReset().mockRejectedValue(new Error('dfx-login'));
  useAuthStore.setState({ session: 'sess', account });
  useWalletStore.getState().reset();
});

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.useRealTimers();
  vi.mocked(saveAmountUnit).mockClear();
  HTMLElement.prototype.scrollIntoView = originalScrollIntoView;
  Reflect.deleteProperty(navigator, 'clipboard');
  window.history.replaceState(null, '', '/');
  useAuthStore.setState({ session: null, account: null });
  useWalletStore.getState().reset();
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
    expect(screen.queryByRole('button', { name: 'Log in at DFX' })).toBeNull();
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

  it('recomputes an untouched fiat draft on USD to PHP and saves the same sats', async () => {
    vi.mocked(fetchFxSpot).mockResolvedValue({
      asOf: '2026-08-28T12:00:00.000Z',
      source: 'test',
      rates: { USD: '100000.00', CHF: '80000.00', EUR: '90000.00', PHP: '5600000.00' },
    });
    vi.mocked(setAccountFiat).mockResolvedValue({ ...account, fiat: 'PHP' });
    vi.mocked(setHeartSats).mockResolvedValue({ ...account, heartSats: 21 });
    useAuthStore.setState({
      session: 'sess',
      account: { ...account, amountUnit: 'fiat', heartSats: 21 },
    });
    renderWithLocale(<SettingsScreen />, 'en', 'ch', 'USD');
    const wallet = screen.getByRole('region', { name: 'Wallet' });
    const field = within(wallet).getByLabelText('Heart amount') as HTMLInputElement;
    await waitFor(() => {
      expect(field.value).toBe('0.021');
    });
    const display = screen.getByRole('region', { name: 'Display' });
    const fiatGroup = within(display).getByRole('group', { name: 'Fiat currency' });
    fireEvent.click(within(fiatGroup).getByRole('button', { name: 'PHP' }));
    await waitFor(() => {
      expect(field.value).toBe('1.18');
    });
    await act(async () => {
      fireEvent.click(within(wallet).getByRole('button', { name: 'Save' }));
      await Promise.resolve();
    });
    expect(setHeartSats).toHaveBeenCalledWith('sess', 21);
  });

  it('recomputes an untouched fiat draft after the spot rate changes', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.mocked(fetchFxSpot)
      .mockResolvedValueOnce({
        asOf: '2026-08-28T12:00:00.000Z',
        source: 'test',
        rates: { USD: '100000.00', CHF: '80000.00', EUR: '90000.00', PHP: '5600000.00' },
      })
      .mockResolvedValueOnce({
        asOf: '2026-08-28T12:05:00.000Z',
        source: 'test',
        rates: { USD: '200000.00', CHF: '80000.00', EUR: '90000.00', PHP: '5600000.00' },
      });
    vi.mocked(setHeartSats).mockResolvedValue({ ...account, heartSats: 21 });
    useAuthStore.setState({
      session: 'sess',
      account: { ...account, amountUnit: 'fiat', heartSats: 21 },
    });
    renderWithLocale(<SettingsScreen />, 'en', 'ch', 'USD');
    const wallet = screen.getByRole('region', { name: 'Wallet' });
    const field = within(wallet).getByLabelText('Heart amount') as HTMLInputElement;
    await waitFor(() => {
      expect(field.value).toBe('0.021');
    });
    await act(async () => {
      vi.advanceTimersByTime(SPOT_REFRESH_MS);
      await Promise.resolve();
    });
    await waitFor(() => {
      expect(field.value).toBe('0.042');
    });
    await act(async () => {
      fireEvent.click(within(wallet).getByRole('button', { name: 'Save' }));
      await Promise.resolve();
    });
    expect(setHeartSats).toHaveBeenCalledWith('sess', 21);
  });

  it('falls back to the stored sats when the previous fiat draft is invalid', async () => {
    vi.mocked(fetchFxSpot).mockResolvedValue({
      asOf: '2026-08-28T12:00:00.000Z',
      source: 'test',
      rates: { USD: '100000.00', CHF: '80000.00', EUR: '90000.00', PHP: '5600000.00' },
    });
    vi.mocked(setAccountFiat).mockResolvedValue({ ...account, fiat: 'PHP' });
    vi.mocked(setHeartSats).mockResolvedValue({ ...account, heartSats: 21 });
    useAuthStore.setState({
      session: 'sess',
      account: { ...account, amountUnit: 'fiat', heartSats: 21 },
    });
    renderWithLocale(<SettingsScreen />, 'en', 'ch', 'USD');
    const wallet = screen.getByRole('region', { name: 'Wallet' });
    const field = within(wallet).getByLabelText('Heart amount') as HTMLInputElement;
    await waitFor(() => {
      expect(field.value).toBe('0.021');
    });
    fireEvent.change(field, { target: { value: 'not an amount' } });
    const display = screen.getByRole('region', { name: 'Display' });
    const fiatGroup = within(display).getByRole('group', { name: 'Fiat currency' });
    fireEvent.click(within(fiatGroup).getByRole('button', { name: 'PHP' }));
    await waitFor(() => {
      expect(field.value).toBe('1.18');
    });
    await act(async () => {
      fireEvent.click(within(wallet).getByRole('button', { name: 'Save' }));
      await Promise.resolve();
    });
    expect(setHeartSats).toHaveBeenCalledWith('sess', 21);
  });

  it('keeps the sats of a typed fiat draft when the preferred fiat changes', async () => {
    vi.mocked(fetchFxSpot).mockResolvedValue({
      asOf: '2026-08-28T12:00:00.000Z',
      source: 'test',
      rates: { USD: '100000.00', CHF: '80000.00', EUR: '90000.00', PHP: '5600000.00' },
    });
    vi.mocked(setAccountFiat).mockResolvedValue({ ...account, fiat: 'PHP' });
    vi.mocked(setHeartSats).mockResolvedValue({ ...account, heartSats: 42 });
    useAuthStore.setState({
      session: 'sess',
      account: { ...account, amountUnit: 'fiat', heartSats: 21 },
    });
    renderWithLocale(<SettingsScreen />, 'en', 'ch', 'USD');
    const wallet = screen.getByRole('region', { name: 'Wallet' });
    const field = within(wallet).getByLabelText('Heart amount') as HTMLInputElement;
    await waitFor(() => {
      expect(field.value).toBe('0.021');
    });
    fireEvent.change(field, { target: { value: '0.042' } });
    const display = screen.getByRole('region', { name: 'Display' });
    const fiatGroup = within(display).getByRole('group', { name: 'Fiat currency' });
    fireEvent.click(within(fiatGroup).getByRole('button', { name: 'PHP' }));
    await waitFor(() => {
      expect(field.value).toBe('2.35');
    });
    await act(async () => {
      fireEvent.click(within(wallet).getByRole('button', { name: 'Save' }));
      await Promise.resolve();
    });
    expect(setHeartSats).toHaveBeenCalledWith('sess', 42);
  });

  it('falls back to the stored sats when the previous fiat draft is zero', async () => {
    vi.mocked(fetchFxSpot).mockResolvedValue({
      asOf: '2026-08-28T12:00:00.000Z',
      source: 'test',
      rates: { USD: '100000.00', CHF: '80000.00', EUR: '90000.00', PHP: '5600000.00' },
    });
    vi.mocked(setAccountFiat).mockResolvedValue({ ...account, fiat: 'PHP' });
    vi.mocked(setHeartSats).mockResolvedValue({ ...account, heartSats: 21 });
    useAuthStore.setState({
      session: 'sess',
      account: { ...account, amountUnit: 'fiat', heartSats: 21 },
    });
    renderWithLocale(<SettingsScreen />, 'en', 'ch', 'USD');
    const wallet = screen.getByRole('region', { name: 'Wallet' });
    const field = within(wallet).getByLabelText('Heart amount') as HTMLInputElement;
    await waitFor(() => {
      expect(field.value).toBe('0.021');
    });
    fireEvent.change(field, { target: { value: '0' } });
    const display = screen.getByRole('region', { name: 'Display' });
    const fiatGroup = within(display).getByRole('group', { name: 'Fiat currency' });
    fireEvent.click(within(fiatGroup).getByRole('button', { name: 'PHP' }));
    await waitFor(() => {
      expect(field.value).toBe('1.18');
    });
    await act(async () => {
      fireEvent.click(within(wallet).getByRole('button', { name: 'Save' }));
      await Promise.resolve();
    });
    expect(setHeartSats).toHaveBeenCalledWith('sess', 21);
  });

  it('switches to the exact stored sats when the new fiat has no rate', async () => {
    vi.mocked(fetchFxSpot).mockResolvedValue({
      asOf: '2026-08-28T12:00:00.000Z',
      source: 'test',
      rates: { USD: '100000.00', CHF: '80000.00', EUR: '90000.00' },
    });
    vi.mocked(setAccountFiat).mockResolvedValue({ ...account, fiat: 'PHP' });
    useAuthStore.setState({
      session: 'sess',
      account: { ...account, amountUnit: 'fiat', heartSats: 21 },
    });
    renderWithLocale(<SettingsScreen />, 'en', 'ch', 'USD');
    const wallet = screen.getByRole('region', { name: 'Wallet' });
    const field = within(wallet).getByLabelText('Heart amount') as HTMLInputElement;
    await waitFor(() => {
      expect(field.value).toBe('0.021');
    });
    const display = screen.getByRole('region', { name: 'Display' });
    const fiatGroup = within(display).getByRole('group', { name: 'Fiat currency' });
    fireEvent.click(within(fiatGroup).getByRole('button', { name: 'PHP' }));
    await waitFor(() => {
      expect((within(wallet).getByLabelText('Heart amount') as HTMLInputElement).value).toBe('21');
    });
    expect(within(wallet).getByText('No exchange rate yet')).toBeTruthy();
    const unitGroup = within(wallet).getByRole('group', { name: 'Bitcoin or fiat' });
    expect(within(unitGroup).getByRole('button', { name: 'PHP' })).toHaveProperty('disabled', true);
    expect(within(wallet).getByRole('button', { name: 'Save' })).toHaveProperty('disabled', false);
  });

  it.each([
    ['de', 'Herz-Betrag', "Gib einen Betrag von ₿1 bis ₿10'000'000 ein."],
    ['es', 'Importe del corazón', "Introduce un importe de ₿1 a ₿10'000'000."],
    ['fil', 'Halaga ng puso', "Maglagay ng halagang mula ₿1 hanggang ₿10'000'000."],
  ] as const)('names the bitcoin limit for a fiat draft in %s', async (locale, label, error) => {
    vi.mocked(fetchFxSpot).mockResolvedValue({
      asOf: '2026-08-28T12:00:00.000Z',
      source: 'test',
      rates: { USD: '100000.00', CHF: '80000.00', EUR: '90000.00', PHP: '5600000.00' },
    });
    useAuthStore.setState({
      session: 'sess',
      account: { ...account, amountUnit: 'fiat', heartSats: 21 },
    });
    renderWithLocale(<SettingsScreen />, locale, 'ch', 'USD');
    const wallet = screen.getByRole('region', { name: 'Wallet' });
    const field = within(wallet).getByLabelText(label) as HTMLInputElement;
    await waitFor(() => {
      expect(field.value).toBe('0.021');
    });
    fireEvent.change(field, { target: { value: '0' } });
    expect(within(wallet).getByText(error)).toBeTruthy();
    expect(within(wallet).queryByText(/sats/i)).toBeNull();
  });

  it('saves a whole heart amount and confirms it without fiat when no rate is available', async () => {
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

  it('confirms a saved whole heart amount with its preferred-fiat spot figure', async () => {
    vi.mocked(fetchFxSpot).mockResolvedValue({
      asOf: '2026-08-28T12:00:00.000Z',
      source: 'test',
      rates: { USD: '100000.00', CHF: '80000.00', EUR: '90000.00', PHP: '5600000.00' },
    });
    vi.mocked(setHeartSats).mockResolvedValue({ ...account, heartSats: 21 });
    renderWithLocale(<SettingsScreen />, 'en', 'ch', 'USD');
    const wallet = screen.getByRole('region', { name: 'Wallet' });
    await waitFor(() => {
      expect(within(wallet).queryByText('No exchange rate yet')).toBeNull();
    });
    fireEvent.change(within(wallet).getByLabelText('Heart amount'), {
      target: { value: '21' },
    });
    await act(async () => {
      fireEvent.click(within(wallet).getByRole('button', { name: 'Save' }));
      await Promise.resolve();
    });
    expect(setHeartSats).toHaveBeenCalledWith('sess', 21);
    expect(within(wallet).getByRole('status').textContent).toBe('Saved: ₿21 · $0.02 per heart.');
  });

  it.each(['', '0', '1.5', '10000001'])('keeps the invalid heart amount %p local', (value) => {
    renderWithLocale(<SettingsScreen />);
    const wallet = screen.getByRole('region', { name: 'Wallet' });
    const field = within(wallet).getByLabelText('Heart amount');
    const save = within(wallet).getByRole('button', { name: 'Save' }) as HTMLButtonElement;
    fireEvent.change(field, { target: { value } });
    expect(save.disabled).toBe(true);
    expect(field.getAttribute('aria-invalid')).toBe('true');
    expect(field.getAttribute('aria-describedby')).toBe('heart-sats-error');
    expect(setHeartSats).not.toHaveBeenCalled();
    expect(within(wallet).getByText("Enter whole ₿ from ₿1 to ₿10'000'000.")).toBeTruthy();
    fireEvent.click(save);
    expect(setHeartSats).not.toHaveBeenCalled();
  });

  it('disables Save while the heart amount is being saved', async () => {
    let finish: ((value: Account) => void) | undefined;
    vi.mocked(setHeartSats).mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    renderWithLocale(<SettingsScreen />);
    const wallet = screen.getByRole('region', { name: 'Wallet' });
    const save = within(wallet).getByRole('button', { name: 'Save' }) as HTMLButtonElement;
    fireEvent.change(within(wallet).getByLabelText('Heart amount'), { target: { value: '21' } });
    expect(save.disabled).toBe(false);
    fireEvent.click(save);
    expect(setHeartSats).toHaveBeenCalledWith('sess', 21);
    expect(save.disabled).toBe(true);
    expect(within(wallet).getByRole('status').textContent).toBe('Saving…');
    await act(async () => {
      finish?.({ ...account, heartSats: 21 });
      await Promise.resolve();
    });
    expect(save.disabled).toBe(false);
  });

  it('allows fiat decimals and still names the bitcoin limit', async () => {
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
    const field = within(wallet).getByLabelText('Heart amount');
    await waitFor(() => {
      expect((field as HTMLInputElement).value).toBe('0.021');
    });
    fireEvent.change(field, { target: { value: '0.5' } });
    expect(within(wallet).queryByText("Enter an amount from ₿1 to ₿10'000'000.")).toBeNull();
    expect(within(wallet).getByRole('button', { name: 'Save' })).toHaveProperty('disabled', false);
    fireEvent.change(field, { target: { value: '0' } });
    expect(within(wallet).getByText("Enter an amount from ₿1 to ₿10'000'000.")).toBeTruthy();
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

  it('shows Log in at DFX in Wallet once the in-app wallet is ready', () => {
    useWalletStore.getState().setReady(21, 'id');
    renderWithLocale(<SettingsScreen />);
    const wallet = screen.getByRole('region', { name: 'Wallet' });
    expect(within(wallet).getByText(DFX_HINT)).toBeTruthy();
    const button = within(wallet).getByRole('button', { name: 'Log in at DFX' });
    expect(button.hasAttribute('disabled')).toBe(false);
    expect(within(wallet).queryByText('Opening DFX…')).toBeNull();
    expect(within(wallet).queryByRole('alert')).toBeNull();
    expect(dfxLoginUrl).not.toHaveBeenCalled();
  });

  it('ignores each DFX login pin in a production build', () => {
    vi.stubEnv('NEXT_PUBLIC_E2E_NOW', '');
    for (const pin of ['dfx-login', 'dfx-login-busy', 'dfx-login-error']) {
      // visualPin reads window.location.search, not the mocked useSearchParams.
      window.history.replaceState(null, '', `/settings?visual=${pin}`);
      const view = renderWithLocale(<SettingsScreen />);
      expect(screen.queryByRole('button', { name: 'Log in at DFX' })).toBeNull();
      view.unmount();
    }
    useWalletStore.getState().setReady(21, 'id');
    window.history.replaceState(null, '', '/settings?visual=dfx-login-busy');
    const busy = renderWithLocale(<SettingsScreen />);
    expect(screen.getByRole('button', { name: 'Log in at DFX' }).hasAttribute('disabled')).toBe(
      false,
    );
    expect(screen.queryByText('Opening DFX…')).toBeNull();
    busy.unmount();
    window.history.replaceState(null, '', '/settings?visual=dfx-login-error');
    renderWithLocale(<SettingsScreen />);
    expect(screen.queryByRole('alert')).toBeNull();
    expect(dfxLoginUrl).not.toHaveBeenCalled();
  });

  it('draws each DFX login pin without calling the wallet or DFX', () => {
    vi.stubEnv('NEXT_PUBLIC_E2E_NOW', '2026-01-07T12:00:00.000Z');
    window.history.replaceState(null, '', '/settings?visual=dfx-login');
    const idle = renderWithLocale(<SettingsScreen />);
    const idleButton = screen.getByRole('button', { name: 'Log in at DFX' });
    expect(idleButton.hasAttribute('disabled')).toBe(false);
    expect(screen.getByText(DFX_HINT)).toBeTruthy();
    expect(screen.queryByText('Opening DFX…')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
    idle.unmount();

    window.history.replaceState(null, '', '/settings?visual=dfx-login-busy');
    const busy = renderWithLocale(<SettingsScreen />);
    expect(screen.getByRole('button', { name: 'Log in at DFX' }).hasAttribute('disabled')).toBe(
      true,
    );
    expect(screen.getByText('Opening DFX…')).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
    busy.unmount();

    window.history.replaceState(null, '', '/settings?visual=dfx-login-error');
    renderWithLocale(<SettingsScreen />);
    expect(screen.getByRole('button', { name: 'Log in at DFX' }).hasAttribute('disabled')).toBe(
      false,
    );
    expect(screen.getByRole('alert').textContent).toBe(DFX_ERROR);
    expect(screen.queryByText('Opening DFX…')).toBeNull();
    expect(dfxLoginUrl).not.toHaveBeenCalled();
  });

  it('opens one tab synchronously and navigates it only after the session URL exists', async () => {
    useWalletStore.getState().setReady(21, 'id');
    const tab = fakeTab();
    const open = vi.fn(() => tab as unknown as Window);
    vi.stubGlobal('open', open);
    const order: string[] = [];
    open.mockImplementation(() => {
      order.push('open');
      return tab as unknown as Window;
    });
    vi.mocked(dfxLoginUrl).mockImplementation(() => {
      order.push('url');
      return Promise.resolve(DFX_BUY);
    });
    renderWithLocale(<SettingsScreen />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Log in at DFX' }));
    });
    expect(order).toEqual(['open', 'url']);
    expect(open).toHaveBeenCalledWith('', '_blank');
    expect(tab.openerAtNavigation).toBeNull();
    expect(tab.href).toBe(DFX_BUY);
    expect(tab.close).not.toHaveBeenCalled();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByText('Opening DFX…')).toBeNull();
    expect(screen.queryByText(DFX_BUY)).toBeNull();
    expect(window.location.pathname).not.toBe('/buy');
  });

  it('closes the tab and shows the alert when sign-in fails, then allows another press', async () => {
    useWalletStore.getState().setReady(21, 'id');
    const first = fakeTab();
    const second = fakeTab();
    const open = vi
      .fn()
      .mockReturnValueOnce(first as unknown as Window)
      .mockReturnValueOnce(second as unknown as Window);
    vi.stubGlobal('open', open);
    vi.mocked(dfxLoginUrl).mockRejectedValueOnce(new Error('wallet-connect'));
    renderWithLocale(<SettingsScreen />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Log in at DFX' }));
    });
    expect(first.close).toHaveBeenCalledTimes(1);
    expect(first.href).toBe('');
    const alert = screen.getByRole('alert');
    expect(alert.textContent).toBe(DFX_ERROR);
    expect(alert.textContent).not.toContain('wallet-connect');
    const button = screen.getByRole('button', { name: 'Log in at DFX' });
    expect(button.hasAttribute('disabled')).toBe(false);

    vi.mocked(dfxLoginUrl).mockResolvedValueOnce(DFX_BUY);
    await act(async () => {
      fireEvent.click(button);
    });
    expect(screen.queryByRole('alert')).toBeNull();
    expect(second.openerAtNavigation).toBeNull();
    expect(second.href).toBe(DFX_BUY);
  });

  it('shows the alert and does not ask DFX when the new tab is blocked', async () => {
    useWalletStore.getState().setReady(21, 'id');
    const open = vi.fn(() => null);
    vi.stubGlobal('open', open);
    renderWithLocale(<SettingsScreen />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Log in at DFX' }));
    });
    expect(open).toHaveBeenCalledWith('', '_blank');
    expect(dfxLoginUrl).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toBe(DFX_ERROR);
    expect(screen.getByRole('button', { name: 'Log in at DFX' }).hasAttribute('disabled')).toBe(
      false,
    );
  });

  it('closes the tab when navigation throws', async () => {
    useWalletStore.getState().setReady(21, 'id');
    const tab = fakeTab(true);
    vi.stubGlobal(
      'open',
      vi.fn(() => tab as unknown as Window),
    );
    vi.mocked(dfxLoginUrl).mockResolvedValue(DFX_BUY);
    renderWithLocale(<SettingsScreen />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Log in at DFX' }));
    });
    expect(tab.openerAtNavigation).toBeNull();
    expect(tab.close).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('alert').textContent).toBe(DFX_ERROR);
    expect(window.location.pathname).not.toBe('/buy');
  });

  it('opens only one tab when Log in at DFX is pressed twice before the first press finishes', async () => {
    useWalletStore.getState().setReady(21, 'id');
    const tab = fakeTab();
    const open = vi.fn(() => tab as unknown as Window);
    vi.stubGlobal('open', open);
    let finish: (url: string) => void = () => undefined;
    vi.mocked(dfxLoginUrl).mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    renderWithLocale(<SettingsScreen />);
    const button = screen.getByRole('button', { name: 'Log in at DFX' });
    fireEvent.click(button);
    expect(screen.getByText('Opening DFX…')).toBeTruthy();
    expect(button.hasAttribute('disabled')).toBe(true);
    pressDespiteDisabled(button);
    expect(open).toHaveBeenCalledTimes(1);
    expect(dfxLoginUrl).toHaveBeenCalledTimes(1);
    await act(async () => {
      finish(DFX_BUY);
    });
    expect(tab.href).toBe(DFX_BUY);
    expect(screen.queryByText('Opening DFX…')).toBeNull();
  });

  it.each([
    ['resolve', false],
    ['reject', false],
    ['resolve', true],
    ['reject', true],
  ] as const)(
    'does not navigate or warn after unmount on %s with closed=%s',
    async (outcome, closed) => {
      useWalletStore.getState().setReady(21, 'id');
      const tab = fakeTab();
      vi.stubGlobal(
        'open',
        vi.fn(() => tab as unknown as Window),
      );
      const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      let finish: (url: string) => void = () => undefined;
      let fail: (reason: Error) => void = () => undefined;
      vi.mocked(dfxLoginUrl).mockReturnValueOnce(
        new Promise((resolve, reject) => {
          finish = resolve;
          fail = reject;
        }),
      );
      const view = renderWithLocale(<SettingsScreen />);
      fireEvent.click(screen.getByRole('button', { name: 'Log in at DFX' }));
      view.unmount();
      tab.closed = closed;
      await act(async () => {
        if (outcome === 'resolve') finish(DFX_BUY);
        else fail(new Error('dfx-login'));
      });
      expect(tab.close).toHaveBeenCalledTimes(closed ? 0 : 1);
      expect(tab.href).toBe('');
      expect(screen.queryByRole('alert')).toBeNull();
      expect(error).not.toHaveBeenCalled();
      error.mockRestore();
    },
  );

  it('still signs in when the idle pin showed the row and the wallet is off', async () => {
    vi.stubEnv('NEXT_PUBLIC_E2E_NOW', '2026-01-07T12:00:00.000Z');
    window.history.replaceState(null, '', '/settings?visual=dfx-login');
    const tab = fakeTab();
    vi.stubGlobal(
      'open',
      vi.fn(() => tab as unknown as Window),
    );
    vi.mocked(dfxLoginUrl).mockRejectedValue(new Error('wallet-connect'));
    renderWithLocale(<SettingsScreen />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Log in at DFX' }));
    });
    expect(dfxLoginUrl).toHaveBeenCalledTimes(1);
    expect(tab.close).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('alert').textContent).toBe(DFX_ERROR);
  });

  it('clears opener while the sign-in URL is still pending', async () => {
    useWalletStore.getState().setReady(21, 'id');
    const tab = fakeTab();
    vi.stubGlobal(
      'open',
      vi.fn(() => tab as unknown as Window),
    );
    let finish: (url: string) => void = () => undefined;
    vi.mocked(dfxLoginUrl).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    renderWithLocale(<SettingsScreen />);
    fireEvent.click(screen.getByRole('button', { name: 'Log in at DFX' }));
    expect(dfxLoginUrl).toHaveBeenCalledTimes(1);
    expect(tab.opener).toBeNull();
    expect(tab.href).toBe('');
    expect(tab.openerAtNavigation).toBe('pending');
    await act(async () => {
      finish(DFX_BUY);
    });
    expect(tab.openerAtNavigation).toBeNull();
    expect(tab.href).toBe(DFX_BUY);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('drops the URL when the member closes the tab during the wait, then allows another press', async () => {
    useWalletStore.getState().setReady(21, 'id');
    const first = fakeTab();
    const second = fakeTab();
    const open = vi
      .fn()
      .mockReturnValueOnce(first as unknown as Window)
      .mockReturnValueOnce(second as unknown as Window);
    vi.stubGlobal('open', open);
    let finish: (url: string) => void = () => undefined;
    vi.mocked(dfxLoginUrl).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    renderWithLocale(<SettingsScreen />);
    const button = screen.getByRole('button', { name: 'Log in at DFX' });
    fireEvent.click(button);
    expect(first.opener).toBeNull();
    first.closed = true;
    await act(async () => {
      finish(DFX_BUY);
    });
    expect(first.href).toBe('');
    expect(first.openerAtNavigation).toBe('pending');
    expect(first.close).not.toHaveBeenCalled();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByText('Opening DFX…')).toBeNull();
    expect(button.hasAttribute('disabled')).toBe(false);

    vi.mocked(dfxLoginUrl).mockResolvedValueOnce(DFX_BUY);
    await act(async () => {
      fireEvent.click(button);
    });
    expect(open).toHaveBeenCalledTimes(2);
    expect(second.href).toBe(DFX_BUY);
    expect(second.openerAtNavigation).toBeNull();
    expect(first.href).toBe('');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('stays silent when sign-in fails after the member closes the tab, then allows another press', async () => {
    useWalletStore.getState().setReady(21, 'id');
    const first = fakeTab();
    const second = fakeTab();
    const open = vi
      .fn()
      .mockReturnValueOnce(first as unknown as Window)
      .mockReturnValueOnce(second as unknown as Window);
    vi.stubGlobal('open', open);
    let fail: (error: Error) => void = () => undefined;
    const pending = new Promise<string>((_resolve, reject) => {
      fail = reject;
    });
    const rejectionObserved = pending.catch(() => undefined);
    vi.mocked(dfxLoginUrl).mockReturnValueOnce(pending);
    renderWithLocale(<SettingsScreen />);
    const button = screen.getByRole('button', { name: 'Log in at DFX' });
    fireEvent.click(button);
    expect(first.opener).toBeNull();
    first.closed = true;
    await act(async () => {
      fail(new Error('wallet-connect'));
      await rejectionObserved;
    });
    expect(first.close).not.toHaveBeenCalled();
    expect(first.href).toBe('');
    expect(first.openerAtNavigation).toBe('pending');
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByText('Opening DFX…')).toBeNull();
    expect(button.hasAttribute('disabled')).toBe(false);

    vi.mocked(dfxLoginUrl).mockResolvedValueOnce(DFX_BUY);
    await act(async () => {
      fireEvent.click(button);
    });
    expect(open).toHaveBeenCalledTimes(2);
    expect(dfxLoginUrl).toHaveBeenCalledTimes(2);
    expect(second.href).toBe(DFX_BUY);
    expect(second.openerAtNavigation).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
