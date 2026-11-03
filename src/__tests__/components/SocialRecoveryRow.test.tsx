import { cleanup, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SocialRecoveryRow } from '@/components/SocialRecoveryRow';
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
};

beforeEach(() => {
  useAuthStore.setState({ session: 'sess', account });
});

afterEach(() => {
  cleanup();
  useAuthStore.setState({ session: null, account: null });
});

describe('SocialRecoveryRow', () => {
  it('renders nothing before the account has loaded', () => {
    useAuthStore.setState({ account: null });
    const { container } = renderWithLocale(<SocialRecoveryRow />);
    expect(container.innerHTML).toBe('');
  });

  it.each([
    ['missing', {}],
    ['false', { sparkWalletVerified: false, socialRecoverySetUp: true }],
  ])(
    'waits for a connected wallet when sparkWalletVerified is %s, and keeps the kept-shares link',
    (_label, wallet) => {
      useAuthStore.setState({ account: { ...account, ...wallet } });
      renderWithLocale(<SocialRecoveryRow />);
      const row = document.getElementById('social-recovery') as HTMLElement;
      expect(row.className).toContain('border-t');
      expect(row.className).toContain('scroll-mt-4');
      expect(row.textContent).toContain('Social Recovery');
      expect(screen.getByText('Available once your wallet is connected.')).toBeTruthy();
      expect(screen.queryByRole('link', { name: 'Secure my account' })).toBeNull();
      const held = screen.getByRole('link', { name: 'Shares I keep for others' });
      expect(held.getAttribute('href')).toBe('/settings/held-shares');
    },
  );

  it.each([
    ['missing', {}],
    ['false', { socialRecoverySetUp: false }],
  ])('offers Secure my account as the primary action while setup is %s', (_label, recovery) => {
    useAuthStore.setState({ account: { ...account, sparkWalletVerified: true, ...recovery } });
    renderWithLocale(<SocialRecoveryRow />);
    expect(
      screen.getByText('Not set up yet. Two people you trust can help you get your account back.'),
    ).toBeTruthy();
    const secure = screen.getByRole('link', { name: 'Secure my account' });
    expect(secure.getAttribute('href')).toBe('/settings/social-recovery');
    expect(secure.className).toContain('w-full');
    const held = screen.getByRole('link', { name: 'Shares I keep for others' });
    expect(secure.className).not.toBe(held.className);
  });

  it('says it is set up and keeps Secure my account as a secondary link', () => {
    useAuthStore.setState({
      account: { ...account, sparkWalletVerified: true, socialRecoverySetUp: true },
    });
    renderWithLocale(<SocialRecoveryRow />);
    expect(screen.getByText('Set up for this wallet.')).toBeTruthy();
    const secure = screen.getByRole('link', { name: 'Secure my account' });
    const held = screen.getByRole('link', { name: 'Shares I keep for others' });
    expect(secure.className).toBe(held.className);
    const links = screen.getAllByRole('link').map((link) => link.textContent);
    expect(links).toEqual(['Secure my account', 'Shares I keep for others']);
  });
});
