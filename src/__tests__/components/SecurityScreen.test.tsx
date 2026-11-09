import { cleanup, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SecurityScreen } from '@/components/SecurityScreen';
import type { Account } from '@/lib/api-types';
import { useAuthStore } from '@/stores/auth-store';
import { renderWithLocale } from '@/__tests__/render-with-locale';

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
vi.mock('@/components/PreviousWalletsRow', () => ({
  PreviousWalletsRow: () => <div data-testid="previous-wallets-row" />,
}));

const account: Account = {
  id: 'acc_1',
  linkingKey: null,
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
  passkeyCredentialId: 'cred-seed',
};

/** The hint shown while the account has no recovery phrase yet. */
const ADD_HINT =
  'This creates a recovery phrase on this device. Your existing login passkey stays.';

/**
 * Finds one section of the screen.
 *
 * @param name - The section's heading.
 * @returns The section.
 */
function section(name: string): HTMLElement {
  return screen.getByRole('region', { name });
}

beforeEach(() => {
  useAuthStore.setState({ session: 'sess', account });
});

afterEach(() => {
  cleanup();
  useAuthStore.setState({ session: null, account: null });
});

describe('SecurityScreen', () => {
  it('renders nothing without a session', () => {
    useAuthStore.setState({ session: null });
    const { container } = renderWithLocale(<SecurityScreen />);
    expect(container.innerHTML).toBe('');
  });

  it('renders nothing before the account has loaded', () => {
    useAuthStore.setState({ account: null });
    const { container } = renderWithLocale(<SecurityScreen />);
    expect(container.innerHTML).toBe('');
  });

  it('shows the title and three sections in order', () => {
    renderWithLocale(<SecurityScreen />);
    expect(screen.getByRole('heading', { level: 1, name: 'Account security' })).toBeTruthy();
    expect(screen.getAllByRole('heading', { level: 2 }).map((node) => node.textContent)).toEqual([
      'Protect my account',
      'Help someone else',
      'More options',
    ]);
  });

  it.each([
    ['missing', {}],
    ['false', { sparkWalletVerified: false, socialRecoverySetUp: true }],
  ])(
    'without a verified wallet (%s) says so and hides Secure my account',
    (_label, wallet: Partial<Account>) => {
      useAuthStore.setState({ account: { ...account, ...wallet } });
      renderWithLocale(<SecurityScreen />);
      const protect = section('Protect my account');
      expect(within(protect).getByText('Available once your wallet is connected.')).toBeTruthy();
      expect(within(protect).queryByRole('link')).toBeNull();
    },
  );

  it.each([
    ['false', { socialRecoverySetUp: false }],
    ['missing', {}],
  ])(
    'not set up (%s) offers Secure my account as the primary link',
    (_label, setUp: Partial<Account>) => {
      useAuthStore.setState({ account: { ...account, sparkWalletVerified: true, ...setUp } });
      renderWithLocale(<SecurityScreen />);
      const protect = section('Protect my account');
      expect(
        within(protect).getByText(
          'Not set up yet. Two people you trust can help you get your account back.',
        ),
      ).toBeTruthy();
      const link = within(protect).getByRole('link', { name: 'Secure my account' });
      expect(link.getAttribute('href')).toBe('/settings/social-recovery');
      expect(link.className).toContain('bg-app-btn');
    },
  );

  it('set up keeps Secure my account as a secondary link', () => {
    useAuthStore.setState({
      account: { ...account, sparkWalletVerified: true, socialRecoverySetUp: true },
    });
    renderWithLocale(<SecurityScreen />);
    const protect = section('Protect my account');
    expect(within(protect).getByText('Set up for this wallet.')).toBeTruthy();
    const link = within(protect).getByRole('link', { name: 'Secure my account' });
    expect(link.getAttribute('href')).toBe('/settings/social-recovery');
    expect(link.className).not.toContain('bg-app-btn');
  });

  it('always offers the shares kept for others', () => {
    renderWithLocale(<SecurityScreen />);
    const help = section('Help someone else');
    expect(
      within(help).getByText(
        'If someone chose you to help restore their account, keep their share here.',
      ),
    ).toBeTruthy();
    expect(
      within(help).getByRole('link', { name: 'Shares I keep for others' }).getAttribute('href'),
    ).toBe('/settings/held-shares');
  });

  it('with a recovery phrase links to it, above the previous wallets', () => {
    renderWithLocale(<SecurityScreen />);
    const more = section('More options');
    const link = within(more).getByRole('link', { name: 'Recovery phrase' });
    expect(link.getAttribute('href')).toBe('/wallet/phrase');
    expect(within(more).queryByRole('link', { name: 'Add recovery phrase' })).toBeNull();
    expect(within(more).queryByText(ADD_HINT)).toBeNull();
    expect(link.nextElementSibling).toBe(within(more).getByTestId('previous-wallets-row'));
  });

  it.each([
    ['missing', undefined],
    ['empty', ''],
    ['null', null],
  ])(
    'without a recovery phrase (passkeyCredentialId %s) offers the hint and Add recovery phrase',
    (_label, credentialId) => {
      useAuthStore.setState({
        account: { ...account, passkeyCredentialId: credentialId } as Account,
      });
      renderWithLocale(<SecurityScreen />);
      const more = section('More options');
      expect(within(more).getByText(ADD_HINT)).toBeTruthy();
      expect(
        within(more).getByRole('link', { name: 'Add recovery phrase' }).getAttribute('href'),
      ).toBe('/wallet/phrase');
      expect(within(more).queryByRole('link', { name: 'Recovery phrase' })).toBeNull();
      expect(within(more).getByTestId('previous-wallets-row')).toBeTruthy();
    },
  );
});
