import { cleanup, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ModerateScreen } from '@/components/ModerateScreen';
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

vi.mock('@/lib/api', () => ({
  listHiddenMessages: vi.fn(),
}));

import { listHiddenMessages } from '@/lib/api';

const listMock = vi.mocked(listHiddenMessages);

const account: Account = {
  id: 'acc_1',
  linkingKey: '02abcdef',
  role: 'moderator',
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
};

beforeEach(() => {
  vi.clearAllMocks();
  useAuthStore.setState({ session: 'sess', account });
});

afterEach(cleanup);

describe('ModerateScreen', () => {
  it('renders nothing when there is no session', () => {
    useAuthStore.setState({ session: null, account });
    const { container } = renderWithLocale(<ModerateScreen />);
    expect(container.firstChild).toBeNull();
    expect(listMock).not.toHaveBeenCalled();
  });

  it('shows forbidden copy for a basis account and does not fetch', () => {
    useAuthStore.setState({ session: 'sess', account: { ...account, role: 'basis' } });
    renderWithLocale(<ModerateScreen />);
    expect(screen.getByRole('heading', { name: 'Moderation' })).toBeTruthy();
    expect(screen.getByText('This page is for founders and moderators.')).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Hidden notes' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Open proposals' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Moderators' })).toBeNull();
    expect(screen.queryByRole('list', { name: 'Moderation tools' })).toBeNull();
    expect(listMock).not.toHaveBeenCalled();
  });

  it('shows forbidden copy for a verified account and does not fetch', () => {
    useAuthStore.setState({ session: 'sess', account: { ...account, role: 'verified' } });
    renderWithLocale(<ModerateScreen />);
    expect(screen.getByText('This page is for founders and moderators.')).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Hidden notes' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Open proposals' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Moderators' })).toBeNull();
    expect(listMock).not.toHaveBeenCalled();
  });

  it('shows forbidden copy when the account is missing', () => {
    useAuthStore.setState({ session: 'sess', account: null });
    renderWithLocale(<ModerateScreen />);
    expect(screen.getByText('This page is for founders and moderators.')).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Open proposals' })).toBeNull();
    expect(listMock).not.toHaveBeenCalled();
  });

  it.each(['founder', 'moderator'] as const)(
    'shows the hub, Hidden notes, and Moderators links for a %s and does not fetch',
    (role) => {
      useAuthStore.setState({ session: 'sess', account: { ...account, role } });
      renderWithLocale(<ModerateScreen />);
      expect(screen.getByRole('heading', { name: 'Moderation' })).toBeTruthy();
      expect(screen.getByText('Tools for founders and moderators.')).toBeTruthy();
      expect(
        screen.getByText(
          'Hiding a note is a soft hide: the note and its untagged direct replies leave the living room. It is not a hard delete.',
        ),
      ).toBeTruthy();
      expect(screen.getByText('Closed staff room for founders and moderators.')).toBeTruthy();
      expect(screen.getByRole('list', { name: 'Moderation tools' })).toBeTruthy();
      expect(screen.getByRole('link', { name: 'Hidden notes' }).getAttribute('href')).toBe(
        '/moderate/hidden',
      );
      expect(screen.getByRole('link', { name: 'Open proposals' }).getAttribute('href')).toBe(
        '/moderate/proposals',
      );
      expect(screen.getByRole('link', { name: 'Moderators' }).getAttribute('href')).toBe(
        '/moderate/group',
      );
      expect(listMock).not.toHaveBeenCalled();
    },
  );
});
