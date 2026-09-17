import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ModeratorGroupScreen } from '@/components/ModeratorGroupScreen';
import type { Account, Conversation, ConversationMessage } from '@/lib/api-types';
import { useAuthStore } from '@/stores/auth-store';
import { renderWithLocale } from '@/__tests__/render-with-locale';

const push = vi.fn();

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

vi.mock('next/navigation', () => ({
  useRouter: (): { push: typeof push; replace: typeof push } => ({ push, replace: push }),
}));

vi.mock('@/lib/api', () => ({
  fetchModeratorGroup: vi.fn(),
  fetchConversation: vi.fn(),
  postConversationMessage: vi.fn(),
}));

import { fetchConversation, fetchModeratorGroup } from '@/lib/api';

const groupMock = vi.mocked(fetchModeratorGroup);
const threadMock = vi.mocked(fetchConversation);

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
  setup: null,
  missing: [],
};

const GROUP: Conversation = {
  id: 'conv-mod',
  kind: 'moderator_group',
  name: 'Staff room',
  lastText: 'Hello mods',
  lastAt: '2026-08-28T15:00:00.000Z',
  lastFromMe: false,
};

const MESSAGE: ConversationMessage = {
  id: 'm1',
  name: 'Ada',
  text: 'Hello mods',
  createdAt: '2026-08-28T15:00:00.000Z',
  fromMe: false,
};

beforeEach(() => {
  vi.clearAllMocks();
  push.mockClear();
  groupMock.mockResolvedValue(GROUP);
  threadMock.mockResolvedValue([MESSAGE]);
  useAuthStore.setState({ session: 'sess', account });
});

afterEach(cleanup);

describe('ModeratorGroupScreen', () => {
  it('renders nothing when there is no session', () => {
    useAuthStore.setState({ session: null, account });
    const { container } = renderWithLocale(<ModeratorGroupScreen />);
    expect(container.firstChild).toBeNull();
    expect(groupMock).not.toHaveBeenCalled();
    expect(threadMock).not.toHaveBeenCalled();
  });

  it('shows forbidden copy for a founder and does not fetch', () => {
    useAuthStore.setState({ session: 'sess', account: { ...account, role: 'founder' } });
    renderWithLocale(<ModeratorGroupScreen />);
    expect(screen.getByRole('heading', { name: 'Moderators' })).toBeTruthy();
    expect(screen.getByText('This page is for founders and moderators.')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Moderation' }).getAttribute('href')).toBe('/moderate');
    expect(screen.queryByRole('list', { name: 'Conversations' })).toBeNull();
    expect(screen.queryByLabelText('Your message')).toBeNull();
    expect(groupMock).not.toHaveBeenCalled();
    expect(threadMock).not.toHaveBeenCalled();
  });

  it('shows forbidden copy for a basis account and does not fetch', () => {
    useAuthStore.setState({ session: 'sess', account: { ...account, role: 'basis' } });
    renderWithLocale(<ModeratorGroupScreen />);
    expect(screen.getByText('This page is for founders and moderators.')).toBeTruthy();
    expect(groupMock).not.toHaveBeenCalled();
  });

  it('shows forbidden copy when the account is missing', () => {
    useAuthStore.setState({ session: 'sess', account: null });
    renderWithLocale(<ModeratorGroupScreen />);
    expect(screen.getByText('This page is for founders and moderators.')).toBeTruthy();
    expect(groupMock).not.toHaveBeenCalled();
  });

  it('shows loading then the group thread', async () => {
    let resolveGroup: ((value: Conversation) => void) | undefined;
    groupMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveGroup = resolve;
        }),
    );
    threadMock.mockResolvedValue([MESSAGE]);
    renderWithLocale(<ModeratorGroupScreen />);
    expect(screen.getByRole('heading', { name: 'Moderators' })).toBeTruthy();
    expect(screen.getByText('Loading…')).toBeTruthy();
    await act(async () => {
      resolveGroup?.(GROUP);
      await Promise.resolve();
    });
    expect(await screen.findByText('Hello mods')).toBeTruthy();
    expect(groupMock).toHaveBeenCalledWith('sess');
    expect(threadMock).toHaveBeenCalledWith('sess', GROUP.id);
  });

  it('shows an error and retries', async () => {
    groupMock.mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce(GROUP);
    threadMock.mockResolvedValue([MESSAGE]);
    renderWithLocale(<ModeratorGroupScreen />);
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toBe('Could not load hidden notes. Please try again.');
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('Hello mods')).toBeTruthy();
    expect(groupMock).toHaveBeenCalledTimes(2);
  });

  it('ignores a stale group resolve after unmount', async () => {
    let resolveGroup: ((value: Conversation) => void) | undefined;
    groupMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveGroup = resolve;
        }),
    );
    const view = renderWithLocale(<ModeratorGroupScreen />);
    view.unmount();
    await act(async () => {
      resolveGroup?.(GROUP);
      await Promise.resolve();
    });
    expect(screen.queryByText('Hello mods')).toBeNull();
  });

  it('does not apply a late resolve after the session is cleared', async () => {
    let resolveGroup: ((value: Conversation) => void) | undefined;
    groupMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveGroup = resolve;
        }),
    );
    renderWithLocale(<ModeratorGroupScreen />);
    expect(screen.getByText('Loading…')).toBeTruthy();
    useAuthStore.setState({ session: null, account: null });
    await waitFor(() => {
      expect(screen.queryByText('Loading…')).toBeNull();
    });
    await act(async () => {
      resolveGroup?.(GROUP);
      await Promise.resolve();
    });
    expect(screen.queryByText('Hello mods')).toBeNull();
  });
});
