import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HiddenNotesScreen } from '@/components/HiddenNotesScreen';
import type { Account, HiddenMessage } from '@/lib/api-types';
import { formatForumTime } from '@/lib/forum-time';
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

const HIDDEN: HiddenMessage = {
  id: 'h1',
  name: 'Bob',
  text: 'Hidden note',
  createdAt: '2026-08-28T12:00:00.000Z',
  sats: 0,
  hasPhoto: false,
  hasVideo: false,
  videoContentType: null,
  parentId: null,
  deletedAt: '2026-08-29T15:00:00.000Z',
  deletedBy: { id: 'acc_mod', name: 'Ada', role: 'moderator' },
};

const OLDER: HiddenMessage = {
  ...HIDDEN,
  id: 'h0',
  name: 'Carol',
  text: 'Older hide',
  deletedAt: '2026-08-29T12:00:00.000Z',
};

const SAME_TIME: HiddenMessage = {
  ...HIDDEN,
  id: 'h-same',
  name: 'Dan',
  text: 'Same hide time',
  deletedAt: '2026-08-29T15:00:00.000Z',
};

const UNNAMED: HiddenMessage = {
  ...HIDDEN,
  id: 'h2',
  name: 'Eve',
  text: '',
  deletedAt: '2026-08-30T12:00:00.000Z',
  deletedBy: { id: 'acc_mod', name: null, role: 'moderator' },
};

beforeEach(() => {
  vi.clearAllMocks();
  listMock.mockResolvedValue([]);
  useAuthStore.setState({ session: 'sess', account });
});

afterEach(cleanup);

