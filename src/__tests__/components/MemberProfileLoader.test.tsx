import { cleanup, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemberProfileLoader } from '@/components/MemberProfileLoader';
import { fetchGiftStats, fetchMember } from '@/lib/api';
import type { MemberProfile } from '@/lib/api-types';
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
    vi.mocked(fetchMember).mockRejectedValue(new Error('boom'));
    renderWithLocale(<MemberProfileLoader accountId={memberId} />);
    expect(await screen.findByText('Could not load this profile. Please try again.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy();
  });
});
