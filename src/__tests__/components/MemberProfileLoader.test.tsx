import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemberProfileLoader } from '@/components/MemberProfileLoader';
import { fetchMember, fetchMemberActivity, fetchMemberPosts, fetchMemberReplies } from '@/lib/api';
import type { AccountActivity, MemberProfile } from '@/lib/api-types';
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
  fetchMemberActivity: vi.fn(),
  fetchMemberPosts: vi.fn(),
  fetchMemberReplies: vi.fn(),
}));

const memberId = '22222222-2222-4222-8222-222222222222';

const profile: MemberProfile = {
  id: memberId,
  name: 'Carol',
  location: null,
  role: 'verified',
  lightningAddress: 'carol@walletofsatoshi.com',
  createdAt: '2026-01-15T12:00:00.000Z',
  profileMessage: null,
  postCount: 0,
  replyCount: 0,
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

beforeEach(() => {
  replace.mockClear();
  vi.clearAllMocks();
  vi.mocked(fetchMemberActivity).mockResolvedValue(EMPTY_ACTIVITY);
  useAuthStore.setState({
    session: 'sess',
    account: {
      id: '11111111-1111-4111-8111-111111111111',
      linkingKey: null,
      role: 'basis',
      name: 'Ada',
      location: null,
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
  vi.mocked(fetchMemberPosts).mockResolvedValue([]);
  vi.mocked(fetchMemberReplies).mockResolvedValue([]);
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
    renderWithLocale(<MemberProfileLoader accountId={memberId} />);
    expect(await screen.findByText('Carol')).toBeTruthy();
    expect(fetchMember).toHaveBeenCalledWith('sess', memberId);
    expect(fetchMemberActivity).toHaveBeenCalledWith('sess', memberId);
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
    renderWithLocale(<MemberProfileLoader accountId={memberId} />);
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toBe('Could not load this profile. Please try again.');
    expect(alert.className).toContain('text-app-danger');
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('Carol')).toBeTruthy();
    expect(fetchMember).toHaveBeenCalledTimes(2);
  });

  it('shows loading when there is no session', () => {
    useAuthStore.setState({ session: null });
    renderWithLocale(<MemberProfileLoader accountId={memberId} />);
    expect(screen.getByText('Loading…')).toBeTruthy();
    expect(fetchMember).not.toHaveBeenCalled();
    expect(fetchMemberActivity).not.toHaveBeenCalled();
  });

  it('redirects to rules when the member fetch is missing requirements', async () => {
    vi.mocked(fetchMember).mockRejectedValue(new MissingRequirementsError(['rules']));
    renderWithLocale(<MemberProfileLoader accountId={memberId} />);
    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith('/setup/rules');
    });
  });

  it('redirects to rules when activity is missing requirements', async () => {
    vi.mocked(fetchMember).mockResolvedValue(profile);
    vi.mocked(fetchMemberActivity).mockRejectedValue(new MissingRequirementsError(['rules']));
    renderWithLocale(<MemberProfileLoader accountId={memberId} />);
    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith('/setup/rules');
    });
  });

  it('still shows the card when activity fails', async () => {
    vi.mocked(fetchMember).mockResolvedValue(profile);
    vi.mocked(fetchMemberActivity).mockRejectedValue(new Error('activity down'));
    renderWithLocale(<MemberProfileLoader accountId={memberId} />);
    expect(await screen.findByText('Carol')).toBeTruthy();
  });

  it('fetches activity when lightningAddress is null', async () => {
    vi.mocked(fetchMember).mockResolvedValue({ ...profile, lightningAddress: null });
    renderWithLocale(<MemberProfileLoader accountId={memberId} />);
    expect(await screen.findByText('Carol')).toBeTruthy();
    expect(fetchMemberActivity).toHaveBeenCalledWith('sess', memberId);
  });

  it('fetches activity when lightningAddress is blank', async () => {
    vi.mocked(fetchMember).mockResolvedValue({ ...profile, lightningAddress: '   ' });
    renderWithLocale(<MemberProfileLoader accountId={memberId} />);
    expect(await screen.findByText('Carol')).toBeTruthy();
    expect(fetchMemberActivity).toHaveBeenCalledWith('sess', memberId);
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

  it('ignores a stale activity resolve after unmount', async () => {
    vi.mocked(fetchMember).mockResolvedValue(profile);
    let resolveActivity: ((value: AccountActivity) => void) | undefined;
    vi.mocked(fetchMemberActivity).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveActivity = resolve;
        }),
    );
    const view = renderWithLocale(<MemberProfileLoader accountId={memberId} />);
    await waitFor(() => {
      expect(fetchMemberActivity).toHaveBeenCalled();
    });
    view.unmount();
    resolveActivity?.(EMPTY_ACTIVITY);
    await Promise.resolve();
  });

  it('ignores a stale activity reject after unmount', async () => {
    vi.mocked(fetchMember).mockResolvedValue(profile);
    let rejectActivity: ((reason: Error) => void) | undefined;
    vi.mocked(fetchMemberActivity).mockImplementationOnce(
      () =>
        new Promise((_, reject) => {
          rejectActivity = reject;
        }),
    );
    const view = renderWithLocale(<MemberProfileLoader accountId={memberId} />);
    await waitFor(() => {
      expect(fetchMemberActivity).toHaveBeenCalled();
    });
    view.unmount();
    rejectActivity?.(new Error('gone'));
    await Promise.resolve();
  });
});
