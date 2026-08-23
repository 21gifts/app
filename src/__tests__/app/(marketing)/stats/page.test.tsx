import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import StatsPage from '@/app/(marketing)/stats/page';
import type { GiftStats } from '@/lib/api-types';

const EMPTY: GiftStats = {
  totalSats: 0,
  giftCount: 0,
  recipientCount: 0,
  firstPaidAt: null,
  lastPaidAt: null,
  spendOverTime: [],
  byRecipient: [],
  byMonth: [],
};

vi.mock('@/lib/api', () => ({
  fetchGiftStats: vi.fn(),
}));

import { fetchGiftStats } from '@/lib/api';

const fetchMock = vi.mocked(fetchGiftStats);

afterEach(() => {
  cleanup();
  fetchMock.mockReset();
});

describe('StatsPage', () => {
  it('renders the heading and loaded stats', async () => {
    fetchMock.mockResolvedValue(EMPTY);
    render(<StatsPage />);
    expect(screen.getByRole('heading', { name: 'Gifts' })).toBeTruthy();
    await waitFor(() => {
      expect(screen.getByText('No gifts recorded yet.')).toBeTruthy();
    });
  });

  it('shows a fetch error and retries', async () => {
    fetchMock.mockRejectedValueOnce(new Error('Could not load gift stats. Please try again.'));
    fetchMock.mockResolvedValueOnce(EMPTY);
    render(<StatsPage />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() => {
      expect(screen.getByText('No gifts recorded yet.')).toBeTruthy();
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('uses the fallback error copy for a non-Error rejection', async () => {
    fetchMock.mockRejectedValueOnce('nope');
    render(<StatsPage />);
    await waitFor(() => {
      expect(screen.getByText('Could not load gift stats. Please try again.')).toBeTruthy();
    });
  });
});
