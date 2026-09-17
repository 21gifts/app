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
vi.mock('@/lib/app-badge', () => ({
  setUnreadAppBadge: vi.fn(),
  bumpUnreadAppBadgeEpoch: vi.fn(),
}));

import { fetchNotifications, markAllNotificationsRead, markNotificationRead } from '@/lib/api';
import { bumpUnreadAppBadgeEpoch, setUnreadAppBadge } from '@/lib/app-badge';

const listMock = vi.mocked(fetchNotifications);
const markReadMock = vi.mocked(markNotificationRead);
const markAllMock = vi.mocked(markAllNotificationsRead);
const setBadgeMock = vi.mocked(setUnreadAppBadge);

const account: Account = {
  id: 'acc_1',
  linkingKey: '02abcdef',
  role: 'basis',
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

const APPOINTED: Notification = {
  id: 'n-mod',
  type: 'moderator_appointed',
  parentId: 'acc-subject',
  replyId: 'acc-subject',
  name: 'Cyrill',
  text: '',
  createdAt: '2026-08-22T12:00:00.000Z',
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
    expect(setBadgeMock).not.toHaveBeenCalled();
  });

  it('loads the notification list', async () => {
    listMock.mockResolvedValue(LIST);
    renderWithLocale(<NotificationsLoader />);
    expect(await screen.findByText('Bob replied')).toBeTruthy();
    await waitFor(() => {
      expect(markAllMock).toHaveBeenCalledWith('sess');
    });
    expect(setBadgeMock).toHaveBeenCalledWith(0);
    expect(vi.mocked(bumpUnreadAppBadgeEpoch)).toHaveBeenCalled();
  });

  it('clears the badge again after mark-all-read resolves', async () => {
    let resolveAll!: () => void;
    markAllMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveAll = () => {
            resolve(undefined);
          };
        }),
    );
    listMock.mockResolvedValue(LIST);
    renderWithLocale(<NotificationsLoader />);
    expect(await screen.findByText('Bob replied')).toBeTruthy();
    await waitFor(() => {
      expect(setBadgeMock).toHaveBeenCalledWith(0);
    });
    const bumps = vi.mocked(bumpUnreadAppBadgeEpoch).mock.calls.length;
    await act(async () => {
      resolveAll();
    });
    await waitFor(() => {
      expect(vi.mocked(bumpUnreadAppBadgeEpoch).mock.calls.length).toBeGreaterThan(bumps);
    });
  });

  it('still clears the badge after unmount when the session is unchanged', async () => {
    let resolveAll!: () => void;
    markAllMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveAll = () => {
            resolve(undefined);
          };
        }),
    );
    listMock.mockResolvedValue(LIST);
    const { unmount } = renderWithLocale(<NotificationsLoader />);
    expect(await screen.findByText('Bob replied')).toBeTruthy();
    const bumps = vi.mocked(bumpUnreadAppBadgeEpoch).mock.calls.length;
    unmount();
    await act(async () => {
      resolveAll();
    });
    expect(vi.mocked(bumpUnreadAppBadgeEpoch).mock.calls.length).toBeGreaterThan(bumps);
    expect(setBadgeMock).toHaveBeenCalledWith(0);
  });

  it('does not apply the second badge clear after logout', async () => {
    let resolveAll!: () => void;
    markAllMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveAll = () => {
            resolve(undefined);
          };
        }),
    );
    listMock.mockResolvedValue(LIST);
    renderWithLocale(<NotificationsLoader />);
    expect(await screen.findByText('Bob replied')).toBeTruthy();
    const bumps = vi.mocked(bumpUnreadAppBadgeEpoch).mock.calls.length;
    useAuthStore.setState({ session: null, account: null });
    await act(async () => {
      resolveAll();
    });
    expect(vi.mocked(bumpUnreadAppBadgeEpoch).mock.calls.length).toBe(bumps);
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
    expect(setBadgeMock).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('Bob replied')).toBeTruthy();
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
    expect(setBadgeMock).not.toHaveBeenCalled();
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
    expect(await screen.findByText('Bob replied')).toBeTruthy();
    await waitFor(() => {
      expect(markAllMock).toHaveBeenCalledWith('sess');
    });
  });

  it('opens a row even when markNotificationRead fails', async () => {
    listMock.mockResolvedValue(LIST);
    markReadMock.mockRejectedValue(new Error('boom'));
    renderWithLocale(<NotificationsLoader />);
    expect(await screen.findByText('Bob replied')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Bob replied/ }));
    expect(markReadMock).toHaveBeenCalledWith('sess', 'n1');
    expect(push).toHaveBeenCalledWith('/messages/parent-1');
  });

  it('opens a moderator appointment row on /welcome after mark-read resolves', async () => {
    let resolveRead!: (value: Notification) => void;
    markReadMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveRead = resolve;
        }),
    );
    listMock.mockResolvedValue({ notifications: [APPOINTED], unreadCount: 1 });
    renderWithLocale(<NotificationsLoader />);
    expect(await screen.findByRole('button', { name: /You are a moderator/ })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /You are a moderator/ }));
    expect(markReadMock).toHaveBeenCalledWith('sess', 'n-mod');
    expect(push).not.toHaveBeenCalled();
    await act(async () => {
      resolveRead({ ...APPOINTED, readAt: '2026-08-28T13:00:00.000Z' });
    });
    await waitFor(() => {
      expect(push).toHaveBeenCalledWith('/welcome');
    });
  });

  it('still opens /welcome when appointment mark-read fails', async () => {
    listMock.mockResolvedValue({ notifications: [APPOINTED], unreadCount: 1 });
    markReadMock.mockRejectedValue(new Error('boom'));
    renderWithLocale(<NotificationsLoader />);
    expect(await screen.findByRole('button', { name: /You are a moderator/ })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /You are a moderator/ }));
    await waitFor(() => {
      expect(push).toHaveBeenCalledWith('/welcome');
    });
  });

  it('does not open /welcome if the session changes during appointment mark-read', async () => {
    let resolveRead!: (value: Notification) => void;
    markReadMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveRead = resolve;
        }),
    );
    listMock.mockResolvedValue({ notifications: [APPOINTED], unreadCount: 1 });
    renderWithLocale(<NotificationsLoader />);
    expect(await screen.findByRole('button', { name: /You are a moderator/ })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /You are a moderator/ }));
    useAuthStore.setState({ session: null, account: null });
    await act(async () => {
      resolveRead({ ...APPOINTED, readAt: '2026-08-28T13:00:00.000Z' });
    });
    expect(push).not.toHaveBeenCalled();
  });

  it('does not open /welcome if the session changes after appointment mark-read fails', async () => {
    let rejectRead!: (reason: Error) => void;
    markReadMock.mockImplementation(
      () =>
        new Promise((_, reject) => {
          rejectRead = reject;
        }),
    );
    listMock.mockResolvedValue({ notifications: [APPOINTED], unreadCount: 1 });
    renderWithLocale(<NotificationsLoader />);
    expect(await screen.findByRole('button', { name: /You are a moderator/ })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /You are a moderator/ }));
    useAuthStore.setState({ session: null, account: null });
    await act(async () => {
      rejectRead(new Error('boom'));
    });
    expect(push).not.toHaveBeenCalled();
  });
});
