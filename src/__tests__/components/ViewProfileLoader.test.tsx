import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ViewProfileLoader } from '@/components/ViewProfileLoader';
import type { GiftStats, ViewProfile } from '@/lib/api-types';
import { renderWithLocale } from '@/__tests__/render-with-locale';

const VIEW_KEY = 'a'.repeat(64);

const profile: ViewProfile = {
  name: 'Ada',
  lightningAddress: 'alice@walletofsatoshi.com',
  lightningAddressVerified: false,
  createdAt: 1,
};

const EMPTY_STATS: GiftStats = {
  totalSats: 0,
  totalBtc: '0.00000000',
  totalUsd: '0.00',
  giftCount: 0,
  recipientCount: 0,
  firstPaidAt: null,
  lastPaidAt: null,
  spendOverTime: [],
  byRecipient: [],
  byMonth: [],
  fx: {
    quote: 'BTC-USD',
    dayBasis: 'utc',
    source: 'coinbase-exchange-daily-close',
  },
};

vi.mock('@/lib/api', () => ({
  fetchViewProfile: vi.fn(),
  fetchGiftStats: vi.fn(),
}));

import { fetchGiftStats, fetchViewProfile } from '@/lib/api';

const fetchProfile = vi.mocked(fetchViewProfile);
const fetchStats = vi.mocked(fetchGiftStats);

afterEach(() => {
  cleanup();
  fetchProfile.mockReset();
  fetchStats.mockReset();
});

describe('ViewProfileLoader', () => {
  it('treats a malformed key as missing without calling the api', () => {
    renderWithLocale(<ViewProfileLoader viewKey="not-a-key" />);
    expect(screen.getByText('This profile could not be found.')).toBeTruthy();
    expect(fetchProfile).not.toHaveBeenCalled();
  });

  it('shows missing when fetchViewProfile returns null', async () => {
    fetchProfile.mockResolvedValue(null);
    renderWithLocale(<ViewProfileLoader viewKey={VIEW_KEY} />);
    await waitFor(() => {
      expect(screen.getByText('This profile could not be found.')).toBeTruthy();
    });
    expect(fetchProfile).toHaveBeenCalledWith(VIEW_KEY);
  });

  it('shows an error and retries', async () => {
    fetchProfile.mockRejectedValueOnce(new Error('boom'));
    fetchProfile.mockResolvedValueOnce(profile);
    fetchStats.mockResolvedValue(EMPTY_STATS);
    renderWithLocale(<ViewProfileLoader viewKey={VIEW_KEY} />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy();
    });
    expect(screen.getByText('Could not load this profile. Please try again.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() => {
      expect(screen.getByText('Ada')).toBeTruthy();
    });
    expect(fetchProfile).toHaveBeenCalledTimes(2);
  });

  it('renders the profile card on success', async () => {
    fetchProfile.mockResolvedValue(profile);
    fetchStats.mockResolvedValue({
      ...EMPTY_STATS,
      byRecipient: [{ recipient: 'alice', giftCount: 1, sats: 21, btc: '0.00000021', usd: '0.02' }],
    });
    renderWithLocale(<ViewProfileLoader viewKey={VIEW_KEY} />);
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Profile' })).toBeTruthy();
    });
    expect(screen.getByText('Ada')).toBeTruthy();
    expect(screen.getByText('alice@walletofsatoshi.com')).toBeTruthy();
    await waitFor(() => {
      expect(screen.getByLabelText('Received 21 sats')).toBeTruthy();
    });
  });

  it('still shows the card when gift stats fail', async () => {
    fetchProfile.mockResolvedValue(profile);
    fetchStats.mockRejectedValue(new Error('stats down'));
    renderWithLocale(<ViewProfileLoader viewKey={VIEW_KEY} />);
    await waitFor(() => {
      expect(screen.getByText('Ada')).toBeTruthy();
    });
    await waitFor(() => {
      expect(screen.getByLabelText('Given 0 sats')).toBeTruthy();
    });
  });

  it('ignores a stale profile resolve after unmount', async () => {
    let resolveProfile: ((value: ViewProfile | null) => void) | undefined;
    fetchProfile.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveProfile = resolve;
        }),
    );
    const view = renderWithLocale(<ViewProfileLoader viewKey={VIEW_KEY} />);
    view.unmount();
    resolveProfile?.(profile);
    await Promise.resolve();
    expect(fetchProfile).toHaveBeenCalled();
  });

  it('ignores a stale profile reject after unmount', async () => {
    let rejectProfile: ((reason: Error) => void) | undefined;
    fetchProfile.mockImplementationOnce(
      () =>
        new Promise((_, reject) => {
          rejectProfile = reject;
        }),
    );
    const view = renderWithLocale(<ViewProfileLoader viewKey={VIEW_KEY} />);
    view.unmount();
    rejectProfile?.(new Error('gone'));
    await Promise.resolve();
    expect(fetchProfile).toHaveBeenCalled();
  });

  it('ignores a stale stats resolve after unmount', async () => {
    fetchProfile.mockResolvedValue(profile);
    let resolveStats: ((value: GiftStats) => void) | undefined;
    fetchStats.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveStats = resolve;
        }),
    );
    const view = renderWithLocale(<ViewProfileLoader viewKey={VIEW_KEY} />);
    await waitFor(() => {
      expect(fetchStats).toHaveBeenCalled();
    });
    view.unmount();
    resolveStats?.(EMPTY_STATS);
    await Promise.resolve();
  });

  it('ignores a stale stats reject after unmount', async () => {
    fetchProfile.mockResolvedValue(profile);
    let rejectStats: ((reason: Error) => void) | undefined;
    fetchStats.mockImplementationOnce(
      () =>
        new Promise((_, reject) => {
          rejectStats = reject;
        }),
    );
    const view = renderWithLocale(<ViewProfileLoader viewKey={VIEW_KEY} />);
    await waitFor(() => {
      expect(fetchStats).toHaveBeenCalled();
    });
    view.unmount();
    rejectStats?.(new Error('gone'));
    await Promise.resolve();
  });

  it('shows Loading… while the profile is fetching', () => {
    fetchProfile.mockImplementation(() => new Promise(() => undefined));
    renderWithLocale(<ViewProfileLoader viewKey={VIEW_KEY} />);
    expect(screen.getByText('Loading…')).toBeTruthy();
  });
});
