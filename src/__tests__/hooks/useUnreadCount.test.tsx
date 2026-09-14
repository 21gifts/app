import { cleanup, screen, waitFor } from '@testing-library/react';
import type { ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useUnreadCount } from '@/hooks/useUnreadCount';
import { useAuthStore } from '@/stores/auth-store';
import { renderWithLocale } from '@/__tests__/render-with-locale';

vi.mock('@/lib/api', () => ({
  fetchNotifications: vi.fn(),
}));

import { fetchNotifications } from '@/lib/api';

const fetchMock = vi.mocked(fetchNotifications);

function Probe({ refreshKey }: { refreshKey: boolean }): ReactElement {
  const { unreadCount } = useUnreadCount(refreshKey);
  return <p>count:{unreadCount}</p>;
}

describe('useUnreadCount', () => {
  beforeEach(() => {
    fetchMock.mockReset();
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
  });

  it('loads unreadCount from GET /forum/notifications', async () => {
    fetchMock.mockResolvedValue({ notifications: [], unreadCount: 4 });
    renderWithLocale(<Probe refreshKey={true} />);
    await waitFor(() => {
      expect(screen.getByText('count:4')).toBeTruthy();
    });
    expect(fetchMock).toHaveBeenCalledWith('tok');
  });

  it('resolves errors to 0', async () => {
    fetchMock.mockRejectedValue(new Error('boom'));
    renderWithLocale(<Probe refreshKey={true} />);
    await waitFor(() => {
      expect(screen.getByText('count:0')).toBeTruthy();
    });
  });
});
