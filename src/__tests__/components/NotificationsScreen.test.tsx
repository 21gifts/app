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
    expect(screen.getByText('Could not load notifications. Please try again.')).toBeTruthy();
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
    const unread = screen.getByRole('button', { name: /Bob replied to your post/ });
    const read = screen.getByRole('button', { name: /Carol replied to your post/ });
    expect(unread.textContent).toContain('Nice post');
    expect(read.textContent).toContain('Thanks');
    expect(unread.querySelector('.font-semibold')).toBeTruthy();
    expect(read.querySelector('.text-app-muted')).toBeTruthy();
    expect(read.querySelector('.font-semibold')).toBeNull();
    fireEvent.click(unread);
    expect(onOpen).toHaveBeenCalledWith('parent-1', 'n1');
  });

  it('falls back to photo-only copy when text is empty', () => {
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
    expect(screen.getByText('Photo reply')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Dan replied to your post/ }));
    expect(onOpen).toHaveBeenCalledWith('parent-3', 'n3');
  });
});
