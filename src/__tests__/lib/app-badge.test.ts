import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Account, Conversation } from '@/lib/api-types';

vi.mock('@/lib/api', () => ({
  fetchNotifications: vi.fn(),
  fetchConversations: vi.fn(),
  fetchModeratorGroup: vi.fn(),
}));

import { fetchConversations, fetchModeratorGroup, fetchNotifications } from '@/lib/api';
import {
  bumpUnreadAppBadgeEpoch,
  refreshUnreadAppBadge,
  setUnreadAppBadge,
  unreadAppBadgeEpoch,
} from '@/lib/app-badge';
import { useAuthStore } from '@/stores/auth-store';

const fetchNotificationsMock = vi.mocked(fetchNotifications);
const fetchConversationsMock = vi.mocked(fetchConversations);
const fetchModeratorGroupMock = vi.mocked(fetchModeratorGroup);

const UNREAD_ROW: Conversation = {
  id: 'c1',
  kind: 'member_member',
  name: 'Bob',
  lastText: 'Hi',
  lastAt: '2026-08-28T12:00:00.000Z',
  lastFromMe: false,
  lastSats: 0,
  unreadMessageCount: 0,
  unread: true,
};

const STAFF_ROOM: Conversation = {
  id: 'conv-mod',
  kind: 'moderator_group',
  name: 'Moderators',
  lastText: 'Hello mods',
  lastAt: '2026-08-28T15:00:00.000Z',
  lastFromMe: false,
  lastSats: 0,
  unreadMessageCount: 0,
  unread: true,
};

const ACCOUNT: Account = {
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

afterEach(() => {
  vi.unstubAllGlobals();
  Reflect.deleteProperty(navigator, 'setAppBadge');
  Reflect.deleteProperty(navigator, 'clearAppBadge');
});

describe('setUnreadAppBadge', () => {
  it('calls setAppBadge with n when n > 0', () => {
    const setAppBadge = vi.fn().mockResolvedValue(undefined);
    const clearAppBadge = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'setAppBadge', {
      configurable: true,
      value: setAppBadge,
    });
    Object.defineProperty(navigator, 'clearAppBadge', {
      configurable: true,
      value: clearAppBadge,
    });
    setUnreadAppBadge(3);
    expect(setAppBadge).toHaveBeenCalledWith(3);
    expect(clearAppBadge).not.toHaveBeenCalled();
  });

  it('calls clearAppBadge when count is 0', () => {
    const setAppBadge = vi.fn().mockResolvedValue(undefined);
    const clearAppBadge = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'setAppBadge', {
      configurable: true,
      value: setAppBadge,
    });
    Object.defineProperty(navigator, 'clearAppBadge', {
      configurable: true,
      value: clearAppBadge,
    });
    setUnreadAppBadge(0);
    expect(clearAppBadge).toHaveBeenCalledTimes(1);
    expect(setAppBadge).not.toHaveBeenCalled();
  });

  it('does not throw when both APIs are missing', () => {
    expect(() => {
      setUnreadAppBadge(5);
    }).not.toThrow();
    expect(() => {
      setUnreadAppBadge(0);
    }).not.toThrow();
  });

  it('swallows setAppBadge rejections', async () => {
    const setAppBadge = vi.fn().mockRejectedValue(new Error('denied'));
    Object.defineProperty(navigator, 'setAppBadge', {
      configurable: true,
      value: setAppBadge,
    });
    expect(() => {
      setUnreadAppBadge(2);
    }).not.toThrow();
    await Promise.resolve();
    expect(setAppBadge).toHaveBeenCalledWith(2);
  });

  it('swallows clearAppBadge rejections', async () => {
    const clearAppBadge = vi.fn().mockRejectedValue(new Error('denied'));
    Object.defineProperty(navigator, 'clearAppBadge', {
      configurable: true,
      value: clearAppBadge,
    });
    expect(() => {
      setUnreadAppBadge(0);
    }).not.toThrow();
    await Promise.resolve();
    expect(clearAppBadge).toHaveBeenCalledTimes(1);
  });

  it('falls through to clearAppBadge when count > 0 but setAppBadge is missing', () => {
    const clearAppBadge = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clearAppBadge', {
      configurable: true,
      value: clearAppBadge,
    });
    setUnreadAppBadge(4);
    expect(clearAppBadge).toHaveBeenCalledTimes(1);
  });

  it('is a no-op when count > 0 and only setAppBadge is missing', () => {
    expect(() => {
      setUnreadAppBadge(1);
    }).not.toThrow();
  });

  it('bumpUnreadAppBadgeEpoch increments unreadAppBadgeEpoch', () => {
    const before = unreadAppBadgeEpoch();
    expect(bumpUnreadAppBadgeEpoch()).toBe(before + 1);
    expect(unreadAppBadgeEpoch()).toBe(before + 1);
  });

  it('is a no-op when count is 0 and clearAppBadge is missing', () => {
    const setAppBadge = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'setAppBadge', {
      configurable: true,
      value: setAppBadge,
    });
    setUnreadAppBadge(0);
    expect(setAppBadge).not.toHaveBeenCalled();
  });
});

