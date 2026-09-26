import { cleanup, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GrantsScreen } from '@/components/GrantsScreen';
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
  role: 'verified',
  name: 'Ada',
  location: null,
  lightningAddress: 'alice@walletofsatoshi.com',
  lightningAddressVerified: false,
  forumLawsDismissed: false,
  createdAt: 1_700_000_000,
  rulesAgreedAt: 1_700_000_001,
  viewKey: 'a'.repeat(64),
  aboutMe: null,
  aboutMeHasPhoto: false,
  setup: null,
  missing: [],
  funding: {
    status: 'none',
    trialUtcDate: null,
    admittedAt: null,
    reviewedByName: null,
  },
};

beforeEach(() => {
  useAuthStore.setState({ session: 'sess', account });
});

afterEach(cleanup);

describe('GrantsScreen', () => {
  it('renders nothing without a session', () => {
    useAuthStore.setState({ session: null, account });
    const { container } = renderWithLocale(<GrantsScreen />);
    expect(container.firstChild).toBeNull();
  });

  it('shows the unverified explanation for a basis account', () => {
    useAuthStore.setState({
      session: 'sess',
      account: { ...account, role: 'basis', funding: null },
    });
    renderWithLocale(<GrantsScreen />);
    expect(screen.getByText('You are not verified yet.')).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Open applications' })).toBeNull();
  });

  it('shows the grant card without the staff queue for a verified member', () => {
    renderWithLocale(<GrantsScreen />);
    expect(screen.getByText('21 gifts grant')).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Open applications' })).toBeNull();
  });

  it('shows the grant card without the staff queue when the account is missing', () => {
    useAuthStore.setState({ session: 'sess', account: null });
    const { container } = renderWithLocale(<GrantsScreen />);
    expect(container.querySelector('a')).toBeNull();
    expect(screen.queryByText('21 gifts grant')).toBeNull();
  });

  it.each(['moderator', 'founder'] as const)(
    'links a %s to the open applications queue',
    (role) => {
      useAuthStore.setState({ session: 'sess', account: { ...account, role } });
      renderWithLocale(<GrantsScreen />);
      expect(screen.getByRole('link', { name: 'Open applications' }).getAttribute('href')).toBe(
        '/grants/applications',
      );
    },
  );
});
