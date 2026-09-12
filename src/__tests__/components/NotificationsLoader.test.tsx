import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NotificationsLoader } from '@/components/NotificationsLoader';
import type { Account, Notification, NotificationList } from '@/lib/api-types';
import { useAuthStore } from '@/stores/auth-store';
import { renderWithLocale } from '@/__tests__/render-with-locale';

const push = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: (): { push: typeof push } => ({ push }),
}));

vi.mock('@/lib/api', () => ({
  fetchNotifications: vi.fn(),
  markNotificationRead: vi.fn(),
  markAllNotificationsRead: vi.fn(),
}));

import { fetchNotifications, markAllNotificationsRead, markNotificationRead } from '@/lib/api';

const listMock = vi.mocked(fetchNotifications);
const markReadMock = vi.mocked(markNotificationRead);
const markAllMock = vi.mocked(markAllNotificationsRead);

const account: Account = {
  id: 'acc_1',
  linkingKey: '02abcdef',
  role: 'basis',
  name: 'Ada',
  lightningAddress: 'alice@walletofsatoshi.com',
  lightningAddressVerified: false,
  forumLawsDismissed: false,
  createdAt: 1_700_000_000,
  rulesAgreedAt: 1_700_000_001,
  viewKey: 'a'.repeat(64),
  setup: null,
  missing: [],
};

const ROW: Notification = {
  id: 'n1',
  type: 'forum_reply',
  parentId: 'parent-1',
  replyId: 'reply-1',
  name: 'Bob',
  text: 'Nice post',
  createdAt: '2026-08-28T12:00:00.000Z',
  readAt: null,
};

const LIST: NotificationList = { notifications: [ROW], unreadCount: 1 };

beforeEach(() => {
  vi.clearAllMocks();
  push.mockReset();
  markAllMock.mockResolvedValue(undefined);
  markReadMock.mockResolvedValue({ ...ROW, readAt: '2026-08-28T13:00:00.000Z' });
  useAuthStore.setState({ session: 'sess', account });
});

afterEach(cleanup);

describe('NotificationsLoader', () => {
  it('renders nothing when there is no session', () => {
    useAuthStore.setState({ session: null, account });
    const { container } = renderWithLocale(<NotificationsLoader />);
    expect(container.firstChild).toBeNull();
  });

  it('loads the notification list', async () => {
    listMock.mockResolvedValue(LIST);
    renderWithLocale(<NotificationsLoader />);
    expect(await screen.findByText('Bob replied to your post')).toBeTruthy();
    await waitFor(() => {
      expect(markAllMock).toHaveBeenCalledWith('sess');
    });
  });

  it('shows empty copy', async () => {
    listMock.mockResolvedValue({ notifications: [], unreadCount: 0 });
    renderWithLocale(<NotificationsLoader />);
    expect(await screen.findByText('No notifications yet.')).toBeTruthy();
    await waitFor(() => {
      expect(markAllMock).toHaveBeenCalledWith('sess');
    });
  });

  it('shows a list error and retries', async () => {
    listMock.mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce(LIST);
    renderWithLocale(<NotificationsLoader />);
    expect(await screen.findByRole('button', { name: 'Try again' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('Bob replied to your post')).toBeTruthy();
  });

  it('ignores a stale list resolve after unmount', async () => {
    let resolveList: ((value: NotificationList) => void) | undefined;
    listMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveList = resolve;
        }),
    );
    const view = renderWithLocale(<NotificationsLoader />);
    view.unmount();
    await act(async () => {
      resolveList?.(LIST);
      await Promise.resolve();
    });
    expect(listMock).toHaveBeenCalled();
    expect(markAllMock).not.toHaveBeenCalled();
  });

  it('ignores a stale list rejection after unmount', async () => {
    let rejectList: ((reason: Error) => void) | undefined;
    listMock.mockImplementation(
      () =>
        new Promise((_, reject) => {
          rejectList = reject;
        }),
    );
    const view = renderWithLocale(<NotificationsLoader />);
    view.unmount();
    await act(async () => {
      rejectList?.(new Error('gone'));
      await Promise.resolve();
    });
    expect(listMock).toHaveBeenCalled();
  });

  it('keeps the list when markAllNotificationsRead rejects', async () => {
    listMock.mockResolvedValue(LIST);
    markAllMock.mockRejectedValue(new Error('boom'));
    renderWithLocale(<NotificationsLoader />);
    expect(await screen.findByText('Bob replied to your post')).toBeTruthy();
    await waitFor(() => {
      expect(markAllMock).toHaveBeenCalledWith('sess');
    });
  });

  it('opens a row even when markNotificationRead fails', async () => {
    listMock.mockResolvedValue(LIST);
    markReadMock.mockRejectedValue(new Error('boom'));
    renderWithLocale(<NotificationsLoader />);
    expect(await screen.findByText('Bob replied to your post')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Bob replied to your post/ }));
    expect(markReadMock).toHaveBeenCalledWith('sess', 'n1');
    expect(push).toHaveBeenCalledWith('/messages/parent-1');
  });
});