describe('refreshUnreadAppBadge', () => {
  const setAppBadge = vi.fn().mockResolvedValue(undefined);
  const clearAppBadge = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    window.localStorage.setItem('21gifts.session', 'tok');
    useAuthStore.setState({ account: null });
    setAppBadge.mockClear();
    clearAppBadge.mockClear();
    fetchNotificationsMock.mockReset();
    fetchConversationsMock.mockReset();
    fetchModeratorGroupMock.mockReset();
    fetchModeratorGroupMock.mockRejectedValue(new Error('no group'));
    Object.defineProperty(navigator, 'setAppBadge', {
      configurable: true,
      value: setAppBadge,
    });
    Object.defineProperty(navigator, 'clearAppBadge', {
      configurable: true,
      value: clearAppBadge,
    });
  });

  it('sets the badge to notification unread plus inbox unread plus staff-room unread', async () => {
    fetchNotificationsMock.mockResolvedValue({ notifications: [], unreadCount: 4 });
    fetchConversationsMock.mockResolvedValue([
      UNREAD_ROW,
      { ...UNREAD_ROW, id: 'c2', unread: false },
      { ...UNREAD_ROW, id: 'c3' },
    ]);
    await refreshUnreadAppBadge('tok');
    expect(setAppBadge).toHaveBeenCalledWith(6);
    expect(clearAppBadge).not.toHaveBeenCalled();
  });

  it('uses inboxUnreadOverride and skips fetchConversations', async () => {
    useAuthStore.setState({ account: { ...ACCOUNT, role: 'moderator' } });
    fetchNotificationsMock.mockResolvedValue({ notifications: [], unreadCount: 4 });
    await refreshUnreadAppBadge('tok', 2);
    expect(fetchConversationsMock).not.toHaveBeenCalled();
    expect(fetchModeratorGroupMock).toHaveBeenCalledWith('tok');
    expect(setAppBadge).toHaveBeenCalledWith(6);
  });

  it('skips the staff-room fetch for an account below moderator', async () => {
    useAuthStore.setState({ account: ACCOUNT });
    fetchNotificationsMock.mockResolvedValue({ notifications: [], unreadCount: 4 });
    fetchConversationsMock.mockResolvedValue([UNREAD_ROW]);
    fetchModeratorGroupMock.mockResolvedValue(STAFF_ROOM);
    await refreshUnreadAppBadge('tok');
    expect(fetchModeratorGroupMock).not.toHaveBeenCalled();
    expect(setAppBadge).toHaveBeenCalledWith(5);
  });

  it('uses moderationUnreadOverride and skips fetchModeratorGroup', async () => {
    fetchNotificationsMock.mockResolvedValue({ notifications: [], unreadCount: 4 });
    fetchConversationsMock.mockResolvedValue([]);
    await refreshUnreadAppBadge('tok', undefined, 1);
    expect(fetchModeratorGroupMock).not.toHaveBeenCalled();
    expect(setAppBadge).toHaveBeenCalledWith(5);
  });

  it('adds staff-room unread when the group is unread', async () => {
    useAuthStore.setState({ account: { ...ACCOUNT, role: 'moderator' } });
    fetchNotificationsMock.mockResolvedValue({ notifications: [], unreadCount: 4 });
    fetchConversationsMock.mockResolvedValue([UNREAD_ROW]);
    fetchModeratorGroupMock.mockResolvedValue(STAFF_ROOM);
    await refreshUnreadAppBadge('tok');
    expect(setAppBadge).toHaveBeenCalledWith(6);
  });

  it('treats a read staff room as 0', async () => {
    useAuthStore.setState({ account: { ...ACCOUNT, role: 'moderator' } });
    fetchNotificationsMock.mockResolvedValue({ notifications: [], unreadCount: 4 });
    fetchConversationsMock.mockResolvedValue([]);
    fetchModeratorGroupMock.mockResolvedValue({ ...STAFF_ROOM, unread: false });
    await refreshUnreadAppBadge('tok');
    expect(setAppBadge).toHaveBeenCalledWith(4);
  });

  it('writes inbox unread when notifications fail', async () => {
    fetchNotificationsMock.mockRejectedValue(new Error('boom'));
    fetchConversationsMock.mockResolvedValue([UNREAD_ROW, { ...UNREAD_ROW, id: 'c2' }]);
    await refreshUnreadAppBadge('tok');
    expect(setAppBadge).toHaveBeenCalledWith(2);
  });

  it('writes notification unread when conversations fail', async () => {
    fetchNotificationsMock.mockResolvedValue({ notifications: [], unreadCount: 4 });
    fetchConversationsMock.mockRejectedValue(new Error('boom'));
    await refreshUnreadAppBadge('tok');
    expect(setAppBadge).toHaveBeenCalledWith(4);
  });

  it('clears the badge when both fetches fail', async () => {
    fetchNotificationsMock.mockRejectedValue(new Error('n'));
    fetchConversationsMock.mockRejectedValue(new Error('c'));
    await refreshUnreadAppBadge('tok');
    expect(clearAppBadge).toHaveBeenCalledTimes(1);
    expect(setAppBadge).not.toHaveBeenCalled();
  });

  it('skips the badge write when the epoch changes after start', async () => {
    let resolveNotifications!: (value: { notifications: []; unreadCount: number }) => void;
    fetchNotificationsMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveNotifications = resolve;
        }),
    );
    fetchConversationsMock.mockResolvedValue([]);
    const pending = refreshUnreadAppBadge('tok');
    bumpUnreadAppBadgeEpoch();
    resolveNotifications({ notifications: [], unreadCount: 4 });
    await pending;
    expect(setAppBadge).not.toHaveBeenCalled();
    expect(clearAppBadge).not.toHaveBeenCalled();
  });

  it('never rejects', async () => {
    fetchNotificationsMock.mockRejectedValue(new Error('n'));
    fetchConversationsMock.mockRejectedValue(new Error('c'));
    await expect(refreshUnreadAppBadge('tok')).resolves.toBeUndefined();
  });

  it('skips the badge write when the stored session no longer matches', async () => {
    fetchNotificationsMock.mockResolvedValue({ notifications: [], unreadCount: 4 });
    fetchConversationsMock.mockResolvedValue([UNREAD_ROW]);
    window.localStorage.removeItem('21gifts.session');
    await refreshUnreadAppBadge('tok');
    expect(setAppBadge).not.toHaveBeenCalled();
    expect(clearAppBadge).not.toHaveBeenCalled();
  });

  it('starts notifications, inbox, and staff-room fetches before any settles', async () => {
    useAuthStore.setState({ account: { ...ACCOUNT, role: 'moderator' } });
    fetchNotificationsMock.mockImplementation(() => new Promise(() => undefined));
    fetchConversationsMock.mockImplementation(() => new Promise(() => undefined));
    fetchModeratorGroupMock.mockImplementation(() => new Promise(() => undefined));
    void refreshUnreadAppBadge('tok');
    expect(fetchNotificationsMock).toHaveBeenCalledWith('tok');
    expect(fetchConversationsMock).toHaveBeenCalledWith('tok');
    expect(fetchModeratorGroupMock).toHaveBeenCalledWith('tok');
  });
});
