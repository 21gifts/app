import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DayLoader } from '@/app/(marketing)/stats/[day]/day-loader';
import type { GiftDay } from '@/lib/api-types';

const push = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
}));

vi.mock('@/lib/api', () => ({
  fetchGiftDay: vi.fn(),
}));

import { fetchGiftDay } from '@/lib/api';

const fetchMock = vi.mocked(fetchGiftDay);

const EMPTY: GiftDay = {
  day: '2026-06-01',
  giftCount: 0,
  totalSats: 0,
  totalBtc: '0.00000000',
  totalUsd: '0.00',
  gifts: [],
  fx: {
    quote: 'BTC-USD',
    dayBasis: 'utc',
    source: 'coinbase-exchange-daily-close',
  },
};

afterEach(() => {
  cleanup();
  fetchMock.mockReset();
  push.mockReset();
});

describe('DayLoader', () => {
  it('shows the empty copy', async () => {
    fetchMock.mockResolvedValue(EMPTY);
    render(<DayLoader day="2026-06-01" />);
    await waitFor(() => {
      expect(screen.getByText('No gifts recorded on this day.')).toBeTruthy();
    });
  });

  it('shows a fetch error and retries', async () => {
    fetchMock.mockRejectedValueOnce(new Error('Could not load gift stats. Please try again.'));
    fetchMock.mockResolvedValueOnce(EMPTY);
    render(<DayLoader day="2026-06-01" />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() => {
      expect(screen.getByText('No gifts recorded on this day.')).toBeTruthy();
    });
  });

  it('falls back when fetch rejects a non-Error', async () => {
    fetchMock.mockRejectedValueOnce('nope');
    render(<DayLoader day="2026-06-01" />);
    await waitFor(() => {
      expect(screen.getByText('Could not load gift stats. Please try again.')).toBeTruthy();
    });
  });

  it('hides the previous day payload as soon as the day prop changes', async () => {
    fetchMock.mockResolvedValueOnce({
      ...EMPTY,
      giftCount: 1,
      totalSats: 500,
      totalBtc: '0.00000500',
      totalUsd: '0.48',
      gifts: [
        {
          paidAt: '2026-06-01T12:00:00.000Z',
          amountSats: 500,
          amountBtc: '0.00000500',
          amountUsd: '0.48',
          recipient: 'alice',
        },
      ],
    });
    fetchMock.mockResolvedValueOnce({ ...EMPTY, day: '2026-06-02' });
    const view = render(<DayLoader day="2026-06-01" />);
    await waitFor(() => {
      expect(screen.getByText('alice')).toBeTruthy();
    });
    view.rerender(<DayLoader day="2026-06-02" />);
    expect(screen.queryByText('alice')).toBeNull();
    await waitFor(() => {
      expect(screen.getByText('No gifts recorded on this day.')).toBeTruthy();
    });
  });

  it('uses singular gift copy for one gift', async () => {
    fetchMock.mockResolvedValue({
      ...EMPTY,
      giftCount: 1,
      totalSats: 500,
      totalBtc: '0.00000500',
      totalUsd: '0.48',
      gifts: [
        {
          paidAt: '2026-06-01T12:00:00.000Z',
          amountSats: 500,
          amountBtc: '0.00000500',
          amountUsd: '0.48',
          recipient: 'alice',
        },
      ],
    });
    render(<DayLoader day="2026-06-01" />);
    await waitFor(() => {
      expect(screen.getByText('1 gift · ₿500 · 0.48 USD')).toBeTruthy();
    });
  });

  it('navigates when the date input changes', async () => {
    fetchMock.mockResolvedValue(EMPTY);
    render(<DayLoader day="2026-06-01" />);
    await waitFor(() => {
      expect(screen.getByLabelText('UTC day')).toBeTruthy();
    });
    fireEvent.change(screen.getByLabelText('UTC day'), { target: { value: '2026-08-24' } });
    expect(push).toHaveBeenCalledWith('/stats/2026-08-24');
  });

  it('does not navigate when the date is unchanged or invalid', async () => {
    fetchMock.mockResolvedValue(EMPTY);
    render(<DayLoader day="2026-06-01" />);
    await waitFor(() => {
      expect(screen.getByLabelText('UTC day')).toBeTruthy();
    });
    fireEvent.change(screen.getByLabelText('UTC day'), { target: { value: '2026-06-01' } });
    fireEvent.change(screen.getByLabelText('UTC day'), { target: { value: '' } });
    expect(push).not.toHaveBeenCalled();
  });

  it('ignores a stale fetch after unmount', async () => {
    let resolveStale: ((value: GiftDay) => void) | undefined;
    fetchMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveStale = resolve;
        }),
    );
    const view = render(<DayLoader day="2026-06-01" />);
    view.unmount();
    resolveStale?.(EMPTY);
    await Promise.resolve();
    expect(fetchMock).toHaveBeenCalled();
  });

  it('ignores a stale rejection after unmount', async () => {
    let rejectStale: ((reason: Error) => void) | undefined;
    fetchMock.mockImplementationOnce(
      () =>
        new Promise((_, reject) => {
          rejectStale = reject;
        }),
    );
    const view = render(<DayLoader day="2026-06-01" />);
    view.unmount();
    rejectStale?.(new Error('gone'));
    await Promise.resolve();
    expect(fetchMock).toHaveBeenCalled();
  });
});
