import { act, cleanup, screen, waitFor } from '@testing-library/react';
import type { ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useUnreadCount } from '@/hooks/useUnreadCount';
import type { Conversation } from '@/lib/api-types';
import { useAuthStore } from '@/stores/auth-store';
import { renderWithLocale } from '@/__tests__/render-with-locale';

vi.mock('@/lib/api', () => ({
  fetchNotifications: vi.fn(),
  fetchConversations: vi.fn(),
}));
vi.mock('@/lib/app-badge', () => ({
  setUnreadAppBadge: vi.fn(),
  unreadAppBadgeEpoch: vi.fn(() => 0),
}));
vi.mock('@/lib/session-storage', () => ({
  loadSession: vi.fn(() => null),
}));

import { fetchConversations, fetchNotifications } from '@/lib/api';
import { setUnreadAppBadge, unreadAppBadgeEpoch } from '@/lib/app-badge';
import { loadSession } from '@/lib/session-storage';

const fetchMock = vi.mocked(fetchNotifications);
const conversationsMock = vi.mocked(fetchConversations);
const setBadgeMock = vi.mocked(setUnreadAppBadge);

const UNREAD_ROW: Conversation = {
  id: 'c1',
  kind: 'member_member',
  name: 'Bob',
  lastText: 'Hi',
  lastAt: '2026-08-28T12:00:00.000Z',
  lastFromMe: false,
  unread: true,
};

function Probe({ refreshKey }: { refreshKey: boolean }): ReactElement {
  const { unreadCount, inboxUnreadCount } = useUnreadCount(refreshKey);
  return (
    <>
      <p>count:{unreadCount}</p>
      <p>inbox:{inboxUnreadCount}</p>
    </>
  );
}

