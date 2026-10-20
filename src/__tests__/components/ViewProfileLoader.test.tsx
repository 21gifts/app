import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ViewProfileLoader } from '@/components/ViewProfileLoader';
import type { AccountActivity, MemberProfile, ViewProfile } from '@/lib/api-types';
import { useAuthStore } from '@/stores/auth-store';
import { fetchTranslateAvailable } from '@/lib/note-translate';
import { renderWithLocale } from '@/__tests__/render-with-locale';

const VIEW_KEY = 'a'.repeat(64);

vi.mock('next/navigation', () => ({
  useRouter: (): { replace: () => void } => ({ replace: vi.fn() }),
}));

vi.mock('@/hooks/useHydrateSession', () => ({
  useHydrateSession: (): { ready: boolean } => ({ ready: true }),
}));

vi.mock('@/lib/note-translate', () => ({
  fetchTranslateAvailable: vi.fn(),
  translateNote: vi.fn(),
  translateConversationMessage: vi.fn(),
}));

const GERMAN_ABOUT = 'Kann mir jemand diese Woche ein paar Satoshi leihen?';

const profile: ViewProfile = {
  name: 'Ada',
  username: 'alice',
  location: null,
  lightningAddress: 'alice@21.gifts',
  lightningAddressVerified: true,
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

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return {
    ...actual,
    fetchViewProfile: vi.fn(),
    fetchViewActivity: vi.fn(),
    fetchMember: vi.fn(),
    fetchMemberActivity: vi.fn(),
    fetchViewAboutMePhoto: vi.fn(),
    fetchViewForumList: vi.fn(),
    fetchFxSpot: vi.fn().mockResolvedValue({
      asOf: '2026-10-07T00:00:00.000Z',
      source: 'test',
      rates: {},
    }),
    markNotificationsReadForMessage: vi.fn().mockResolvedValue({ ok: true, tags: [] }),
  };
});

import {
  fetchMember,
  fetchMemberActivity,
  fetchViewAboutMePhoto,
  fetchViewActivity,
  fetchViewForumList,
  fetchViewProfile,
} from '@/lib/api';

const fetchProfile = vi.mocked(fetchViewProfile);
const fetchActivity = vi.mocked(fetchViewActivity);
const fetchSignedInMember = vi.mocked(fetchMember);
const fetchSignedInActivity = vi.mocked(fetchMemberActivity);
const fetchPublicList = vi.mocked(fetchViewForumList);
const fetchAboutPhoto = vi.mocked(fetchViewAboutMePhoto);