describe('HiddenNotesScreen', () => {
  it('renders nothing when there is no session', () => {
    useAuthStore.setState({ session: null, account });
    const { container } = renderWithLocale(<HiddenNotesScreen />);
    expect(container.firstChild).toBeNull();
    expect(listMock).not.toHaveBeenCalled();
  });

  it('shows forbidden copy for a basis account and does not fetch', () => {
    useAuthStore.setState({ session: 'sess', account: { ...account, role: 'basis' } });
    renderWithLocale(<HiddenNotesScreen />);
    expect(screen.getByRole('heading', { name: 'Hidden notes' })).toBeTruthy();
    expect(screen.getByText('This page is for moderators.')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Moderation' }).getAttribute('href')).toBe('/moderate');
    expect(screen.queryByText('Moderation')).toBeNull();
    expect(screen.queryByText('No hidden notes.')).toBeNull();
    expect(screen.queryByRole('list')).toBeNull();
    expect(listMock).not.toHaveBeenCalled();
  });

  it('shows forbidden copy for a verified account and does not fetch', () => {
    useAuthStore.setState({ session: 'sess', account: { ...account, role: 'verified' } });
    renderWithLocale(<HiddenNotesScreen />);
    expect(screen.getByText('This page is for moderators.')).toBeTruthy();
    expect(listMock).not.toHaveBeenCalled();
  });

  it('shows forbidden copy when the account is missing', () => {
    useAuthStore.setState({ session: 'sess', account: null });
    renderWithLocale(<HiddenNotesScreen />);
    expect(screen.getByText('This page is for moderators.')).toBeTruthy();
    expect(listMock).not.toHaveBeenCalled();
  });

  it('shows loading heading and copy', () => {
    listMock.mockImplementation(() => new Promise(() => undefined));
    renderWithLocale(<HiddenNotesScreen />);
    expect(screen.getByRole('heading', { name: 'Hidden notes' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Moderation' }).getAttribute('href')).toBe('/moderate');
    expect(screen.queryByText('Moderation')).toBeNull();
    expect(
      screen.getByText(
        'Hiding a note is a soft hide: the note and its untagged direct replies leave the living room. It is not a hard delete.',
      ),
    ).toBeTruthy();
    expect(screen.getByText('Loading…')).toBeTruthy();
  });

  it('links a member author and keeps a blank id as text', async () => {
    listMock.mockResolvedValue([
      { ...HIDDEN, accountId: 'acc-bob' },
      { ...HIDDEN, id: 'h-blank', name: '', accountId: '' },
    ]);
    renderWithLocale(<HiddenNotesScreen />);
    const author = await screen.findByRole('link', { name: 'View profile' });
    expect(author.getAttribute('href')).toBe('/members/acc-bob');
    expect(author.textContent).toBe('Bob');
    expect(screen.getByText('Unnamed')).toBeTruthy();
  });

  it('shows empty copy', async () => {
    listMock.mockResolvedValue([]);
    renderWithLocale(<HiddenNotesScreen />);
    expect(await screen.findByText('No hidden notes.')).toBeTruthy();
    expect(listMock).toHaveBeenCalledWith('sess');
  });

  it('shows an error and retries', async () => {
    listMock.mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce([HIDDEN]);
    renderWithLocale(<HiddenNotesScreen />);
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toBe('Could not load hidden notes. Please try again.');
    expect(alert.className).toContain('text-app-danger');
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('Hidden note')).toBeTruthy();
    expect(listMock).toHaveBeenCalledTimes(2);
  });

  it('lists rows newest-hidden first with author, text, times, and hider', async () => {
    listMock.mockResolvedValue([HIDDEN, SAME_TIME, OLDER]);
    renderWithLocale(<HiddenNotesScreen />);
    expect(await screen.findByRole('list', { name: 'Hidden notes' })).toBeTruthy();
    const items = screen.getAllByRole('listitem');
    expect(items[0]?.textContent).toContain('Bob');
    expect(items[0]?.textContent).toContain('Hidden note');
    expect(items[0]?.textContent).toContain('Hidden by Ada');
    expect(items[1]?.textContent).toContain('Dan');
    expect(items[2]?.textContent).toContain('Carol');
    expect(items[2]?.textContent).toContain('Older hide');
    expect(document.querySelector('a[href="/messages/h1"]')).toBeTruthy();
    const created = screen.getAllByText(formatForumTime(HIDDEN.createdAt, 'en'));
    const hiddenAt = screen.getAllByText(formatForumTime(HIDDEN.deletedAt, 'en'));
    expect(created.length).toBeGreaterThan(0);
    expect(hiddenAt.length).toBeGreaterThan(0);
    const times = document.querySelectorAll('time');
    expect([...times].some((node) => node.getAttribute('dateTime') === HIDDEN.createdAt)).toBe(
      true,
    );
    expect([...times].some((node) => node.getAttribute('dateTime') === HIDDEN.deletedAt)).toBe(
      true,
    );
  });

  it('shows an External badge for a hidden row from a Nostr author', async () => {
    listMock.mockResolvedValue([{ ...HIDDEN, via: 'nostr' }]);
    renderWithLocale(<HiddenNotesScreen />);
    expect(await screen.findByText('Bob')).toBeTruthy();
    expect(screen.getByText('External')).toBeTruthy();
  });

  it('shows an External badge for a hidden row with a non-nostr via value', async () => {
    listMock.mockResolvedValue([{ ...HIDDEN, via: 'something-else' }]);
    renderWithLocale(<HiddenNotesScreen />);
    expect(await screen.findByText('Bob')).toBeTruthy();
    expect(screen.getByText('External')).toBeTruthy();
  });

  it('falls back to Unnamed beside the External badge when a via row has no name', async () => {
    listMock.mockResolvedValue([{ ...HIDDEN, name: '', via: 'nostr' }]);
    renderWithLocale(<HiddenNotesScreen />);
    expect(await screen.findByText('Unnamed')).toBeTruthy();
    expect(screen.getByText('External')).toBeTruthy();
  });

  it('does not show an External badge for a hidden row without via', async () => {
    listMock.mockResolvedValue([HIDDEN]);
    renderWithLocale(<HiddenNotesScreen />);
    expect(await screen.findByText('Bob')).toBeTruthy();
    expect(screen.queryByText('External')).toBeNull();
  });

  it('renders hidden notes in API order without reordering', async () => {
    listMock.mockResolvedValue([OLDER, HIDDEN]);
    renderWithLocale(<HiddenNotesScreen />);
    expect(await screen.findByRole('list', { name: 'Hidden notes' })).toBeTruthy();
    const items = screen.getAllByRole('listitem');
    expect(items[0]?.textContent).toContain('Carol');
    expect(items[0]?.textContent).toContain('Older hide');
    expect(items[1]?.textContent).toContain('Bob');
  });

  it('falls back to Unnamed when the hider has no name and omits empty text', async () => {
    listMock.mockResolvedValue([UNNAMED]);
    renderWithLocale(<HiddenNotesScreen />);
    expect(await screen.findByText('Eve')).toBeTruthy();
    expect(screen.getByText('Hidden by Unnamed')).toBeTruthy();
    expect(screen.queryByText('Hidden note')).toBeNull();
  });

  it('falls back to Unnamed when the author name is empty', async () => {
    listMock.mockResolvedValue([
      { ...UNNAMED, name: '', deletedBy: { id: null, name: 'Ada', role: 'moderator' } },
    ]);
    renderWithLocale(<HiddenNotesScreen />);
    expect(await screen.findByText('Unnamed')).toBeTruthy();
    expect(screen.getByText('Hidden by Ada')).toBeTruthy();
  });

  it('fetches for a founder account', async () => {
    useAuthStore.setState({ session: 'sess', account: { ...account, role: 'founder' } });
    listMock.mockResolvedValue([HIDDEN]);
    renderWithLocale(<HiddenNotesScreen />);
    expect(await screen.findByText('Hidden note')).toBeTruthy();
    expect(listMock).toHaveBeenCalledWith('sess');
  });

  it('ignores a stale list resolve after unmount', async () => {
    let resolveList: ((value: HiddenMessage[]) => void) | undefined;
    listMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveList = resolve;
        }),
    );
    const view = renderWithLocale(<HiddenNotesScreen />);
    view.unmount();
    await act(async () => {
      resolveList?.([HIDDEN]);
      await Promise.resolve();
    });
    expect(screen.queryByText('Hidden note')).toBeNull();
  });

  it('ignores a stale list reject after unmount', async () => {
    let rejectList: ((reason: Error) => void) | undefined;
    listMock.mockImplementation(
      () =>
        new Promise((_, reject) => {
          rejectList = reject;
        }),
    );
    const view = renderWithLocale(<HiddenNotesScreen />);
    view.unmount();
    await act(async () => {
      rejectList?.(new Error('boom'));
      await Promise.resolve();
    });
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('does not apply a late resolve after the session is cleared', async () => {
    let resolveList: ((value: HiddenMessage[]) => void) | undefined;
    listMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveList = resolve;
        }),
    );
    renderWithLocale(<HiddenNotesScreen />);
    expect(screen.getByText('Loading…')).toBeTruthy();
    useAuthStore.setState({ session: null, account: null });
    await waitFor(() => {
      expect(screen.queryByText('Loading…')).toBeNull();
    });
    await act(async () => {
      resolveList?.([HIDDEN]);
      await Promise.resolve();
    });
    expect(screen.queryByText('Hidden note')).toBeNull();
  });
});