describe('useUnreadCount', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    conversationsMock.mockReset();
    conversationsMock.mockResolvedValue([]);
    setBadgeMock.mockClear();
    vi.mocked(loadSession).mockReturnValue(null);
    useAuthStore.setState({ session: 'tok', account: null });
  });

  afterEach(() => {
    cleanup();
  });

  it('returns 0 without a session', () => {
    useAuthStore.setState({ session: null, account: null });
    renderWithLocale(<Probe refreshKey={false} />);
    expect(screen.getByText('count:0')).toBeTruthy();
    expect(screen.getByText('inbox:0')).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(conversationsMock).not.toHaveBeenCalled();
    expect(setBadgeMock).toHaveBeenCalledWith(0);
  });

  it('does not clear the home-screen badge while a stored session is hydrating', () => {
    vi.mocked(loadSession).mockReturnValue('stored-tok');
    useAuthStore.setState({ session: null, account: null });
    renderWithLocale(<Probe refreshKey={false} />);
    expect(screen.getByText('count:0')).toBeTruthy();
    expect(screen.getByText('inbox:0')).toBeTruthy();
    expect(setBadgeMock).not.toHaveBeenCalled();
  });

  it('loads unreadCount from GET /forum/notifications', async () => {
    fetchMock.mockResolvedValue({ notifications: [], unreadCount: 4 });
    renderWithLocale(<Probe refreshKey={true} />);
    await waitFor(() => {
      expect(screen.getByText('count:4')).toBeTruthy();
    });
    expect(fetchMock).toHaveBeenCalledWith('tok');
    expect(conversationsMock).toHaveBeenCalledWith('tok');
    expect(setBadgeMock).toHaveBeenCalledWith(4);
  });

  it('loads inboxUnreadCount from unread conversation rows', async () => {
    fetchMock.mockResolvedValue({ notifications: [], unreadCount: 0 });
    conversationsMock.mockResolvedValue([
      UNREAD_ROW,
      { ...UNREAD_ROW, id: 'c2', unread: false },
      { ...UNREAD_ROW, id: 'c3' },
    ]);
    renderWithLocale(<Probe refreshKey={true} />);
    await waitFor(() => {
      expect(screen.getByText('inbox:2')).toBeTruthy();
    });
    expect(screen.getByText('count:0')).toBeTruthy();
    expect(setBadgeMock).toHaveBeenCalledWith(0);
  });

  it('resolves errors to 0', async () => {
    fetchMock.mockRejectedValue(new Error('boom'));
    renderWithLocale(<Probe refreshKey={true} />);
    await waitFor(() => {
      expect(screen.getByText('count:0')).toBeTruthy();
    });
    expect(setBadgeMock).toHaveBeenCalledWith(0);
  });

  it('keeps inbox unread when notifications fail', async () => {
    fetchMock.mockRejectedValue(new Error('boom'));
    conversationsMock.mockResolvedValue([UNREAD_ROW, { ...UNREAD_ROW, id: 'c2' }]);
    renderWithLocale(<Probe refreshKey={true} />);
    await waitFor(() => {
      expect(screen.getByText('inbox:2')).toBeTruthy();
    });
    expect(screen.getByText('count:0')).toBeTruthy();
    expect(setBadgeMock).toHaveBeenCalledWith(0);
  });

  it('does not write the badge when conversations fail', async () => {
    fetchMock.mockResolvedValue({ notifications: [], unreadCount: 4 });
    conversationsMock.mockRejectedValue(new Error('boom'));
    renderWithLocale(<Probe refreshKey={true} />);
    await waitFor(() => {
      expect(screen.getByText('count:4')).toBeTruthy();
    });
    expect(screen.getByText('inbox:0')).toBeTruthy();
    expect(setBadgeMock).toHaveBeenCalledWith(4);
    expect(setBadgeMock).not.toHaveBeenCalledWith(0);
  });

  it('drops a stale result when the session changes mid-flight', async () => {
    let resolveFirst!: (value: { notifications: []; unreadCount: number }) => void;
    fetchMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveFirst = resolve;
        }),
    );
    fetchMock.mockResolvedValueOnce({ notifications: [], unreadCount: 2 });
    renderWithLocale(<Probe refreshKey={true} />);
    await act(async () => {
      useAuthStore.setState({ session: 'tok2', account: null });
    });
    await act(async () => {
      resolveFirst({ notifications: [], unreadCount: 9 });
    });
    await waitFor(() => {
      expect(screen.getByText('count:2')).toBeTruthy();
    });
    expect(setBadgeMock).toHaveBeenCalledWith(2);
    expect(setBadgeMock).not.toHaveBeenCalledWith(9);
  });

  it('drops a stale inbox count when the session changes mid-flight', async () => {
    let resolveFirst!: (value: Conversation[]) => void;
    conversationsMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveFirst = resolve;
        }),
    );
    conversationsMock.mockResolvedValueOnce([]);
    fetchMock.mockResolvedValue({ notifications: [], unreadCount: 0 });
    renderWithLocale(<Probe refreshKey={true} />);
    await act(async () => {
      useAuthStore.setState({ session: 'tok2', account: null });
    });
    await act(async () => {
      resolveFirst([UNREAD_ROW, { ...UNREAD_ROW, id: 'c2' }]);
    });
    await waitFor(() => {
      expect(screen.getByText('inbox:0')).toBeTruthy();
    });
    expect(screen.queryByText('inbox:2')).toBeNull();
  });

  it('drops a stale rejection when the session changes mid-flight', async () => {
    let rejectFirst!: (reason?: unknown) => void;
    fetchMock.mockImplementationOnce(
      () =>
        new Promise((_resolve, reject) => {
          rejectFirst = reject;
        }),
    );
    fetchMock.mockResolvedValueOnce({ notifications: [], unreadCount: 2 });
    renderWithLocale(<Probe refreshKey={true} />);
    await act(async () => {
      useAuthStore.setState({ session: 'tok2', account: null });
    });
    await act(async () => {
      rejectFirst(new Error('fail'));
    });
    await waitFor(() => {
      expect(screen.getByText('count:2')).toBeTruthy();
    });
  });

  it('drops a stale inbox rejection when the session changes mid-flight', async () => {
    let rejectFirst!: (reason?: unknown) => void;
    conversationsMock.mockImplementationOnce(
      () =>
        new Promise((_resolve, reject) => {
          rejectFirst = reject;
        }),
    );
    conversationsMock.mockResolvedValueOnce([UNREAD_ROW]);
    fetchMock.mockResolvedValue({ notifications: [], unreadCount: 0 });
    renderWithLocale(<Probe refreshKey={true} />);
    await act(async () => {
      useAuthStore.setState({ session: 'tok2', account: null });
    });
    await act(async () => {
      rejectFirst(new Error('fail'));
    });
    await waitFor(() => {
      expect(screen.getByText('inbox:1')).toBeTruthy();
    });
    expect(setBadgeMock).toHaveBeenCalledWith(0);
    expect(setBadgeMock).not.toHaveBeenCalledWith(1);
  });

  it('does not apply a stale badge after the epoch bumps', async () => {
    const epochMock = vi.mocked(unreadAppBadgeEpoch);
    let epoch = 0;
    epochMock.mockImplementation(() => epoch);
    let resolveList!: (value: { notifications: []; unreadCount: number }) => void;
    fetchMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveList = resolve;
        }),
    );
    renderWithLocale(<Probe refreshKey={true} />);
    epoch = 1;
    await act(async () => {
      resolveList({ notifications: [], unreadCount: 7 });
    });
    await waitFor(() => {
      expect(screen.getByText('count:7')).toBeTruthy();
    });
    expect(setBadgeMock).not.toHaveBeenCalledWith(7);
  });

  it('does not apply a stale error badge after the epoch bumps', async () => {
    const epochMock = vi.mocked(unreadAppBadgeEpoch);
    let epoch = 0;
    epochMock.mockImplementation(() => epoch);
    let rejectList!: (reason?: unknown) => void;
    fetchMock.mockImplementation(
      () =>
        new Promise((_resolve, reject) => {
          rejectList = reject;
        }),
    );
    renderWithLocale(<Probe refreshKey={true} />);
    epoch = 1;
    await act(async () => {
      rejectList(new Error('fail'));
    });
    await waitFor(() => {
      expect(screen.getByText('count:0')).toBeTruthy();
    });
    expect(setBadgeMock).not.toHaveBeenCalledWith(0);
  });
});
