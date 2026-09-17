import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Conversation } from '@/lib/api-types';

vi.mock('@/lib/api', () => ({
  fetchNotifications: vi.fn(),
  fetchConversations: vi.fn(),
}));

import { fetchConversations, fetchNotifications } from '@/lib/api';
import {
  bumpUnreadAppBadgeEpoch,
  refreshUnreadAppBadge,
  setUnreadAppBadge,
  unreadAppBadgeEpoch,
} from '@/lib/app-badge';

const fetchNotificationsMock = vi.mocked(fetchNotifications);
const fetchConversationsMock = vi.mocked(fetchConversations);

const UNREAD_ROW: Conversation = {
  id: 'c1',
  kind: 'member_member',
  name: 'Bob',
  lastText: 'Hi',
  lastAt: '2026-08-28T12:00:00.000Z',
  lastFromMe: false,
  unread: true,
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
    setAppBadge.mockClear();
    clearAppBadge.mockClear();
    fetchNotificationsMock.mockReset();
    fetchConversationsMock.mockReset();
    Object.defineProperty(navigator, 'setAppBadge', {
      configurable: true,
      value: setAppBadge,
    });
    Object.defineProperty(navigator, 'clearAppBadge', {
      configurable: true,
      value: clearAppBadge,
    });
  });

  it('sets the badge to notification unread plus inbox unread', async () => {
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
    fetchNotificationsMock.mockResolvedValue({ notifications: [], unreadCount: 4 });
    await refreshUnreadAppBadge('tok', 2);
    expect(fetchConversationsMock).not.toHaveBeenCalled();
    expect(setAppBadge).toHaveBeenCalledWith(6);
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

  it('starts both fetches before either settles', async () => {
    fetchNotificationsMock.mockImplementation(() => new Promise(() => undefined));
    fetchConversationsMock.mockImplementation(() => new Promise(() => undefined));
    void refreshUnreadAppBadge('tok');
    expect(fetchNotificationsMock).toHaveBeenCalledWith('tok');
    expect(fetchConversationsMock).toHaveBeenCalledWith('tok');
  });
});
