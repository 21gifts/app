import { cleanup, fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NotificationsScreen } from '@/components/NotificationsScreen';
import type { Notification } from '@/lib/api-types';
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
};
const APPOINTED_TEXT: Notification = { ...APPOINTED, id: 'n9', text: 'You are a moderator' };

describe('NotificationsScreen', () => {
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
    expect(screen.getByText('No notifications yet.')).toBeTruthy();
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
    expect(screen.getByText('No notifications yet.')).toBeTruthy();
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
    expect(screen.getByRole('list', { name: 'Notifications' })).toBeTruthy();
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
    const row = screen.getByRole('button', { name: /Eve posted/ });
    expect(row.textContent).toContain('Hello living room');
    fireEvent.click(row);
    expect(onOpen).toHaveBeenCalledWith(POST);
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
});
