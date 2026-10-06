import { cleanup, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SettingsScreen } from '@/components/SettingsScreen';
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

const account: Account = {
  id: 'acc_1',
  linkingKey: '02abcdef',
  role: 'basis',
  name: 'Ada',
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

const ADD_HINT =
  'This creates a recovery phrase on this device. Your existing login passkey stays.';

beforeEach(() => {
  useAuthStore.setState({ session: 'sess', account });
});

afterEach(() => {
  cleanup();
  useAuthStore.setState({ session: null, account: null });
});

describe('SettingsScreen', () => {
  it('renders nothing without a session', () => {
    useAuthStore.setState({ session: null, account: null });
    const { container } = renderWithLocale(<SettingsScreen />);
    expect(container.innerHTML).toBe('');
  });

  it('links Recovery phrase to /wallet/phrase in the Wallet section when the account has a phrase', () => {
    useAuthStore.setState({ account: { ...account, passkeyCredentialId: 'cred-seed' } });
    renderWithLocale(<SettingsScreen />);
    expect(screen.getByRole('heading', { level: 1, name: 'Settings' })).toBeTruthy();
    const section = screen.getByRole('region', { name: 'Wallet' });
    const link = screen.getByRole('link', { name: 'Recovery phrase' });
    expect(section.contains(link)).toBe(true);
    expect(link.getAttribute('href')).toBe('/wallet/phrase');
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

  it('renders nothing before the account has loaded', () => {
    useAuthStore.setState({ account: null });
    const { container } = renderWithLocale(<SettingsScreen />);
    expect(container.innerHTML).toBe('');
  });
});