beforeEach(() => {
  useAuthStore.setState({ session: null, account: null });
  fetchProfile.mockReset();
  fetchSignedInMember.mockReset();
  fetchSignedInActivity.mockReset();
  fetchPublicList.mockReset();
  fetchActivity.mockReset();
  fetchActivity.mockResolvedValue(EMPTY_ACTIVITY);
  fetchAboutPhoto.mockReset();
  fetchAboutPhoto.mockResolvedValue(new Blob([new Uint8Array([1])], { type: 'image/jpeg' }));
  vi.mocked(fetchTranslateAvailable).mockReset();
  vi.mocked(fetchTranslateAvailable).mockResolvedValue(true);
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

  it('shows the About me photo from the share link when the note id is absent', async () => {
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      writable: true,
      value: () => 'blob:about',
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      writable: true,
      value: () => undefined,
    });
    fetchProfile.mockResolvedValue({
      ...profile,
      aboutMe: 'Hello from Ada.',
      aboutMeHasPhoto: true,
    });
    renderWithLocale(<ViewProfileLoader viewKey={VIEW_KEY} />);
    await waitFor(() => {
      expect(screen.getByAltText('About me photo')).toBeTruthy();
    });
    expect(fetchAboutPhoto).toHaveBeenCalledWith(VIEW_KEY);
  });

  it('offers Translate from aboutMessageId when the share link has no profile note', async () => {
    fetchProfile.mockResolvedValue({
      ...profile,
      aboutMe: GERMAN_ABOUT,
      aboutMessageId: 'm-de',
      profileMessage: null,
    });
    renderWithLocale(<ViewProfileLoader viewKey={VIEW_KEY} />);
    expect(await screen.findByRole('button', { name: 'Translate' })).toBeTruthy();
    expect(screen.getByText(GERMAN_ABOUT)).toBeTruthy();
  });

  it('keeps About me plain when aboutMessageId is empty', async () => {
    fetchProfile.mockResolvedValue({
      ...profile,
      aboutMe: GERMAN_ABOUT,
      aboutMessageId: '',
      profileMessage: null,
    });
    renderWithLocale(<ViewProfileLoader viewKey={VIEW_KEY} />);
    expect(await screen.findByText(GERMAN_ABOUT)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Translate' })).toBeNull();
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
    expect(screen.getByText('alice@21.gifts')).toBeTruthy();
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
      expect(screen.getByText('Could not load gifts.')).toBeTruthy();
    });
    expect(screen.getByText('Could not load loans.')).toBeTruthy();
    expect(screen.queryByText('No gifts yet.')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull();
  });

  it('shows empty gifts copy while activity is still loading', async () => {
    fetchProfile.mockResolvedValue(profile);
    fetchActivity.mockReturnValue(new Promise(() => undefined));
    renderWithLocale(<ViewProfileLoader viewKey={VIEW_KEY} />);
    await waitFor(() => {
      expect(screen.getByText('Ada')).toBeTruthy();
    });
    expect(screen.getByText('No gifts yet.')).toBeTruthy();
    expect(screen.queryByText('Could not load gifts.')).toBeNull();
    expect(screen.queryByText('Loading…')).toBeNull();
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

  it('fetches activity before the profile has a wallet', async () => {
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

  it('renders no loan chart when activity omits loan fields', async () => {
    fetchProfile.mockResolvedValue(profile);
    fetchActivity.mockResolvedValue(EMPTY_ACTIVITY);
    renderWithLocale(<ViewProfileLoader viewKey={VIEW_KEY} />);
    await waitFor(() => {
      expect(screen.getByText('Ada')).toBeTruthy();
    });
    expect(screen.queryByText('No loans yet.')).toBeNull();
    expect(screen.queryByRole('img', { name: 'Debt and credit in ₿' })).toBeNull();
    expect(screen.getByText('No gifts yet.')).toBeTruthy();
  });

  it('renders debt and credit legend when loan series are present', async () => {
    fetchProfile.mockResolvedValue(profile);
    fetchActivity.mockResolvedValue({
      ...EMPTY_ACTIVITY,
      owedSats: 100,
      creditSats: 50,
      owedOverTime: [
        {
          day: '2026-06-01',
          sats: 100,
          cumulativeSats: 100,
          btc: '0.00000100',
          cumulativeBtc: '0.00000100',
          usd: '0.10',
          cumulativeUsd: '0.10',
          chf: '0.08',
          eur: '0.09',
          php: '5.60',
          cumulativeChf: '0.08',
          cumulativeEur: '0.09',
          cumulativePhp: '5.60',
        },
      ],
      creditOverTime: [
        {
          day: '2026-06-01',
          sats: 50,
          cumulativeSats: 50,
          btc: '0.00000050',
          cumulativeBtc: '0.00000050',
          usd: '0.05',
          cumulativeUsd: '0.05',
          chf: '0.04',
          eur: '0.05',
          php: '2.80',
          cumulativeChf: '0.04',
          cumulativeEur: '0.05',
          cumulativePhp: '2.80',
        },
      ],
    });
    renderWithLocale(<ViewProfileLoader viewKey={VIEW_KEY} />);
    await waitFor(() => {
      expect(screen.getByText('Ada')).toBeTruthy();
    });
    expect(screen.getByText('Debt')).toBeTruthy();
    expect(screen.getByText('Credit')).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Debt and credit in ₿' })).toBeTruthy();
  });

  it('keeps the public card when a session cannot refetch the member', async () => {
    useAuthStore.setState({
      session: 'tok',
      account: {
        id: 'acc_other',
        linkingKey: null,
        role: 'basis',
        name: 'Ada',
        location: null,
        lightningAddress: null,
        lightningAddressVerified: false,
        forumLawsDismissed: true,
        createdAt: 1,
        rulesAgreedAt: 1,
        viewKey: VIEW_KEY,
        aboutMe: null,
        aboutMeHasPhoto: false,
        setup: null,
        missing: [],
      },
    });
    fetchProfile.mockResolvedValue({ ...profile, id: 'acc_1' });
    fetchSignedInMember.mockRejectedValue(new Error('down'));
    renderWithLocale(<ViewProfileLoader viewKey={VIEW_KEY} />);
    await waitFor(() => {
      expect(screen.getByText('Ada')).toBeTruthy();
    });
    expect(fetchActivity).toHaveBeenCalledWith(VIEW_KEY);
    expect(fetchSignedInActivity).not.toHaveBeenCalled();
  });

  it('uses the member series when the signed-in refetch succeeds', async () => {
    useAuthStore.setState({
      session: 'tok',
      account: {
        id: 'acc_other',
        linkingKey: null,
        role: 'basis',
        name: 'Ada',
        location: null,
        lightningAddress: null,
        lightningAddressVerified: false,
        forumLawsDismissed: true,
        createdAt: 1,
        rulesAgreedAt: 1,
        viewKey: VIEW_KEY,
        aboutMe: null,
        aboutMeHasPhoto: false,
        setup: null,
        missing: [],
      },
    });
    fetchProfile.mockResolvedValue({ ...profile, id: 'acc_1', postCount: 3 });
    fetchSignedInMember.mockResolvedValue({
      id: 'acc_1',
      name: 'Ada',
      username: 'alice',
      location: null,
      role: 'basis',
      lightningAddress: 'alice@21.gifts',
      createdAt: '1970-01-01T00:00:00.001Z',
      aboutMe: null,
      aboutMeHasPhoto: false,
      profileMessage: null,
      postCount: 3,
      replyCount: 0,
      trust: {
        verifiedBy: null,
        proposedBy: null,
        confirmedBy: null,
        appointedBy: null,
      },
    });
    fetchSignedInActivity.mockResolvedValue(EMPTY_ACTIVITY);
    renderWithLocale(<ViewProfileLoader viewKey={VIEW_KEY} />);
    await waitFor(() => {
      expect(screen.getByText('Ada')).toBeTruthy();
    });
    expect(fetchSignedInMember).toHaveBeenCalledWith('tok', 'acc_1');
    expect(fetchSignedInActivity).toHaveBeenCalledWith('tok', 'acc_1');
    expect(fetchActivity).not.toHaveBeenCalled();
  });

  it('loads a public post list from the view key', async () => {
    fetchProfile.mockResolvedValue({ ...profile, postCount: 1 });
    fetchActivity.mockResolvedValue(EMPTY_ACTIVITY);
    fetchPublicList.mockResolvedValue([]);
    renderWithLocale(<ViewProfileLoader viewKey={VIEW_KEY} />);
    await waitFor(() => {
      expect(screen.getByText('Ada')).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('button', { name: '1 post' }));
    await waitFor(() => {
      expect(fetchPublicList).toHaveBeenCalledWith(VIEW_KEY, 'posts');
    });
  });

  it('keeps the public card when the signed-in refetch returns null', async () => {
    useAuthStore.setState({
      session: 'tok',
      account: {
        id: 'acc_other',
        linkingKey: null,
        role: 'basis',
        name: 'Ada',
        location: null,
        lightningAddress: null,
        lightningAddressVerified: false,
        forumLawsDismissed: true,
        createdAt: 1,
        rulesAgreedAt: 1,
        viewKey: VIEW_KEY,
        aboutMe: null,
        aboutMeHasPhoto: false,
        setup: null,
        missing: [],
      },
    });
    fetchProfile.mockResolvedValue({ ...profile, id: 'acc_1' });
    fetchSignedInMember.mockResolvedValue(null);
    renderWithLocale(<ViewProfileLoader viewKey={VIEW_KEY} />);
    await waitFor(() => {
      expect(screen.getByText('Ada')).toBeTruthy();
    });
    expect(fetchActivity).toHaveBeenCalledWith(VIEW_KEY);
    expect(fetchSignedInActivity).not.toHaveBeenCalled();
  });

  it('does not refetch a member when the public payload has no id', async () => {
    useAuthStore.setState({
      session: 'tok',
      account: {
        id: 'acc_other',
        linkingKey: null,
        role: 'basis',
        name: 'Ada',
        location: null,
        lightningAddress: null,
        lightningAddressVerified: false,
        forumLawsDismissed: true,
        createdAt: 1,
        rulesAgreedAt: 1,
        viewKey: VIEW_KEY,
        aboutMe: null,
        aboutMeHasPhoto: false,
        setup: null,
        missing: [],
      },
    });
    fetchProfile.mockResolvedValue(profile);
    renderWithLocale(<ViewProfileLoader viewKey={VIEW_KEY} />);
    await waitFor(() => {
      expect(screen.getByText('Ada')).toBeTruthy();
    });
    expect(fetchSignedInMember).not.toHaveBeenCalled();
    expect(fetchActivity).toHaveBeenCalledWith(VIEW_KEY);
  });

  it('keeps the public card when member activity fails after a refetch', async () => {
    useAuthStore.setState({
      session: 'tok',
      account: {
        id: 'acc_other',
        linkingKey: null,
        role: 'basis',
        name: 'Ada',
        location: null,
        lightningAddress: null,
        lightningAddressVerified: false,
        forumLawsDismissed: true,
        createdAt: 1,
        rulesAgreedAt: 1,
        viewKey: VIEW_KEY,
        aboutMe: null,
        aboutMeHasPhoto: false,
        setup: null,
        missing: [],
      },
    });
    fetchProfile.mockResolvedValue({ ...profile, id: 'acc_1' });
    fetchSignedInMember.mockResolvedValue({
      id: 'acc_1',
      name: 'Ada',
      username: 'alice',
      location: null,
      role: 'basis',
      lightningAddress: 'alice@21.gifts',
      createdAt: '1970-01-01T00:00:00.001Z',
      aboutMe: null,
      aboutMeHasPhoto: false,
      profileMessage: null,
      postCount: 0,
      replyCount: 0,
      trust: {
        verifiedBy: null,
        proposedBy: null,
        confirmedBy: null,
        appointedBy: null,
      },
    });
    fetchSignedInActivity.mockRejectedValue(new Error('down'));
    renderWithLocale(<ViewProfileLoader viewKey={VIEW_KEY} />);
    await waitFor(() => {
      expect(screen.getByText('Could not load gifts.')).toBeTruthy();
    });
    expect(fetchActivity).not.toHaveBeenCalled();
  });

  it('ignores a member resolve after unmount', async () => {
    useAuthStore.setState({
      session: 'tok',
      account: {
        id: 'acc_other',
        linkingKey: null,
        role: 'basis',
        name: 'Ada',
        location: null,
        lightningAddress: null,
        lightningAddressVerified: false,
        forumLawsDismissed: true,
        createdAt: 1,
        rulesAgreedAt: 1,
        viewKey: VIEW_KEY,
        aboutMe: null,
        aboutMeHasPhoto: false,
        setup: null,
        missing: [],
      },
    });
    fetchProfile.mockResolvedValue({ ...profile, id: 'acc_1' });
    let resolveMember: ((value: null) => void) | undefined;
    fetchSignedInMember.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveMember = resolve;
        }),
    );
    const view = renderWithLocale(<ViewProfileLoader viewKey={VIEW_KEY} />);
    await waitFor(() => {
      expect(fetchSignedInMember).toHaveBeenCalled();
    });
    view.unmount();
    resolveMember?.(null);
    await Promise.resolve();
    expect(fetchSignedInActivity).not.toHaveBeenCalled();
  });

  it('ignores a loaded member after unmount', async () => {
    useAuthStore.setState({
      session: 'tok',
      account: {
        id: 'acc_other',
        linkingKey: null,
        role: 'basis',
        name: 'Ada',
        location: null,
        lightningAddress: null,
        lightningAddressVerified: false,
        forumLawsDismissed: true,
        createdAt: 1,
        rulesAgreedAt: 1,
        viewKey: VIEW_KEY,
        aboutMe: null,
        aboutMeHasPhoto: false,
        setup: null,
        missing: [],
      },
    });
    fetchProfile.mockResolvedValue({ ...profile, id: 'acc_1' });
    let resolveMember: ((value: MemberProfile) => void) | undefined;
    fetchSignedInMember.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveMember = resolve;
        }),
    );
    const view = renderWithLocale(<ViewProfileLoader viewKey={VIEW_KEY} />);
    await waitFor(() => {
      expect(fetchSignedInMember).toHaveBeenCalled();
    });
    view.unmount();
    resolveMember?.({
      id: 'acc_1',
      name: 'Ada',
      username: 'alice',
      location: null,
      role: 'basis',
      lightningAddress: null,
      createdAt: '1970-01-01T00:00:00.001Z',
      aboutMe: null,
      aboutMeHasPhoto: false,
      profileMessage: null,
      postCount: 0,
      replyCount: 0,
      trust: {
        verifiedBy: null,
        proposedBy: null,
        confirmedBy: null,
        appointedBy: null,
      },
    });
    await Promise.resolve();
    expect(fetchSignedInActivity).not.toHaveBeenCalled();
  });

  it('does not refetch a member when the public id is empty', async () => {
    useAuthStore.setState({
      session: 'tok',
      account: {
        id: 'acc_other',
        linkingKey: null,
        role: 'basis',
        name: 'Ada',
        location: null,
        lightningAddress: null,
        lightningAddressVerified: false,
        forumLawsDismissed: true,
        createdAt: 1,
        rulesAgreedAt: 1,
        viewKey: VIEW_KEY,
        aboutMe: null,
        aboutMeHasPhoto: false,
        setup: null,
        missing: [],
      },
    });
    fetchProfile.mockResolvedValue({ ...profile, id: '' });
    renderWithLocale(<ViewProfileLoader viewKey={VIEW_KEY} />);
    await waitFor(() => {
      expect(screen.getByText('Ada')).toBeTruthy();
    });
    expect(fetchSignedInMember).not.toHaveBeenCalled();
  });

  it('maps an unverified public card with counts and a staff tag', async () => {
    const { username, ...withoutUsername } = profile;
    void username;
    fetchProfile.mockResolvedValue({
      ...withoutUsername,
      lightningAddressVerified: false,
      shopCount: 1,
      creditCount: 1,
      staffTag: 'software_developer',
    });
    fetchActivity.mockResolvedValue(EMPTY_ACTIVITY);
    renderWithLocale(<ViewProfileLoader viewKey={VIEW_KEY} />);
    expect(await screen.findByText("Can't receive yet")).toBeTruthy();
    expect(screen.getByText('Software Developer')).toBeTruthy();
    expect(screen.getByRole('button', { name: '1 shop' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '1 credit' })).toBeTruthy();
    expect(screen.queryByText('alice@21.gifts')).toBeNull();
  });

  it('shows the funding reviewer from the public card', async () => {
    const admittedAt = Date.parse('2026-08-28T12:00:00.000Z');
    fetchProfile.mockResolvedValue({
      ...profile,
      fundingReviewedAt: admittedAt,
      fundingReviewedByName: 'Ada',
    });
    fetchActivity.mockResolvedValue(EMPTY_ACTIVITY);
    renderWithLocale(<ViewProfileLoader viewKey={VIEW_KEY} />);
    expect(await screen.findByRole('button', { name: /reviewed by Ada/ })).toBeTruthy();
  });

  it('ignores a member reject after unmount', async () => {
    useAuthStore.setState({
      session: 'tok',
      account: {
        id: 'acc_other',
        linkingKey: null,
        role: 'basis',
        name: 'Ada',
        location: null,
        lightningAddress: null,
        lightningAddressVerified: false,
        forumLawsDismissed: true,
        createdAt: 1,
        rulesAgreedAt: 1,
        viewKey: VIEW_KEY,
        aboutMe: null,
        aboutMeHasPhoto: false,
        setup: null,
        missing: [],
      },
    });
    fetchProfile.mockResolvedValue({ ...profile, id: 'acc_1' });
    let rejectMember: ((reason: Error) => void) | undefined;
    fetchSignedInMember.mockImplementationOnce(
      () =>
        new Promise((_, reject) => {
          rejectMember = reject;
        }),
    );
    const view = renderWithLocale(<ViewProfileLoader viewKey={VIEW_KEY} />);
    await waitFor(() => {
      expect(fetchSignedInMember).toHaveBeenCalled();
    });
    view.unmount();
    rejectMember?.(new Error('gone'));
    await Promise.resolve();
  });
});
