import { act, cleanup, screen, waitFor } from '@testing-library/react';
import type { ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useUnreadCount } from '@/hooks/useUnreadCount';
import { useAuthStore } from '@/stores/auth-store';
import { renderWithLocale } from '@/__tests__/render-with-locale';

vi.mock('@/lib/api', () => ({
  fetchNotifications: vi.fn(),
}));
vi.mock('@/lib/app-badge', () => ({
  setUnreadAppBadge: vi.fn(),
  unreadAppBadgeEpoch: vi.fn(() => 0),
}));
vi.mock('@/lib/session-storage', () => ({
  loadSession: vi.fn(() => null),
}));

import { fetchNotifications } from '@/lib/api';
import { setUnreadAppBadge, unreadAppBadgeEpoch } from '@/lib/app-badge';
import { loadSession } from '@/lib/session-storage';

const fetchMock = vi.mocked(fetchNotifications);
const setBadgeMock = vi.mocked(setUnreadAppBadge);

function Probe({ refreshKey }: { refreshKey: boolean }): ReactElement {
  const { unreadCount } = useUnreadCount(refreshKey);
  return <p>count:{unreadCount}</p>;
}

describe('useUnreadCount', () => {
  beforeEach(() => {
    fetchMock.mockReset();
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
    expect(fetchMock).not.toHaveBeenCalled();
    expect(setBadgeMock).toHaveBeenCalledWith(0);
  });

  it('does not clear the home-screen badge while a stored session is hydrating', () => {
    vi.mocked(loadSession).mockReturnValue('stored-tok');
    useAuthStore.setState({ session: null, account: null });
    renderWithLocale(<Probe refreshKey={false} />);
    expect(screen.getByText('count:0')).toBeTruthy();
    expect(setBadgeMock).not.toHaveBeenCalled();
  });

  it('loads unreadCount from GET /forum/notifications', async () => {
    fetchMock.mockResolvedValue({ notifications: [], unreadCount: 4 });
    renderWithLocale(<Probe refreshKey={true} />);
    await waitFor(() => {
      expect(screen.getByText('count:4')).toBeTruthy();
    });
    expect(fetchMock).toHaveBeenCalledWith('tok');
    expect(setBadgeMock).toHaveBeenCalledWith(4);
  });

  it('resolves errors to 0', async () => {
    fetchMock.mockRejectedValue(new Error('boom'));
    renderWithLocale(<Probe refreshKey={true} />);
    await waitFor(() => {
      expect(screen.getByText('count:0')).toBeTruthy();
    });
    expect(setBadgeMock).toHaveBeenCalledWith(0);
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
