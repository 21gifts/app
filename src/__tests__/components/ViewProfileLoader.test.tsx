import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ViewProfileLoader } from '@/components/ViewProfileLoader';
import type { AccountActivity, ViewProfile } from '@/lib/api-types';
import { useAuthStore } from '@/stores/auth-store';
import { renderWithLocale } from '@/__tests__/render-with-locale';

const VIEW_KEY = 'a'.repeat(64);

vi.mock('next/navigation', () => ({
  useRouter: (): { replace: () => void } => ({ replace: vi.fn() }),
}));

vi.mock('@/hooks/useHydrateSession', () => ({
  useHydrateSession: (): { ready: boolean } => ({ ready: true }),
}));

const profile: ViewProfile = {
  name: 'Ada',
  location: null,
  lightningAddress: 'alice@walletofsatoshi.com',
  lightningAddressVerified: false,
  createdAt: 1,
  hasPasskey: false,
  aboutMe: null,
  aboutMeHasPhoto: false,
};

const EMPTY_FX = {
  quote: 'BTC-USD' as const,
  dayBasis: 'utc' as const,
  source: 'coinbase-exchange-daily-close' as const,
  quotes: [{ code: 'USD' as const, pair: 'BTC-USD', source: 'coinbase-exchange-daily-close' }],
};
const EMPTY_ACTIVITY: AccountActivity = {
  donatedSats: 0,
  receivedSats: 0,
  donatedOverTime: [],
  receivedOverTime: [],
  fx: EMPTY_FX,
};

vi.mock('@/lib/api', () => ({
  fetchViewProfile: vi.fn(),
  fetchViewActivity: vi.fn(),
}));

import { fetchViewActivity, fetchViewProfile } from '@/lib/api';

const fetchProfile = vi.mocked(fetchViewProfile);
const fetchActivity = vi.mocked(fetchViewActivity);

beforeEach(() => {
  useAuthStore.setState({ session: null, account: null });
  fetchActivity.mockResolvedValue(EMPTY_ACTIVITY);
});

afterEach(() => {
  cleanup();
  fetchProfile.mockReset();
  fetchActivity.mockReset();
});

describe('ViewProfileLoader', () => {
  it('treats a malformed key as missing without calling the api', () => {
    renderWithLocale(<ViewProfileLoader viewKey="not-a-key" />);
    expect(screen.getByText('This profile could not be found.')).toBeTruthy();
    expect(fetchProfile).not.toHaveBeenCalled();
    expect(fetchActivity).not.toHaveBeenCalled();
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
    renderWithLocale(<ViewProfileLoader viewKey={VIEW_KEY} />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy();
    });
    const alert = screen.getByRole('alert');
    expect(alert.textContent).toBe('Could not load this profile. Please try again.');
    expect(alert.className).toContain('text-app-danger');
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() => {
      expect(screen.getByText('Ada')).toBeTruthy();
    });
    expect(fetchProfile).toHaveBeenCalledTimes(2);
  });

  it('renders the profile card on success', async () => {
    fetchProfile.mockResolvedValue(profile);
    fetchActivity.mockResolvedValue({
      ...EMPTY_ACTIVITY,
      receivedSats: 21,
      receivedOverTime: [
        {
          day: '2026-06-01',
          sats: 21,
          cumulativeSats: 21,
          btc: '0.00000021',
          cumulativeBtc: '0.00000021',
          usd: '0.02',
          cumulativeUsd: '0.02',
          chf: '0.02',
          eur: '0.02',
          php: '1.00',
          cumulativeChf: '0.02',
          cumulativeEur: '0.02',
          cumulativePhp: '1.00',
        },
      ],
    });
    renderWithLocale(<ViewProfileLoader viewKey={VIEW_KEY} />);
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Profile' })).toBeTruthy();
    });
    expect(screen.getByText('Ada')).toBeTruthy();
    expect(screen.getByText('alice@walletofsatoshi.com')).toBeTruthy();
    expect(screen.getByText('Given')).toBeTruthy();
    expect(screen.getByText('Action required, the account must be activated')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Activate' })).toBeTruthy();
    expect(fetchActivity).toHaveBeenCalledWith(VIEW_KEY);
  });

  it('still shows the card when activity fails', async () => {
    fetchProfile.mockResolvedValue(profile);
    fetchActivity.mockRejectedValue(new Error('activity down'));
    renderWithLocale(<ViewProfileLoader viewKey={VIEW_KEY} />);
    await waitFor(() => {
      expect(screen.getByText('Ada')).toBeTruthy();
    });
    await waitFor(() => {
      expect(screen.getByText('No gifts yet.')).toBeTruthy();
    });
  });

  it('fetches activity when lightningAddress is null', async () => {
    fetchProfile.mockResolvedValue({ ...profile, lightningAddress: null });
    renderWithLocale(<ViewProfileLoader viewKey={VIEW_KEY} />);
    await waitFor(() => {
      expect(screen.getByText('Ada')).toBeTruthy();
    });
    expect(fetchActivity).toHaveBeenCalledWith(VIEW_KEY);
    expect(screen.getByText('No gifts yet.')).toBeTruthy();
  });

  it('fetches activity when lightningAddress is blank', async () => {
    fetchProfile.mockResolvedValue({ ...profile, name: null, lightningAddress: '   ' });
    renderWithLocale(<ViewProfileLoader viewKey={VIEW_KEY} />);
    await waitFor(() => {
      expect(screen.getByText('Unnamed')).toBeTruthy();
    });
    expect(fetchActivity).toHaveBeenCalledWith(VIEW_KEY);
    expect(screen.getByText('No gifts yet.')).toBeTruthy();
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

  it('ignores a stale activity resolve after unmount', async () => {
    fetchProfile.mockResolvedValue(profile);
    let resolveActivity: ((value: AccountActivity) => void) | undefined;
    fetchActivity.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveActivity = resolve;
        }),
    );
    const view = renderWithLocale(<ViewProfileLoader viewKey={VIEW_KEY} />);
    await waitFor(() => {
      expect(fetchActivity).toHaveBeenCalled();
    });
    view.unmount();
    resolveActivity?.(EMPTY_ACTIVITY);
    await Promise.resolve();
  });

  it('ignores a stale activity reject after unmount', async () => {
    fetchProfile.mockResolvedValue(profile);
    let rejectActivity: ((reason: Error) => void) | undefined;
    fetchActivity.mockImplementationOnce(
      () =>
        new Promise((_, reject) => {
          rejectActivity = reject;
        }),
    );
    const view = renderWithLocale(<ViewProfileLoader viewKey={VIEW_KEY} />);
    await waitFor(() => {
      expect(fetchActivity).toHaveBeenCalled();
    });
    view.unmount();
    rejectActivity?.(new Error('gone'));
    await Promise.resolve();
  });

  it('shows Loading… while the profile is fetching', () => {
    fetchProfile.mockImplementation(() => new Promise(() => undefined));
    renderWithLocale(<ViewProfileLoader viewKey={VIEW_KEY} />);
    expect(screen.getByText('Loading…')).toBeTruthy();
  });
});
