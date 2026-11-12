import { cleanup, fireEvent, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('@/components/NoteTranslate', () => ({
  NoteTranslate: () => <button type="button">Translate</button>,
}));
import { NotificationsScreen } from '@/components/NotificationsScreen';
import { notificationSchema, type Notification } from '@/lib/api-types';
import { renderWithLocale } from '@/__tests__/render-with-locale';

afterEach(cleanup);

const UNREAD: Notification = {
  id: 'n1',
  type: 'forum_reply',
  parentId: 'parent-1',
  replyId: 'reply-1',
  name: 'Bob',
  text: 'Nice post',
  createdAt: '2026-08-28T12:00:00.000Z',
  readAt: null,
  personal: true,
};

const READ: Notification = {
  id: 'n2',
  type: 'forum_reply',
  parentId: 'parent-2',
  replyId: 'reply-2',
  name: 'Carol',
  text: 'Thanks',
  createdAt: '2026-08-27T12:00:00.000Z',
  readAt: '2026-08-28T08:00:00.000Z',
  personal: true,
};

const PHOTO: Notification = {
  id: 'n3',
  type: 'forum_reply',
  parentId: 'parent-3',
  replyId: 'reply-3',
  name: 'Dan',
  text: '',
  createdAt: '2026-08-26T12:00:00.000Z',
  readAt: null,
  personal: true,
};

const POST: Notification = {
  id: 'n4',
  type: 'forum_post',
  parentId: 'parent-4',
  replyId: 'parent-4',
  name: 'Eve',
  text: 'Hello living room',
  createdAt: '2026-08-25T12:00:00.000Z',
  readAt: null,
  personal: false,
};

const POST_PHOTO: Notification = {
  id: 'n5',
  type: 'forum_post',
  parentId: 'parent-5',
  replyId: 'parent-5',
  name: 'Ivy',
  text: '',
  createdAt: '2026-08-24T12:00:00.000Z',
  readAt: null,
  personal: false,
};

const ZAP: Notification = {
  id: 'n6',
  type: 'zap',
  parentId: 'parent-6',
  replyId: 'zap-6',
  name: 'Frank',
  text: '21',
  createdAt: '2026-08-23T12:00:00.000Z',
  readAt: null,
  personal: true,
};

const HEART: Notification = {
  id: 'n-heart',
  type: 'heart',
  parentId: 'parent-heart',
  replyId: 'heart-1',
  name: 'Ivy',
  text: '1',
  createdAt: '2026-08-23T11:00:00.000Z',
  readAt: null,
  personal: true,
};

const ZAP_EMPTY: Notification = {
  id: 'n7',
  type: 'zap',
  parentId: 'parent-7',
  replyId: 'zap-7',
  name: 'Gina',
  text: '',
  createdAt: '2026-08-22T12:00:00.000Z',
  readAt: null,
  personal: true,
};

const APPOINTED: Notification = {
  id: 'n8',
  type: 'moderator_appointed',
  parentId: 'acc-subject',
  replyId: 'acc-subject',
  name: 'Cyrill',
  text: '',
  createdAt: '2026-08-22T12:00:00.000Z',
  readAt: null,
  personal: true,
};
const APPOINTED_TEXT: Notification = { ...APPOINTED, id: 'n9', text: 'You are a moderator' };

const PROPOSAL_ROW: Notification = {
  id: 'n10',
  type: 'moderator_proposal',
  parentId: 'acc-rose',
  replyId: 'acc-rose',
  name: 'Bob',
  text: '',
  createdAt: '2026-08-22T12:00:00.000Z',
  readAt: null,
  personal: true,
};
const PROPOSAL_TEXT: Notification = { ...PROPOSAL_ROW, id: 'n11', text: 'Rose' };

const MENTION: Notification = {
  id: 'n12',
  type: 'forum_mention',
  parentId: 'parent-12',
  replyId: 'reply-12',
  name: 'Ada',
  text: 'hello @you',
  createdAt: '2026-08-22T12:00:00.000Z',
  readAt: null,
  personal: true,
};

describe('NotificationsScreen', () => {
  it('shows original German post and reply text without translate controls', () => {
    const german = 'Kann mir jemand diese Woche ein paar Satoshi leihen?';
    renderWithLocale(
      <NotificationsScreen
        notifications={[
          { ...POST, personal: true, text: german },
          { ...UNREAD, text: german },
        ]}
        error={false}
        loading={false}
        onRetry={() => undefined}
        onOpen={() => undefined}
      />,
    );
    expect(screen.getAllByText(german)).toHaveLength(2);
    expect(screen.queryByRole('button', { name: 'Translate' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Show original' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Show translation' })).toBeNull();
  });

  it('shows loading heading and copy', () => {
    renderWithLocale(
      <NotificationsScreen
        notifications={null}
        error={false}
        loading={true}
        onRetry={() => undefined}
        onOpen={() => undefined}
      />,
    );
    expect(screen.getByRole('heading', { name: 'Notifications' })).toBeTruthy();
    expect(screen.getByText('Loading…')).toBeTruthy();
  });

  it.each([
    ['loading', null, false, true],
    ['error', null, true, false],
    ['empty', [], false, false],
    ['listing', [UNREAD, READ], false, false],
  ] as const)(
    'links Notification settings to the Settings notifications section while %s',
    (_label, notifications, error, loading) => {
      renderWithLocale(
        <NotificationsScreen
          notifications={notifications === null ? null : [...notifications]}
          error={error}
          loading={loading}
          onRetry={() => undefined}
          onOpen={() => undefined}
        />,
      );
      expect(screen.getByRole('link', { name: 'Notification settings' }).getAttribute('href')).toBe(
        '/settings#notifications',
      );
    },
  );

  it('shows an error and retries', () => {
    const onRetry = vi.fn();
    renderWithLocale(
      <NotificationsScreen
        notifications={null}
        error={true}
        loading={false}
        onRetry={onRetry}
        onOpen={() => undefined}
      />,
    );
    const alert = screen.getByRole('alert');
    expect(alert.textContent).toBe('Could not load notifications. Please try again.');
    expect(alert.className).toContain('text-app-danger');
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('shows empty copy', () => {
    renderWithLocale(
      <NotificationsScreen
        notifications={[]}
        error={false}
        loading={false}
        onRetry={() => undefined}
        onOpen={() => undefined}
      />,
    );
    expect(screen.getByText('Nothing for you yet.')).toBeTruthy();
  });

  it('shows empty copy when the list is missing after load', () => {
    renderWithLocale(
      <NotificationsScreen
        notifications={null}
        error={false}
        loading={false}
        onRetry={() => undefined}
        onOpen={() => undefined}
      />,
    );
    expect(screen.getByText('Nothing for you yet.')).toBeTruthy();
  });

  it('lists rows with an accessible name and unread vs read classes', () => {
    const onOpen = vi.fn();
    renderWithLocale(
      <NotificationsScreen
        notifications={[UNREAD, READ]}
        error={false}
        loading={false}
        onRetry={() => undefined}
        onOpen={onOpen}
      />,
    );
    expect(screen.getByRole('list', { name: 'Unread notifications' })).toBeTruthy();
    expect(screen.getByRole('list', { name: 'Already seen notifications' })).toBeTruthy();
    const unread = screen.getByRole('button', { name: /Bob replied/ });
    const read = screen.getByRole('button', { name: /Carol replied/ });
    expect(unread.textContent).toContain('Nice post');
    expect(read.textContent).toContain('Thanks');
    expect(unread.querySelector('.font-semibold')).toBeTruthy();
    expect(read.querySelector('.text-app-muted')).toBeTruthy();
    expect(read.querySelector('.font-semibold')).toBeNull();
    fireEvent.click(unread);
    expect(onOpen).toHaveBeenCalledWith(UNREAD);
  });

  it('renders unread rows above already-seen rows even when read rows come first', () => {
    renderWithLocale(
      <NotificationsScreen
        notifications={[READ, UNREAD]}
        error={false}
        loading={false}
        onRetry={() => undefined}
        onOpen={() => undefined}
      />,
    );
    const unreadHeading = screen.getByRole('heading', { name: 'Unread' });
    const seenHeading = screen.getByRole('heading', { name: 'Already seen' });
    expect(
      unreadHeading.compareDocumentPosition(seenHeading) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    const unreadButton = screen.getByRole('button', { name: /Bob replied/ });
    const seenButton = screen.getByRole('button', { name: /Carol replied/ });
    expect(
      unreadButton.compareDocumentPosition(seenButton) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it('omits the already-seen heading when every row is unread', () => {
    renderWithLocale(
      <NotificationsScreen
        notifications={[UNREAD]}
        error={false}
        loading={false}
        onRetry={() => undefined}
        onOpen={() => undefined}
      />,
    );
    expect(screen.queryByRole('heading', { name: 'Already seen' })).toBeNull();
  });

  it('omits the unread heading when every row is already seen', () => {
    renderWithLocale(
      <NotificationsScreen
        notifications={[READ]}
        error={false}
        loading={false}
        onRetry={() => undefined}
        onOpen={() => undefined}
      />,
    );
    expect(screen.queryByRole('heading', { name: 'Unread' })).toBeNull();
  });

  it('omits section headings when the list is empty', () => {
    renderWithLocale(
      <NotificationsScreen
        notifications={[]}
        error={false}
        loading={false}
        onRetry={() => undefined}
        onOpen={() => undefined}
      />,
    );
    expect(screen.getByText('Nothing for you yet.')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Notifications' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Unread' })).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Already seen' })).toBeNull();
  });

  it('falls back to photo-only copy when a reply has empty text', () => {
    const onOpen = vi.fn();
    renderWithLocale(
      <NotificationsScreen
        notifications={[PHOTO]}
        error={false}
        loading={false}
        onRetry={() => undefined}
        onOpen={onOpen}
      />,
    );
    expect(screen.getByText('Photo reaction')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Dan replied/ }));
    expect(onOpen).toHaveBeenCalledWith(PHOTO);
  });

  it('falls back to photo-only copy when a post has empty text', () => {
    const onOpen = vi.fn();
    renderWithLocale(
      <NotificationsScreen
        notifications={[POST_PHOTO]}
        error={false}
        loading={false}
        onRetry={() => undefined}
        onOpen={onOpen}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /^Living room/ }));
    expect(screen.getByText('Photo')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Ivy posted/ }));
    expect(onOpen).toHaveBeenCalledWith(POST_PHOTO);
  });

  it('lists a living-room post with its body and opens parentId', () => {
    const onOpen = vi.fn();
    renderWithLocale(
      <NotificationsScreen
        notifications={[POST]}
        error={false}
        loading={false}
        onRetry={() => undefined}
        onOpen={onOpen}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /^Living room/ }));
    const row = screen.getByRole('button', { name: /Eve posted/ });
    expect(row.textContent).toContain('Hello living room');
    fireEvent.click(row);
    expect(onOpen).toHaveBeenCalledWith(POST);
  });

  it('omits the body when a post notification repeats the author name', () => {
    const onOpen = vi.fn();
    const nameOnly: Notification = {
      ...POST,
      id: 'n-name',
      name: 'Caren maralas Rundina',
      text: 'Caren maralas Rundina',
    };
    renderWithLocale(
      <NotificationsScreen
        notifications={[nameOnly]}
        error={false}
        loading={false}
        onRetry={() => undefined}
        onOpen={onOpen}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /^Living room/ }));
    const row = screen.getByRole('button', { name: /Caren maralas Rundina posted/ });
    expect(screen.getByText('Caren maralas Rundina posted')).toBeTruthy();
    expect(screen.queryByText('Caren maralas Rundina')).toBeNull();
    expect(screen.queryByText('Photo')).toBeNull();
    fireEvent.click(row);
    expect(onOpen).toHaveBeenCalledWith(nameOnly);
  });

  it('lists a zap with the stored sat amount and opens parentId', () => {
    const onOpen = vi.fn();
    renderWithLocale(
      <NotificationsScreen
        notifications={[ZAP]}
        error={false}
        loading={false}
        onRetry={() => undefined}
        onOpen={onOpen}
      />,
    );
    const row = screen.getByRole('button', { name: /Frank sent bitcoin/ });
    expect(row.textContent).toContain('21');
    fireEvent.click(row);
    expect(onOpen).toHaveBeenCalledWith(ZAP);
  });

  it('lists a heart by title and does not show the raw text 1', () => {
    renderWithLocale(
      <NotificationsScreen
        notifications={[HEART]}
        error={false}
        loading={false}
        onRetry={() => undefined}
        onOpen={() => undefined}
      />,
    );
    const row = screen.getByRole('button', { name: /Ivy sent you a heart/ });
    expect(within(row).queryByText('1')).toBeNull();
  });

  it('omits extra body copy when a zap has empty text', () => {
    renderWithLocale(
      <NotificationsScreen
        notifications={[ZAP_EMPTY]}
        error={false}
        loading={false}
        onRetry={() => undefined}
        onOpen={() => undefined}
      />,
    );
    expect(screen.getByRole('button', { name: /Gina sent bitcoin/ })).toBeTruthy();
    expect(screen.queryByText('Photo reaction')).toBeNull();
    expect(screen.queryByText('Photo')).toBeNull();
  });

  it('lists a moderator appointment by title only when text is empty', () => {
    const onOpen = vi.fn();
    renderWithLocale(
      <NotificationsScreen
        notifications={[APPOINTED]}
        error={false}
        loading={false}
        onRetry={() => undefined}
        onOpen={onOpen}
      />,
    );
    const row = screen.getByRole('button', { name: /You are a moderator/ });
    expect(row.textContent).not.toContain('Photo reply');
    expect(row.textContent).not.toContain('Photo');
    expect(screen.queryByText('Photo reply')).toBeNull();
    expect(screen.queryByText('Photo')).toBeNull();
    fireEvent.click(row);
    expect(onOpen).toHaveBeenCalledWith(APPOINTED);
  });

  it('lists a moderator appointment body when text is present', () => {
    const onOpen = vi.fn();
    renderWithLocale(
      <NotificationsScreen
        notifications={[APPOINTED_TEXT]}
        error={false}
        loading={false}
        onRetry={() => undefined}
        onOpen={onOpen}
      />,
    );
    const row = screen.getByRole('button', { name: /You are a moderator/ });
    expect(row.textContent).toContain('You are a moderator');
    fireEvent.click(row);
    expect(onOpen).toHaveBeenCalledWith(APPOINTED_TEXT);
  });

  it('lists a moderator proposal by title only when text is empty', () => {
    const onOpen = vi.fn();
    renderWithLocale(
      <NotificationsScreen
        notifications={[PROPOSAL_ROW]}
        error={false}
        loading={false}
        onRetry={() => undefined}
        onOpen={onOpen}
      />,
    );
    const row = screen.getByRole('button', { name: /Bob proposed a moderator/ });
    expect(row.textContent).not.toContain('Photo reaction');
    expect(row.textContent).not.toContain('Photo');
    expect(screen.queryByText('Photo reaction')).toBeNull();
    expect(screen.queryByText('Photo')).toBeNull();
    fireEvent.click(row);
    expect(onOpen).toHaveBeenCalledWith(PROPOSAL_ROW);
  });

  it('lists a moderator proposal body when text is present', () => {
    const onOpen = vi.fn();
    renderWithLocale(
      <NotificationsScreen
        notifications={[PROPOSAL_TEXT]}
        error={false}
        loading={false}
        onRetry={() => undefined}
        onOpen={onOpen}
      />,
    );
    const row = screen.getByRole('button', { name: /Bob proposed a moderator/ });
    expect(row.textContent).toContain('Rose');
    fireEvent.click(row);
    expect(onOpen).toHaveBeenCalledWith(PROPOSAL_TEXT);
  });

  it('titles a mark with the actor and keeps the post text', () => {
    renderWithLocale(
      <NotificationsScreen
        notifications={[MENTION]}
        error={false}
        loading={false}
        onRetry={() => undefined}
        onOpen={() => undefined}
      />,
    );
    const row = screen.getByRole('button', { name: /Ada marked you/ });
    expect(row.textContent).toContain('hello @you');
  });

  describe('views', () => {
    const OTHER_UNREAD: Notification = { ...POST, id: 'o1', name: 'Olga', text: 'Morning' };
    const OTHER_UNREAD_2: Notification = { ...POST, id: 'o2', name: 'Otto', text: 'Evening' };
    const OTHER_SEEN: Notification = {
      ...POST,
      id: 'o3',
      name: 'Oskar',
      text: 'Noon',
      readAt: '2026-08-28T08:00:00.000Z',
    };

    function renderRows(rows: Notification[]): void {
      renderWithLocale(
        <NotificationsScreen
          notifications={rows}
          error={false}
          loading={false}
          onRetry={() => undefined}
          onOpen={() => undefined}
        />,
      );
    }

    it('selects For you on load and lists only personal rows there', () => {
      renderRows([OTHER_UNREAD, UNREAD, READ, OTHER_SEEN]);
      const group = screen.getByRole('group', { name: 'Notification view' });
      const forYou = screen.getByRole('button', { name: 'For you, 1 unread' });
      const livingRoom = screen.getByRole('button', { name: 'Living room, 1 unread' });
      expect(group.contains(forYou)).toBe(true);
      expect(group.contains(livingRoom)).toBe(true);
      expect(forYou.getAttribute('aria-pressed')).toBe('true');
      expect(livingRoom.getAttribute('aria-pressed')).toBe('false');
      expect(screen.getByRole('button', { name: /Bob replied/ })).toBeTruthy();
      expect(screen.getByRole('button', { name: /Carol replied/ })).toBeTruthy();
      expect(screen.queryByRole('button', { name: /Olga posted/ })).toBeNull();
      expect(screen.queryByRole('button', { name: /Oskar posted/ })).toBeNull();
    });

    it('shows the other rows under Living room, unread above seen in API order', () => {
      renderRows([OTHER_SEEN, UNREAD, OTHER_UNREAD, OTHER_UNREAD_2]);
      fireEvent.click(screen.getByRole('button', { name: 'Living room, 2 unread' }));
      expect(
        screen.getByRole('button', { name: 'Living room, 2 unread' }).getAttribute('aria-pressed'),
      ).toBe('true');
      expect(screen.queryByRole('button', { name: /Bob replied/ })).toBeNull();
      const unreadList = screen.getByRole('list', { name: 'Unread notifications' });
      const seenList = screen.getByRole('list', { name: 'Already seen notifications' });
      expect(Array.from(unreadList.querySelectorAll('button')).map((b) => b.textContent)).toEqual([
        expect.stringContaining('Olga posted'),
        expect.stringContaining('Otto posted'),
      ]);
      expect(seenList.textContent).toContain('Oskar posted');
      expect(unreadList.compareDocumentPosition(seenList) & Node.DOCUMENT_POSITION_FOLLOWING).toBe(
        Node.DOCUMENT_POSITION_FOLLOWING,
      );
      fireEvent.click(screen.getByRole('button', { name: 'For you, 1 unread' }));
      expect(screen.getByRole('button', { name: /Bob replied/ })).toBeTruthy();
      expect(screen.queryByRole('button', { name: /Olga posted/ })).toBeNull();
    });

    it('shows each unread count as a chip and drops it at zero', () => {
      renderRows([UNREAD, PHOTO, READ, OTHER_SEEN]);
      const forYou = screen.getByRole('button', { name: 'For you, 2 unread' });
      expect(forYou.textContent).toBe('For you2');
      const livingRoom = screen.getByRole('button', { name: 'Living room' });
      expect(livingRoom.getAttribute('aria-label')).toBeNull();
      expect(livingRoom.textContent).toBe('Living room');
    });

    it('shows the For you empty text when only living-room rows exist', () => {
      renderRows([OTHER_UNREAD]);
      expect(screen.getByText('Nothing for you yet.')).toBeTruthy();
      expect(screen.queryByRole('heading', { name: 'Unread' })).toBeNull();
      fireEvent.click(screen.getByRole('button', { name: 'Living room, 1 unread' }));
      expect(screen.queryByText('Nothing for you yet.')).toBeNull();
      expect(screen.getByRole('button', { name: /Olga posted/ })).toBeTruthy();
    });

    it('shows the Living room empty text when only personal rows exist', () => {
      renderRows([UNREAD]);
      fireEvent.click(screen.getByRole('button', { name: 'Living room' }));
      expect(screen.getByText('Nothing from the living room yet.')).toBeTruthy();
      expect(screen.queryByText('Nothing for you yet.')).toBeNull();
      expect(screen.queryByRole('button', { name: /Bob replied/ })).toBeNull();
    });

    it('puts a row whose api body has no personal field under Living room', () => {
      const parsed = notificationSchema.parse({
        id: 'legacy',
        type: 'forum_reply',
        parentId: 'parent-l',
        replyId: 'reply-l',
        name: 'Lena',
        text: 'Old api',
        createdAt: '2026-08-28T12:00:00.000Z',
        readAt: null,
      });
      expect(parsed.personal).toBe(false);
      renderRows([parsed]);
      expect(screen.getByText('Nothing for you yet.')).toBeTruthy();
      fireEvent.click(screen.getByRole('button', { name: 'Living room, 1 unread' }));
      expect(screen.getByRole('button', { name: /Lena replied/ })).toBeTruthy();
    });

    it('shows no view control while loading or after an error', () => {
      renderWithLocale(
        <NotificationsScreen
          notifications={null}
          error={false}
          loading={true}
          onRetry={() => undefined}
          onOpen={() => undefined}
        />,
      );
      expect(screen.queryByRole('group', { name: 'Notification view' })).toBeNull();
      cleanup();
      renderWithLocale(
        <NotificationsScreen
          notifications={null}
          error={true}
          loading={false}
          onRetry={() => undefined}
          onOpen={() => undefined}
        />,
      );
      expect(screen.queryByRole('group', { name: 'Notification view' })).toBeNull();
    });

    it('keeps the selected view when the list reloads', () => {
      const { rerender } = renderWithLocale(
        <NotificationsScreen
          notifications={[UNREAD, OTHER_UNREAD]}
          error={false}
          loading={false}
          onRetry={() => undefined}
          onOpen={() => undefined}
        />,
      );
      fireEvent.click(screen.getByRole('button', { name: 'Living room, 1 unread' }));
      rerender(
        <NotificationsScreen
          notifications={[UNREAD, OTHER_UNREAD, OTHER_UNREAD_2]}
          error={false}
          loading={false}
          onRetry={() => undefined}
          onOpen={() => undefined}
        />,
      );
      expect(
        screen.getByRole('button', { name: 'Living room, 2 unread' }).getAttribute('aria-pressed'),
      ).toBe('true');
      expect(screen.getByRole('button', { name: /Otto posted/ })).toBeTruthy();
    });
  });
});
