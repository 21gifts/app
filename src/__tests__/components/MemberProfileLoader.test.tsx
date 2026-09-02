import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemberProfileLoader } from '@/components/MemberProfileLoader';
import { fetchGiftStats, fetchMember } from '@/lib/api';
import type { GiftStats, MemberProfile } from '@/lib/api-types';
import { MissingRequirementsError } from '@/lib/missing-requirements';
import { useAuthStore } from '@/stores/auth-store';
import { renderWithLocale } from '@/__tests__/render-with-locale';

const replace = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: (): { push: typeof replace; replace: typeof replace } => ({
    push: replace,
    replace,
  }),
}));

vi.mock('@/lib/api', () => ({
  fetchMember: vi.fn(),
  fetchGiftStats: vi.fn(),
}));

const memberId = '22222222-2222-4222-8222-222222222222';

const profile: MemberProfile = {
  id: memberId,
  name: 'Carol',
  role: 'verified',
  lightningAddress: 'carol@walletofsatoshi.com',
  createdAt: '2026-01-15T12:00:00.000Z',
  profileMessage: null,
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

beforeEach(() => {
  replace.mockClear();
  vi.clearAllMocks();
  useAuthStore.setState({
    session: 'sess',
    account: {
      id: '11111111-1111-4111-8111-111111111111',
      linkingKey: null,
      role: 'basis',
      name: 'Ada',
      lightningAddress: 'alice@walletofsatoshi.com',
      lightningAddressVerified: false,
      forumLawsDismissed: true,
      createdAt: 1,
      rulesAgreedAt: 1,
      viewKey: 'a'.repeat(64),
      setup: null,
      missing: [],
    },
  });
});

afterEach(cleanup);

describe('MemberProfileLoader', () => {
  it('shows missing for a malformed id', () => {
    renderWithLocale(<MemberProfileLoader accountId="not-a-uuid" />);
    expect(screen.getByText('This profile could not be found.')).toBeTruthy();
    expect(fetchMember).not.toHaveBeenCalled();
  });

  it('loads a member profile', async () => {
    vi.mocked(fetchMember).mockResolvedValue(profile);
    vi.mocked(fetchGiftStats).mockResolvedValue({
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
    });
    renderWithLocale(<MemberProfileLoader accountId={memberId} />);
    expect(await screen.findByText('Carol')).toBeTruthy();
    expect(fetchMember).toHaveBeenCalledWith('sess', memberId);
  });

  it('shows missing when the api returns null', async () => {
    vi.mocked(fetchMember).mockResolvedValue(null);
    renderWithLocale(<MemberProfileLoader accountId={memberId} />);
    await waitFor(() => {
      expect(screen.getByText('This profile could not be found.')).toBeTruthy();
    });
  });

  it('shows error and retry when the fetch fails', async () => {
    vi.mocked(fetchMember).mockRejectedValueOnce(new Error('boom'));
    vi.mocked(fetchMember).mockResolvedValueOnce(profile);
    vi.mocked(fetchGiftStats).mockResolvedValue(EMPTY_STATS);
    renderWithLocale(<MemberProfileLoader accountId={memberId} />);
    expect(await screen.findByText('Could not load this profile. Please try again.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('Carol')).toBeTruthy();
    expect(fetchMember).toHaveBeenCalledTimes(2);
  });

  it('shows loading when there is no session', () => {
    useAuthStore.setState({ session: null });
    renderWithLocale(<MemberProfileLoader accountId={memberId} />);
    expect(screen.getByText('Loading…')).toBeTruthy();
    expect(fetchMember).not.toHaveBeenCalled();
  });

  it('redirects to rules when the member fetch is missing requirements', async () => {
    vi.mocked(fetchMember).mockRejectedValue(new MissingRequirementsError(['rules']));
    renderWithLocale(<MemberProfileLoader accountId={memberId} />);
    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith('/setup/rules');
    });
  });

  it('still shows the card when gift stats fail', async () => {
    vi.mocked(fetchMember).mockResolvedValue(profile);
    vi.mocked(fetchGiftStats).mockRejectedValue(new Error('stats down'));
    renderWithLocale(<MemberProfileLoader accountId={memberId} />);
    expect(await screen.findByText('Carol')).toBeTruthy();
  });

  it('skips gift stats when lightningAddress is null', async () => {
    vi.mocked(fetchMember).mockResolvedValue({ ...profile, lightningAddress: null });
    renderWithLocale(<MemberProfileLoader accountId={memberId} />);
    expect(await screen.findByText('Carol')).toBeTruthy();
    expect(fetchGiftStats).not.toHaveBeenCalled();
  });

  it('skips gift stats when lightningAddress is blank', async () => {
    vi.mocked(fetchMember).mockResolvedValue({ ...profile, lightningAddress: '   ' });
    renderWithLocale(<MemberProfileLoader accountId={memberId} />);
    expect(await screen.findByText('Carol')).toBeTruthy();
    expect(fetchGiftStats).not.toHaveBeenCalled();
  });

  it('ignores a stale member resolve after unmount', async () => {
    let resolveMember: ((value: MemberProfile | null) => void) | undefined;
    vi.mocked(fetchMember).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveMember = resolve;
        }),
    );
    const view = renderWithLocale(<MemberProfileLoader accountId={memberId} />);
    view.unmount();
    resolveMember?.(profile);
    await Promise.resolve();
    expect(fetchMember).toHaveBeenCalled();
  });

  it('ignores a stale member reject after unmount', async () => {
    let rejectMember: ((reason: Error) => void) | undefined;
    vi.mocked(fetchMember).mockImplementationOnce(
      () =>
        new Promise((_, reject) => {
          rejectMember = reject;
        }),
    );
    const view = renderWithLocale(<MemberProfileLoader accountId={memberId} />);
    view.unmount();
    rejectMember?.(new Error('gone'));
    await Promise.resolve();
    expect(fetchMember).toHaveBeenCalled();
  });

  it('ignores a stale stats resolve after unmount', async () => {
    vi.mocked(fetchMember).mockResolvedValue(profile);
    let resolveStats: ((value: GiftStats) => void) | undefined;
    vi.mocked(fetchGiftStats).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveStats = resolve;
        }),
    );
    const view = renderWithLocale(<MemberProfileLoader accountId={memberId} />);
    await waitFor(() => {
      expect(fetchGiftStats).toHaveBeenCalled();
    });
    view.unmount();
    resolveStats?.(EMPTY_STATS);
    await Promise.resolve();
  });

  it('ignores a stale stats reject after unmount', async () => {
    vi.mocked(fetchMember).mockResolvedValue(profile);
    let rejectStats: ((reason: Error) => void) | undefined;
    vi.mocked(fetchGiftStats).mockImplementationOnce(
      () =>
        new Promise((_, reject) => {
          rejectStats = reject;
        }),
    );
    const view = renderWithLocale(<MemberProfileLoader accountId={memberId} />);
    await waitFor(() => {
      expect(fetchGiftStats).toHaveBeenCalled();
    });
    view.unmount();
    rejectStats?.(new Error('gone'));
    await Promise.resolve();
  });
});
