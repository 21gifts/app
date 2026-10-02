import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProfileScreen } from '@/components/ProfileScreen';
import {
  fetchAboutMePhoto,
  fetchAccountActivity,
  fetchMember,
  fetchProfilePhoto,
  fetchWideBanner,
  putAboutMe,
  putProfilePhoto,
  putWideBanner,
} from '@/lib/api';
import type { Account, AccountActivity, MemberProfile } from '@/lib/api-types';
import { prepareForumPhoto } from '@/lib/forum-photo';
import { MissingRequirementsError } from '@/lib/missing-requirements';
import { useAuthStore } from '@/stores/auth-store';
import { renderWithLocale } from '@/__tests__/render-with-locale';

const replace = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: (): { push: typeof replace; replace: typeof replace } => ({
    push: replace,
    replace,
  }),
  usePathname: (): string => '/',
  useSearchParams: (): URLSearchParams => new URLSearchParams(),
}));

vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
    [key: string]: unknown;
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

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
  fetchAccountActivity: vi.fn().mockResolvedValue({
    donatedSats: 0,
    receivedSats: 0,
    donatedOverTime: [],
    receivedOverTime: [],
    fx: {
      quote: 'BTC-USD',
      dayBasis: 'utc',
      source: 'coinbase-exchange-daily-close',
      quotes: [{ code: 'USD', pair: 'BTC-USD', source: 'coinbase-exchange-daily-close' }],
    },
  }),
  setName: vi.fn(),
  setLocation: vi.fn(),
  putAboutMe: vi.fn(),
  postFundingApply: vi.fn(),
  fetchAboutMePhoto: vi
    .fn()
    .mockResolvedValue(new Blob([new Uint8Array([1])], { type: 'image/jpeg' })),
  fetchProfilePhoto: vi.fn().mockRejectedValue(new Error('none')),
  fetchWideBanner: vi.fn().mockRejectedValue(new Error('none')),
  putProfilePhoto: vi.fn(),
  putWideBanner: vi.fn(),
  fetchMember: vi.fn(),
  fetchComposeTarget: vi.fn(),
  fetchGiftStats: vi.fn().mockResolvedValue({ spendOverTime: [] }),
  fetchMemberPosts: vi.fn().mockResolvedValue([]),
  fetchMemberReplies: vi.fn().mockResolvedValue([]),
  fetchMessagePhoto: vi.fn(),
  fetchPublicMessage: vi.fn(),
  fetchPublicMessagePhoto: vi.fn(),
  fetchReplies: vi.fn(),
  openConversation: vi.fn(),
  postMessage: vi.fn(),
  postMessageInvoice: vi.fn(),
  markNotificationsReadForMessage: vi.fn().mockResolvedValue({ ok: true, tags: [] }),
}));

vi.mock('@/components/WideImageCropper', () => ({
  WideImageCropper: ({
    file,
    busy,
    onConfirm,
    onCancel,
    onError,
  }: {
    file: File;
    busy?: boolean;
    onConfirm: (photo: { contentType: 'image/jpeg'; data: string }) => void;
    onCancel: () => void;
    onError: (error: 'unsupported' | 'tooLarge') => void;
  }) => (
    <div>
      <p>Drag the photo to choose the wide image</p>
      <span>{file.name}</span>
      <button
        type="button"
        disabled={busy}
        onClick={() => {
          onConfirm({ contentType: 'image/jpeg', data: 'wide' });
        }}
      >
        Use this crop
      </button>
      <button type="button" disabled={busy} onClick={onCancel}>
        Cancel crop
      </button>
      <button
        type="button"
        onClick={() => {
          onError('tooLarge');
        }}
      >
        Crop too large
      </button>
      <button
        type="button"
        onClick={() => {
          onError('unsupported');
        }}
      >
        Crop unsupported
      </button>
    </div>
  ),
}));

vi.mock('@/lib/forum-photo', () => ({
  prepareForumPhoto: vi.fn(),
  isForumPhotoFile: (file: File): boolean =>
    file.type === 'image/jpeg' || file.type === 'image/png' || file.type === 'image/webp',
}));

vi.mock('@/lib/push', () => ({
  enablePush: vi.fn(),
  disablePush: vi.fn(),
  isIosSafari: vi.fn().mockReturnValue(false),
  isStandaloneDisplay: vi.fn().mockReturnValue(false),
  registerPushWorker: vi.fn(),
  vapidPublicKeyToBytes: vi.fn(),
}));

let hydrateReady = true;

vi.mock('@/hooks/useHydrateSession', () => ({
  useHydrateSession: (): { ready: boolean } => ({ ready: hydrateReady }),
}));

const FX_ALL = {
  quote: 'BTC-USD' as const,
  dayBasis: 'utc' as const,
  source: 'coinbase-exchange-daily-close' as const,
  quotes: [
    { code: 'USD' as const, pair: 'BTC-USD', source: 'coinbase-exchange-daily-close' },
    { code: 'CHF' as const, pair: 'USD-CHF', source: 'ecb-daily' },
    { code: 'EUR' as const, pair: 'USD-EUR', source: 'ecb-daily' },
    { code: 'PHP' as const, pair: 'USD-PHP', source: 'ecb-daily' },
  ],
};

const VIEW_KEY = 'a'.repeat(64);

const OWN_MEMBER: MemberProfile = {
  id: 'acc_1',
  name: 'Ada',
  username: 'alice',
  location: null,
  role: 'verified',
  lightningAddress: null,
  createdAt: '2026-01-15T12:00:00.000Z',
  aboutMe: null,
  aboutMeHasPhoto: false,
  profileMessage: null,
  postCount: 14,
  replyCount: 0,
  fundingReviewedAt: null,
  trust: {
    verifiedBy: null,
    proposedBy: null,
    confirmedBy: null,
    appointedBy: null,
  },
};

beforeEach(() => {
  hydrateReady = true;
  replace.mockReset();
  vi.mocked(fetchAccountActivity).mockReset();
  vi.mocked(fetchAccountActivity).mockResolvedValue(EMPTY_ACTIVITY);
  vi.mocked(putAboutMe).mockReset();
  vi.mocked(fetchMember).mockReset();
  vi.mocked(fetchMember).mockReturnValue(new Promise(() => undefined));
  vi.mocked(fetchAboutMePhoto).mockReset();
  vi.mocked(fetchAboutMePhoto).mockResolvedValue(
    new Blob([new Uint8Array([1])], { type: 'image/jpeg' }),
  );
  vi.mocked(fetchProfilePhoto).mockReset();
  vi.mocked(fetchProfilePhoto).mockRejectedValue(new Error('none'));
  vi.mocked(fetchWideBanner).mockReset();
  vi.mocked(fetchWideBanner).mockRejectedValue(new Error('none'));
  vi.mocked(prepareForumPhoto).mockReset();
  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    writable: true,
    value: () => 'blob:about-me',
  });
  Object.defineProperty(URL, 'revokeObjectURL', {
    configurable: true,
    writable: true,
    value: () => undefined,
  });
  useAuthStore.setState({
    session: 'tok',
    account: {
      id: 'acc_1',
      linkingKey: null,
      role: 'basis',
      name: 'Ada',
      location: null,
      lightningAddress: null,
      lightningAddressVerified: false,
      forumLawsDismissed: false,
      createdAt: 1,
      rulesAgreedAt: 1_700_000_001,
      viewKey: VIEW_KEY,
      aboutMe: null,
      aboutMeHasPhoto: false,
      setup: null,
      missing: [],
    },
  });
});

afterEach(() => {
  cleanup();
  useAuthStore.setState({ session: null, account: null });
});

describe('ProfileScreen', () => {
  it('shows the heading, name form, chart, theme group, and number format group, without an address field', async () => {
    renderWithLocale(<ProfileScreen />);
    expect(screen.getByRole('heading', { name: 'Profile' })).toBeTruthy();
    expect(screen.getByText('Name')).toBeTruthy();
    expect(screen.getByText('Location')).toBeTruthy();
    expect(screen.queryByLabelText(/address/i)).toBeNull();
    expect(screen.queryByRole('button', { name: /link address/i })).toBeNull();
    expect(screen.queryByText('You are not verified yet.')).toBeNull();
    expect(screen.getByRole('group', { name: 'Language' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'English' }).getAttribute('aria-pressed')).toBe(
      'true',
    );
    expect(screen.getByRole('button', { name: 'Deutsch' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Español' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Filipino' })).toBeTruthy();
    expect(screen.getByRole('group', { name: 'Theme' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'System' }).getAttribute('aria-pressed')).toBe(
      'true',
    );
    expect(screen.getByRole('button', { name: 'Light' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Dark' })).toBeTruthy();
    expect(screen.getByRole('group', { name: 'Number format' })).toBeTruthy();
    expect(screen.getByRole('button', { name: "10'000.23" }).getAttribute('aria-pressed')).toBe(
      'true',
    );
    expect(screen.getByRole('button', { name: '10,000.23' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '23.000,33' })).toBeTruthy();
    expect(screen.getByText('No gifts yet.')).toBeTruthy();
    expect(screen.getAllByRole('group', { name: 'Fiat currency' })).toHaveLength(1);
    expect(screen.queryByRole('group', { name: 'Chart scale' })).toBeNull();
    expect(screen.queryByRole('img', { name: 'Given and received in ₿' })).toBeNull();
    expect(screen.queryByText('Loading…')).toBeNull();
    await waitFor(() => {
      expect(vi.mocked(fetchAccountActivity)).toHaveBeenCalledWith('tok');
    });
  });

  it('keeps the chart mounted with no Loading… while fetch is pending', () => {
    vi.mocked(fetchAccountActivity).mockReturnValue(new Promise<AccountActivity>(() => undefined));
    renderWithLocale(<ProfileScreen />);
    expect(screen.queryByText('Loading…')).toBeNull();
    expect(screen.getByText('No gifts yet.')).toBeTruthy();
    expect(screen.getAllByRole('group', { name: 'Fiat currency' })).toHaveLength(1);
    expect(screen.queryByRole('group', { name: 'Chart scale' })).toBeNull();
    expect(screen.queryByRole('img', { name: 'Given and received in ₿' })).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Given and received' })).toBeNull();
    expect(screen.queryByLabelText('Given ₿0')).toBeNull();
  });

  it('says the gifts could not be loaded when activity fails', async () => {
    vi.mocked(fetchAccountActivity).mockRejectedValue(new Error('down'));
    renderWithLocale(<ProfileScreen />);
    expect(await screen.findByText('Could not load gifts.')).toBeTruthy();
    expect(screen.queryByText('No gifts yet.')).toBeNull();
    expect(screen.queryByText('Loading…')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull();
  });

  it('shows a series day tick after activity loads', async () => {
    const seriesActivity: AccountActivity = {
      donatedSats: 0,
      receivedSats: 1500,
      donatedOverTime: [],
      receivedOverTime: [
        {
          day: '2026-06-01',
          sats: 500,
          cumulativeSats: 500,
          btc: '0.00000500',
          cumulativeBtc: '0.00000500',
          usd: '0.48',
          cumulativeUsd: '0.48',
          chf: '0.40',
          eur: '0.44',
          php: '27.00',
          cumulativeChf: '0.40',
          cumulativeEur: '0.44',
          cumulativePhp: '27.00',
        },
        {
          day: '2026-06-02',
          sats: 0,
          cumulativeSats: 500,
          btc: '0.00000000',
          cumulativeBtc: '0.00000500',
          usd: '0.00',
          cumulativeUsd: '0.48',
          chf: '0.00',
          eur: '0.00',
          php: '0.00',
          cumulativeChf: '0.40',
          cumulativeEur: '0.44',
          cumulativePhp: '27.00',
        },
        {
          day: '2026-06-03',
          sats: 1000,
          cumulativeSats: 1500,
          btc: '0.00001000',
          cumulativeBtc: '0.00001500',
          usd: '0.95',
          cumulativeUsd: '1.43',
          chf: '0.80',
          eur: '0.86',
          php: '53.00',
          cumulativeChf: '1.20',
          cumulativeEur: '1.30',
          cumulativePhp: '80.00',
        },
      ],
      fx: FX_ALL,
    };
    vi.mocked(fetchAccountActivity).mockResolvedValue(seriesActivity);
    renderWithLocale(<ProfileScreen />);
    await waitFor(() => {
      expect(screen.getByText('2026-06-01')).toBeTruthy();
    });
    expect(screen.queryByLabelText("Received ₿1'500")).toBeNull();
  });

  it('does not show a View key heading, view URL, or raw key', () => {
    renderWithLocale(<ProfileScreen />);
    expect(screen.queryByRole('heading', { name: 'View key' })).toBeNull();
    expect(screen.queryByText(`${window.location.origin}/view/${VIEW_KEY}`)).toBeNull();
    expect(screen.queryByText(VIEW_KEY)).toBeNull();
    expect(screen.queryByText(`/view/${VIEW_KEY}`)).toBeNull();
  });

  it('passes the About me message id into the readable bio', () => {
    const account = useAuthStore.getState().account;
    useAuthStore.setState({
      session: 'tok',
      account:
        account === null
          ? null
          : { ...account, aboutMe: 'Hello from Ada.', aboutMessageId: 'note-1' },
    });
    renderWithLocale(<ProfileScreen />);
    expect(screen.getByText('Hello from Ada.')).toBeTruthy();
  });

  it('shows the empty About me prompt and copy-link button when aboutMe is null', async () => {
    renderWithLocale(<ProfileScreen />);
    expect(screen.getByText('Tell others who you are.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Write your About me' })).toBeTruthy();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Copy link to this profile' })).toBeTruthy();
    });
  });

  it('saves About me and updates the store', async () => {
    const account = useAuthStore.getState().account as Account;
    vi.mocked(putAboutMe).mockResolvedValue({ ...account, aboutMe: 'Hello' });
    renderWithLocale(<ProfileScreen />);
    fireEvent.click(screen.getByRole('button', { name: 'Write your About me' }));
    fireEvent.change(screen.getByLabelText('About me'), { target: { value: 'Hello' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save About me' }));
    await waitFor(() => {
      expect(putAboutMe).toHaveBeenCalledWith('tok', 'Hello');
    });
    expect(useAuthStore.getState().account?.aboutMe).toBe('Hello');
    expect(useAuthStore.getState().account?.aboutMeHasPhoto).toBe(false);
  });

  it('stores the About me note id returned by a save and clears it when the response is null', async () => {
    const account = useAuthStore.getState().account as Account;
    vi.mocked(putAboutMe).mockResolvedValue({
      ...account,
      aboutMe: 'Hello',
      aboutMessageId: 'note-1',
    });
    renderWithLocale(<ProfileScreen />);
    fireEvent.click(screen.getByRole('button', { name: 'Write your About me' }));
    fireEvent.change(screen.getByLabelText('About me'), { target: { value: 'Hello' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save About me' }));
    await waitFor(() => {
      expect(useAuthStore.getState().account?.aboutMessageId).toBe('note-1');
    });
    vi.mocked(putAboutMe).mockResolvedValue({
      ...account,
      aboutMe: 'Gone',
      aboutMessageId: null,
    });
    fireEvent.click(screen.getByRole('button', { name: 'Edit About me' }));
    fireEvent.change(screen.getByLabelText('About me'), { target: { value: 'Gone' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save About me' }));
    await waitFor(() => {
      expect(useAuthStore.getState().account?.aboutMessageId).toBeNull();
    });
  });

  it('keeps the stored About me note id when a save omits it or sends a blank id', async () => {
    const account = useAuthStore.getState().account as Account;
    useAuthStore.setState({ account: { ...account, aboutMessageId: 'note-1' } });
    vi.mocked(putAboutMe).mockResolvedValue({ ...account, aboutMe: 'Hello', aboutMessageId: '' });
    renderWithLocale(<ProfileScreen />);
    fireEvent.click(screen.getByRole('button', { name: 'Write your About me' }));
    fireEvent.change(screen.getByLabelText('About me'), { target: { value: 'Hello' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save About me' }));
    await waitFor(() => {
      expect(useAuthStore.getState().account?.aboutMe).toBe('Hello');
    });
    expect(useAuthStore.getState().account?.aboutMessageId).toBe('note-1');
  });

  it('saves About me with an attached JPEG and writes aboutMeHasPhoto onto the store', async () => {
    const account = useAuthStore.getState().account as Account;
    vi.mocked(prepareForumPhoto).mockResolvedValue({
      ok: true,
      photo: {
        contentType: 'image/jpeg',
        data: 'abc',
        previewUrl: 'data:image/jpeg;base64,abc',
      },
    });
    vi.mocked(putAboutMe).mockResolvedValue({
      ...account,
      aboutMe: 'Hello',
      aboutMeHasPhoto: true,
    });
    renderWithLocale(<ProfileScreen />);
    fireEvent.click(screen.getByRole('button', { name: 'Write your About me' }));
    fireEvent.change(screen.getByLabelText('About me'), { target: { value: 'Hello' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add a photo' }));
    const aboutInput = [...document.querySelectorAll('input[type="file"]')].find(
      (input) => input.getAttribute('name') === null,
    );
    fireEvent.change(aboutInput as HTMLInputElement, {
      target: {
        files: [new File([new Uint8Array([0xff, 0xd8, 0xff])], 'shot.jpg', { type: 'image/jpeg' })],
      },
    });
    await waitFor(() => {
      expect(screen.getByAltText('Selected photo')).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save About me' }));
    await waitFor(() => {
      expect(putAboutMe).toHaveBeenCalledWith('tok', 'Hello', {
        contentType: 'image/jpeg',
        data: 'abc',
      });
    });
    expect(useAuthStore.getState().account?.aboutMe).toBe('Hello');
    expect(useAuthStore.getState().account?.aboutMeHasPhoto).toBe(true);
  });

  it('clears the About me photo and writes aboutMeHasPhoto false onto the store', async () => {
    const account = useAuthStore.getState().account as Account;
    useAuthStore.setState({
      account: { ...account, aboutMe: 'Kept.', aboutMeHasPhoto: true },
    });
    vi.mocked(fetchAboutMePhoto).mockResolvedValue(
      new Blob([new Uint8Array([0xff, 0xd8, 0xff])], { type: 'image/jpeg' }),
    );
    vi.mocked(putAboutMe).mockResolvedValue({
      ...account,
      aboutMe: 'Kept.',
      aboutMeHasPhoto: false,
    });
    renderWithLocale(<ProfileScreen />);
    await waitFor(() => {
      expect(screen.getByAltText('About me photo')).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Edit About me' }));
    fireEvent.click(screen.getByRole('button', { name: 'Remove photo' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save About me' }));
    await waitFor(() => {
      expect(putAboutMe).toHaveBeenCalledWith('tok', 'Kept.', null);
    });
    expect(useAuthStore.getState().account?.aboutMe).toBe('Kept.');
    expect(useAuthStore.getState().account?.aboutMeHasPhoto).toBe(false);
  });

  it('drops the About me result when the account was cleared mid-flight', async () => {
    const account = useAuthStore.getState().account as Account;
    let resolveUpdated!: (value: Account) => void;
    const pending = new Promise<Account>((resolve) => {
      resolveUpdated = resolve;
    });
    vi.mocked(putAboutMe).mockReturnValue(pending);
    renderWithLocale(<ProfileScreen />);
    fireEvent.click(screen.getByRole('button', { name: 'Write your About me' }));
    fireEvent.change(screen.getByLabelText('About me'), { target: { value: 'Hello' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save About me' }));

    act(() => {
      useAuthStore.setState({ account: null });
    });

    await act(async () => {
      resolveUpdated({ ...account, aboutMe: 'Hello' });
    });

    expect(useAuthStore.getState().account).toBeNull();
  });

  it('drops the About me result when the session changed mid-flight', async () => {
    const account = useAuthStore.getState().account as Account;
    let resolveUpdated!: (value: Account) => void;
    const pending = new Promise<Account>((resolve) => {
      resolveUpdated = resolve;
    });
    vi.mocked(putAboutMe).mockReturnValue(pending);
    renderWithLocale(<ProfileScreen />);
    fireEvent.click(screen.getByRole('button', { name: 'Write your About me' }));
    fireEvent.change(screen.getByLabelText('About me'), { target: { value: 'Hello' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save About me' }));

    act(() => {
      useAuthStore.setState({ session: 'other' });
    });

    await act(async () => {
      resolveUpdated({ ...account, aboutMe: 'Hello' });
    });

    expect(useAuthStore.getState().account?.aboutMe).toBeNull();
    expect(screen.getByRole('textbox', { name: 'About me' })).toBeTruthy();
  });

  it('does not redirect to setup/rules when putAboutMe throws MissingRequirementsError after the session changed', async () => {
    let rejectUpdated!: (reason: unknown) => void;
    const pending = new Promise<Account>((_resolve, reject) => {
      rejectUpdated = reject;
    });
    vi.mocked(putAboutMe).mockReturnValue(pending);
    renderWithLocale(<ProfileScreen />);
    fireEvent.click(screen.getByRole('button', { name: 'Write your About me' }));
    fireEvent.change(screen.getByLabelText('About me'), { target: { value: 'Hello' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save About me' }));

    act(() => {
      useAuthStore.setState({ session: 'other' });
    });

    await act(async () => {
      rejectUpdated(new MissingRequirementsError(['name']));
    });

    expect(replace).not.toHaveBeenCalled();
  });

  it('does not redirect when putAboutMe throws MissingRequirementsError for a missing name', async () => {
    vi.mocked(putAboutMe).mockRejectedValue(new MissingRequirementsError(['name']));
    renderWithLocale(<ProfileScreen />);
    fireEvent.click(screen.getByRole('button', { name: 'Write your About me' }));
    fireEvent.change(screen.getByLabelText('About me'), { target: { value: 'Hello' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save About me' }));
    await waitFor(() => {
      expect(putAboutMe).toHaveBeenCalled();
    });
    expect(replace).not.toHaveBeenCalled();
    expect(screen.getByLabelText('About me')).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('redirects to setup/rules when putAboutMe throws MissingRequirementsError', async () => {
    vi.mocked(putAboutMe).mockRejectedValue(new MissingRequirementsError(['rules']));
    renderWithLocale(<ProfileScreen />);
    fireEvent.click(screen.getByRole('button', { name: 'Write your About me' }));
    fireEvent.change(screen.getByLabelText('About me'), { target: { value: 'Hello' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save About me' }));
    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith('/setup/rules');
    });
    expect(screen.queryByRole('alert')).toBeNull();
    expect(useAuthStore.getState().account?.aboutMe).toBeNull();
  });

  it('shows the About me error when putAboutMe fails for another reason', async () => {
    vi.mocked(putAboutMe).mockRejectedValue(new Error('network'));
    renderWithLocale(<ProfileScreen />);
    fireEvent.click(screen.getByRole('button', { name: 'Write your About me' }));
    fireEvent.change(screen.getByLabelText('About me'), { target: { value: 'Hello' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save About me' }));
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.getByText('Could not save. Please try again.')).toBeTruthy();
  });

  it('shows the public gifts address, shop sticker, and post count after fetchMember', async () => {
    vi.mocked(fetchMember).mockResolvedValue(OWN_MEMBER);
    renderWithLocale(<ProfileScreen />);
    expect(await screen.findByText('alice@21.gifts')).toBeTruthy();
    expect(await screen.findByRole('button', { name: 'Shop sticker' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '14 posts' })).toBeTruthy();
  });

  it('hides Software Developer on the embedded facts card even when fetchMember returns the staff tag', async () => {
    vi.mocked(fetchMember).mockResolvedValue({
      ...OWN_MEMBER,
      role: 'basis',
      staffTag: 'software_developer',
    });
    renderWithLocale(<ProfileScreen />);
    expect(await screen.findByText('alice@21.gifts')).toBeTruthy();
    expect(screen.queryByText('Software Developer')).toBeNull();
  });

  it('shows forum.error and keeps the name editor when fetchMember rejects, and retry fetches again', async () => {
    vi.mocked(fetchMember).mockRejectedValue(new Error('network'));
    renderWithLocale(<ProfileScreen />);
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.getByText('Could not load messages. Please try again.')).toBeTruthy();
    expect(screen.getByText('Name')).toBeTruthy();
    expect(fetchMember).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() => {
      expect(fetchMember).toHaveBeenCalledTimes(2);
    });
  });

  it('redirects to setup/rules when fetchMember throws MissingRequirementsError', async () => {
    vi.mocked(fetchMember).mockRejectedValue(new MissingRequirementsError(['rules']));
    renderWithLocale(<ProfileScreen />);
    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith('/setup/rules');
    });
  });

  it('shows the retry alert when fetchMember returns null', async () => {
    vi.mocked(fetchMember).mockResolvedValue(null);
    renderWithLocale(<ProfileScreen />);
    expect(await screen.findByText('Could not load messages. Please try again.')).toBeTruthy();
  });

  it('ignores a member profile that arrives after unmount', async () => {
    let resolveMember: (value: MemberProfile) => void = () => undefined;
    vi.mocked(fetchMember).mockReturnValue(
      new Promise((resolve) => {
        resolveMember = resolve;
      }),
    );
    const view = renderWithLocale(<ProfileScreen />);
    view.unmount();
    await act(async () => {
      resolveMember(OWN_MEMBER);
    });
    expect(screen.queryByText('alice@21.gifts')).toBeNull();
  });

  it('does not fetch a member profile without a session', () => {
    useAuthStore.setState({ session: null, account: null });
    renderWithLocale(<ProfileScreen />);
    expect(fetchMember).not.toHaveBeenCalled();
    expect(screen.getByRole('heading', { name: 'Profile' })).toBeTruthy();
  });

  it('does not fetch a member profile when the account is missing', () => {
    useAuthStore.setState({ session: 'tok', account: null });
    renderWithLocale(<ProfileScreen />);
    expect(fetchMember).not.toHaveBeenCalled();
  });

  it('shows the wide image and the round profile photo as two pictures', async () => {
    vi.mocked(fetchProfilePhoto).mockResolvedValue(
      new Blob([new Uint8Array([1])], { type: 'image/jpeg' }),
    );
    vi.mocked(fetchWideBanner).mockResolvedValue(
      new Blob([new Uint8Array([2])], { type: 'image/png' }),
    );
    renderWithLocale(<ProfileScreen />);
    const portrait = await screen.findByAltText('Profile photo');
    const banner = await screen.findByAltText('Wide profile image');
    expect(portrait.className).toContain('rounded-full');
    expect(portrait.className).toContain('absolute');
    expect(banner.className).toContain('aspect-[5/2]');
    expect(screen.queryByRole('button', { name: 'Add a profile photo' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Add a wide image' })).toBeNull();
    expect(screen.queryByAltText('About me photo')).toBeNull();
  });

  it('shows only the round profile photo when the wide image is missing', async () => {
    vi.mocked(fetchProfilePhoto).mockResolvedValue(
      new Blob([new Uint8Array([1])], { type: 'image/jpeg' }),
    );
    renderWithLocale(<ProfileScreen />);
    const portrait = await screen.findByAltText('Profile photo');
    expect(portrait.className).toContain('mx-auto');
    expect(portrait.className).not.toContain('absolute');
    expect(screen.queryByAltText('Wide profile image')).toBeNull();
    expect(await screen.findByRole('button', { name: 'Add a wide image' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Add a profile photo' })).toBeNull();
  });

  it('shows only the wide image when the profile photo is missing', async () => {
    vi.mocked(fetchWideBanner).mockResolvedValue(
      new Blob([new Uint8Array([2])], { type: 'image/png' }),
    );
    renderWithLocale(<ProfileScreen />);
    expect(await screen.findByAltText('Wide profile image')).toBeTruthy();
    expect(screen.queryByAltText('Profile photo')).toBeNull();
    expect(await screen.findByRole('button', { name: 'Add a profile photo' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Add a wide image' })).toBeNull();
  });

  it('ignores a profile response that is not an image', async () => {
    vi.mocked(fetchProfilePhoto).mockResolvedValue(
      new Blob([new Uint8Array([1])], { type: 'application/json' }),
    );
    vi.mocked(fetchWideBanner).mockResolvedValue(new Blob([], { type: 'image/jpeg' }));
    renderWithLocale(<ProfileScreen />);
    await waitFor(() => {
      expect(fetchProfilePhoto).toHaveBeenCalled();
      expect(fetchWideBanner).toHaveBeenCalled();
    });
    expect(await screen.findByRole('button', { name: 'Add a profile photo' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Add a wide image' })).toBeTruthy();
    expect(screen.queryByAltText('Profile photo')).toBeNull();
    expect(screen.queryByAltText('Wide profile image')).toBeNull();
    cleanup();
    vi.mocked(fetchProfilePhoto).mockResolvedValue(new Blob([], { type: 'image/jpeg' }));
    vi.mocked(fetchWideBanner).mockResolvedValue(
      new Blob([new Uint8Array([1])], { type: 'application/json' }),
    );
    renderWithLocale(<ProfileScreen />);
    await waitFor(() => {
      expect(fetchWideBanner).toHaveBeenCalled();
    });
    expect(await screen.findByRole('button', { name: 'Add a profile photo' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Add a wide image' })).toBeTruthy();
    expect(screen.queryByAltText('Profile photo')).toBeNull();
    expect(screen.queryByAltText('Wide profile image')).toBeNull();
  });

  it('offers a button for each missing picture', async () => {
    renderWithLocale(<ProfileScreen />);
    expect(await screen.findByRole('button', { name: 'Add a wide image' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Add a profile photo' })).toBeTruthy();
    expect(screen.queryByAltText('Profile photo')).toBeNull();
    expect(screen.queryByAltText('Wide profile image')).toBeNull();
  });

  it('revokes a loaded picture on unmount and ignores one that arrives later', async () => {
    const revoke = vi.fn();
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      writable: true,
      value: revoke,
    });
    let resolvePicture: (blob: Blob) => void = () => undefined;
    let resolveBanner: (blob: Blob) => void = () => undefined;
    vi.mocked(fetchProfilePhoto).mockReturnValue(
      new Promise((resolve) => {
        resolvePicture = resolve;
      }),
    );
    vi.mocked(fetchWideBanner).mockReturnValue(
      new Promise((resolve) => {
        resolveBanner = resolve;
      }),
    );
    const view = renderWithLocale(<ProfileScreen />);
    await waitFor(() => {
      expect(fetchProfilePhoto).toHaveBeenCalled();
    });
    await act(async () => {
      resolvePicture(new Blob([new Uint8Array([1])], { type: 'image/jpeg' }));
      resolveBanner(new Blob([new Uint8Array([2])], { type: 'image/png' }));
    });
    expect(await screen.findByAltText('Profile photo')).toBeTruthy();
    expect(await screen.findByAltText('Wide profile image')).toBeTruthy();
    view.unmount();
    expect(revoke).toHaveBeenCalledTimes(2);
  });

  it('does not keep a picture that resolves after unmount', async () => {
    let resolvePicture: (blob: Blob) => void = () => undefined;
    let resolveBanner: (blob: Blob) => void = () => undefined;
    vi.mocked(fetchProfilePhoto).mockReturnValue(
      new Promise((resolve) => {
        resolvePicture = resolve;
      }),
    );
    vi.mocked(fetchWideBanner).mockReturnValue(
      new Promise((resolve) => {
        resolveBanner = resolve;
      }),
    );
    const view = renderWithLocale(<ProfileScreen />);
    view.unmount();
    await act(async () => {
      resolvePicture(new Blob([new Uint8Array([1])], { type: 'image/jpeg' }));
      resolveBanner(new Blob([new Uint8Array([2])], { type: 'image/png' }));
    });
    expect(screen.queryByAltText('Profile photo')).toBeNull();
    expect(screen.queryByAltText('Wide profile image')).toBeNull();
  });

  it('saves the profile photo and the wide image from their own controls', async () => {
    vi.mocked(prepareForumPhoto).mockResolvedValue({
      ok: true,
      photo: {
        contentType: 'image/jpeg',
        data: 'pic',
        previewUrl: 'data:image/jpeg;base64,pic',
      },
    });
    vi.mocked(putProfilePhoto).mockResolvedValue(undefined);
    vi.mocked(putWideBanner).mockResolvedValue(undefined);
    renderWithLocale(<ProfileScreen />);
    fireEvent.click(screen.getByRole('button', { name: 'Write your About me' }));
    const inputs = [...document.querySelectorAll('input[type="file"]')].filter(
      (input) => input.getAttribute('name') === null,
    );
    const file = new File([new Uint8Array([0xff, 0xd8, 0xff])], 'shot.jpg', {
      type: 'image/jpeg',
    });
    fireEvent.change(inputs[1] as HTMLInputElement, { target: { files: [file] } });
    await waitFor(() => {
      expect(putProfilePhoto).toHaveBeenCalledWith('tok', {
        contentType: 'image/jpeg',
        data: 'pic',
      });
    });
    fireEvent.change(inputs[2] as HTMLInputElement, { target: { files: [file] } });
    expect(prepareForumPhoto).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Use this crop' }));
    await waitFor(() => {
      expect(putWideBanner).toHaveBeenCalledWith('tok', {
        contentType: 'image/jpeg',
        data: 'wide',
      });
    });
  });

  it('saves a profile photo from the empty-slot button', async () => {
    vi.mocked(prepareForumPhoto).mockResolvedValue({
      ok: true,
      photo: {
        contentType: 'image/jpeg',
        data: 'pic',
        previewUrl: 'data:image/jpeg;base64,pic',
      },
    });
    vi.mocked(putProfilePhoto).mockResolvedValue(undefined);
    renderWithLocale(<ProfileScreen />);
    await screen.findByRole('button', { name: 'Add a profile photo' });
    const input = document.querySelector('input[name="profile-photo"]');
    const file = new File([new Uint8Array([0xff, 0xd8, 0xff])], 'shot.jpg', {
      type: 'image/jpeg',
    });
    fireEvent.change(input as HTMLInputElement, { target: { files: [file] } });
    await waitFor(() => {
      expect(prepareForumPhoto).toHaveBeenCalledWith(file);
      expect(putProfilePhoto).toHaveBeenCalledWith('tok', {
        contentType: 'image/jpeg',
        data: 'pic',
      });
    });
  });

  it('frames a wide image from the empty-slot button instead of rejecting it', async () => {
    vi.mocked(putWideBanner).mockClear();
    renderWithLocale(<ProfileScreen />);
    await screen.findByRole('button', { name: 'Add a wide image' });
    const input = document.querySelector('input[name="profile-banner"]');
    const file = new File([new Uint8Array([0xff, 0xd8, 0xff])], 'tall.jpg', {
      type: 'image/jpeg',
    });
    fireEvent.change(input as HTMLInputElement, { target: { files: [file] } });
    expect(screen.getByText('Drag the photo to choose the wide image')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Add a wide image' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Add a profile photo' })).toBeTruthy();
    expect(prepareForumPhoto).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel crop' }));
    expect(screen.getByRole('button', { name: 'Add a wide image' })).toBeTruthy();
    expect(putWideBanner).not.toHaveBeenCalled();

    fireEvent.change(input as HTMLInputElement, { target: { files: [file] } });
    fireEvent.click(screen.getByRole('button', { name: 'Crop too large' }));
    expect(screen.getByRole('alert').textContent).toBe('Keep photos under 1 MB');
    expect(screen.getByRole('button', { name: 'Use this crop' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Crop unsupported' }));
    expect(screen.getByRole('alert').textContent).toBe('Use a JPEG, PNG, or WebP photo');
    expect(screen.queryByRole('button', { name: 'Use this crop' })).toBeNull();

    vi.mocked(putWideBanner).mockResolvedValue(undefined);
    fireEvent.change(input as HTMLInputElement, { target: { files: [file] } });
    fireEvent.click(screen.getByRole('button', { name: 'Use this crop' }));
    await waitFor(() => {
      expect(putWideBanner).toHaveBeenCalledWith('tok', {
        contentType: 'image/jpeg',
        data: 'wide',
      });
    });
    vi.mocked(putWideBanner).mockRejectedValueOnce(new Error('no'));
    const again = document.querySelector('input[name="profile-banner"]');
    fireEvent.change(again as HTMLInputElement, { target: { files: [file] } });
    fireEvent.click(screen.getByRole('button', { name: 'Use this crop' }));
    expect(await screen.findByText('Could not save. Please try again.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Use this crop' })).toBeTruthy();
  });

  it('ignores an empty file choice and explains a bad or failed save', async () => {
    vi.mocked(prepareForumPhoto).mockClear();
    renderWithLocale(<ProfileScreen />);
    const photoButton = await screen.findByRole('button', { name: 'Add a profile photo' });
    const bannerButton = screen.getByRole('button', { name: 'Add a wide image' });
    fireEvent.click(photoButton);
    fireEvent.click(bannerButton);
    const photoInput = document.querySelector('input[name="profile-photo"]') as HTMLInputElement;
    const bannerInput = document.querySelector('input[name="profile-banner"]') as HTMLInputElement;
    fireEvent.change(photoInput, { target: { files: [] } });
    fireEvent.change(bannerInput, { target: { files: [] } });
    expect(prepareForumPhoto).not.toHaveBeenCalled();
    const gif = new File([new Uint8Array([1])], 'note.gif', { type: 'image/gif' });
    fireEvent.change(bannerInput, { target: { files: [gif] } });
    expect(await screen.findByText('Use a JPEG, PNG, or WebP photo')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Use this crop' })).toBeNull();
    vi.mocked(prepareForumPhoto).mockResolvedValue({ ok: false, error: 'tooLarge' });
    const file = new File([new Uint8Array([1])], 'big.jpg', { type: 'image/jpeg' });
    fireEvent.change(photoInput, { target: { files: [file] } });
    expect(await screen.findByText('Keep photos under 1 MB')).toBeTruthy();
    vi.mocked(prepareForumPhoto).mockResolvedValue({ ok: false, error: 'unsupported' });
    fireEvent.change(photoInput, { target: { files: [file] } });
    expect(await screen.findByText('Use a JPEG, PNG, or WebP photo')).toBeTruthy();
    vi.mocked(prepareForumPhoto).mockResolvedValue({
      ok: true,
      photo: { contentType: 'image/jpeg', data: 'pic', previewUrl: 'data:image/jpeg;base64,pic' },
    });
    vi.mocked(putProfilePhoto).mockRejectedValue(new Error('no'));
    fireEvent.change(photoInput, { target: { files: [file] } });
    expect(await screen.findByText('Could not save. Please try again.')).toBeTruthy();
  });

  it('ignores a profile-photo choice while the wide image is saving', async () => {
    let releaseBanner: () => void = () => undefined;
    vi.mocked(putProfilePhoto).mockClear();
    vi.mocked(putWideBanner).mockClear();
    vi.mocked(prepareForumPhoto).mockClear();
    vi.mocked(putWideBanner).mockReturnValue(
      new Promise((resolve) => {
        releaseBanner = () => {
          resolve(undefined);
        };
      }),
    );
    renderWithLocale(<ProfileScreen />);
    await screen.findByRole('button', { name: 'Add a wide image' });
    const bannerInput = document.querySelector('input[name="profile-banner"]') as HTMLInputElement;
    const photoInput = document.querySelector('input[name="profile-photo"]') as HTMLInputElement;
    const wide = new File([new Uint8Array([0xff, 0xd8, 0xff])], 'tall.jpg', {
      type: 'image/jpeg',
    });
    const portrait = new File([new Uint8Array([1])], 'face.jpg', { type: 'image/jpeg' });
    fireEvent.change(bannerInput, { target: { files: [wide] } });
    fireEvent.click(screen.getByRole('button', { name: 'Use this crop' }));
    await waitFor(() => {
      expect(putWideBanner).toHaveBeenCalledTimes(1);
    });
    fireEvent.change(photoInput, { target: { files: [portrait] } });
    fireEvent.change(bannerInput, { target: { files: [portrait] } });
    expect(prepareForumPhoto).not.toHaveBeenCalled();
    expect(putProfilePhoto).not.toHaveBeenCalled();
    expect(screen.getByText('tall.jpg')).toBeTruthy();
    expect(
      (screen.getByRole('button', { name: 'Use this crop' }) as HTMLButtonElement).disabled,
    ).toBe(true);
    await act(async () => {
      releaseBanner();
    });
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Use this crop' })).toBeNull();
    });
    expect(putWideBanner).toHaveBeenCalledTimes(1);
  });

  it('ignores a wide-image choice while the profile photo is saving', async () => {
    let releasePicture: () => void = () => undefined;
    vi.mocked(putProfilePhoto).mockClear();
    vi.mocked(putWideBanner).mockClear();
    vi.mocked(prepareForumPhoto).mockResolvedValue({
      ok: true,
      photo: { contentType: 'image/jpeg', data: 'pic', previewUrl: 'data:image/jpeg;base64,pic' },
    });
    vi.mocked(putProfilePhoto).mockReturnValue(
      new Promise((resolve) => {
        releasePicture = () => {
          resolve(undefined);
        };
      }),
    );
    renderWithLocale(<ProfileScreen />);
    await screen.findByRole('button', { name: 'Add a profile photo' });
    const bannerInput = document.querySelector('input[name="profile-banner"]') as HTMLInputElement;
    const photoInput = document.querySelector('input[name="profile-photo"]') as HTMLInputElement;
    const file = new File([new Uint8Array([0xff, 0xd8, 0xff])], 'tall.jpg', {
      type: 'image/jpeg',
    });
    fireEvent.change(photoInput, { target: { files: [file] } });
    await waitFor(() => {
      expect(putProfilePhoto).toHaveBeenCalledTimes(1);
    });
    fireEvent.change(bannerInput, { target: { files: [file] } });
    expect(screen.queryByRole('button', { name: 'Use this crop' })).toBeNull();
    expect(putWideBanner).not.toHaveBeenCalled();
    await act(async () => {
      releasePicture();
    });
    expect(await screen.findByRole('button', { name: 'Add a wide image' })).toBeTruthy();
  });

  it('keeps the chosen wide image when only the profile photo is saved', async () => {
    vi.mocked(putProfilePhoto).mockClear();
    vi.mocked(putWideBanner).mockClear();
    vi.mocked(prepareForumPhoto).mockResolvedValue({
      ok: true,
      photo: { contentType: 'image/jpeg', data: 'pic', previewUrl: 'data:image/jpeg;base64,pic' },
    });
    vi.mocked(putProfilePhoto).mockResolvedValue(undefined);
    renderWithLocale(<ProfileScreen />);
    await screen.findByRole('button', { name: 'Add a wide image' });
    const bannerInput = document.querySelector('input[name="profile-banner"]') as HTMLInputElement;
    const photoInput = document.querySelector('input[name="profile-photo"]') as HTMLInputElement;
    const file = new File([new Uint8Array([0xff, 0xd8, 0xff])], 'tall.jpg', {
      type: 'image/jpeg',
    });
    fireEvent.change(bannerInput, { target: { files: [file] } });
    fireEvent.change(photoInput, { target: { files: [file] } });
    await waitFor(() => {
      expect(putProfilePhoto).toHaveBeenCalledTimes(1);
    });
    expect(screen.getByText('tall.jpg')).toBeTruthy();
    expect(
      (screen.getByRole('button', { name: 'Use this crop' }) as HTMLButtonElement).disabled,
    ).toBe(false);
    expect(putWideBanner).not.toHaveBeenCalled();
  });

  it('keeps the header crop when About me saves the profile photo', async () => {
    vi.mocked(putProfilePhoto).mockClear();
    vi.mocked(putWideBanner).mockClear();
    vi.mocked(prepareForumPhoto).mockResolvedValue({
      ok: true,
      photo: { contentType: 'image/jpeg', data: 'pic', previewUrl: 'data:image/jpeg;base64,pic' },
    });
    vi.mocked(putProfilePhoto).mockResolvedValue(undefined);
    renderWithLocale(<ProfileScreen />);
    await screen.findByRole('button', { name: 'Add a wide image' });
    const bannerInput = document.querySelector('input[name="profile-banner"]') as HTMLInputElement;
    const wide = new File([new Uint8Array([0xff, 0xd8, 0xff])], 'header.jpg', {
      type: 'image/jpeg',
    });
    fireEvent.change(bannerInput, { target: { files: [wide] } });
    fireEvent.click(screen.getByRole('button', { name: 'Write your About me' }));
    const aboutPicture = [...document.querySelectorAll('input[type="file"]')].filter(
      (input) => input.getAttribute('name') === null,
    )[1] as HTMLInputElement;
    const portrait = new File([new Uint8Array([0xff, 0xd8, 0xff])], 'face.jpg', {
      type: 'image/jpeg',
    });
    fireEvent.change(aboutPicture, { target: { files: [portrait] } });
    await waitFor(() => {
      expect(putProfilePhoto).toHaveBeenCalledTimes(1);
    });
    expect(screen.getByText('header.jpg')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Use this crop' })).toBeTruthy();
    expect(putWideBanner).not.toHaveBeenCalled();
  });

  it('replaces a stored picture only after the reloaded one is ready', async () => {
    let created = 0;
    const revoke = vi.fn();
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      writable: true,
      value: (): string => {
        created += 1;
        return `blob:slot-${created}`;
      },
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      writable: true,
      value: revoke,
    });
    vi.mocked(fetchProfilePhoto).mockResolvedValue(
      new Blob([new Uint8Array([1])], { type: 'image/jpeg' }),
    );
    vi.mocked(fetchWideBanner).mockResolvedValue(
      new Blob([new Uint8Array([2])], { type: 'image/png' }),
    );
    renderWithLocale(<ProfileScreen />);
    expect((await screen.findByAltText('Profile photo')).getAttribute('src')).toBe('blob:slot-1');
    expect(screen.getByAltText('Wide profile image').getAttribute('src')).toBe('blob:slot-2');
    vi.mocked(prepareForumPhoto).mockResolvedValue({
      ok: true,
      photo: { contentType: 'image/jpeg', data: 'pic', previewUrl: 'data:image/jpeg;base64,pic' },
    });
    vi.mocked(putProfilePhoto).mockResolvedValue(undefined);
    vi.mocked(fetchProfilePhoto).mockResolvedValue(
      new Blob([new Uint8Array([3])], { type: 'image/jpeg' }),
    );
    vi.mocked(fetchWideBanner).mockResolvedValue(
      new Blob([new Uint8Array([4])], { type: 'image/png' }),
    );
    const photoInput = document.querySelector('input[name="profile-photo"]') as HTMLInputElement;
    fireEvent.change(photoInput, {
      target: {
        files: [new File([new Uint8Array([1])], 'face.jpg', { type: 'image/jpeg' })],
      },
    });
    await waitFor(() => {
      expect(screen.getByAltText('Profile photo').getAttribute('src')).toBe('blob:slot-3');
    });
    expect(screen.getByAltText('Wide profile image').getAttribute('src')).toBe('blob:slot-4');
    expect(revoke).toHaveBeenCalledWith('blob:slot-1');
    expect(revoke).toHaveBeenCalledWith('blob:slot-2');
  });

  it('clears a stored header picture when the reload fails', async () => {
    let created = 0;
    const revoke = vi.fn();
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      writable: true,
      value: (): string => {
        created += 1;
        return `blob:slot-${created}`;
      },
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      writable: true,
      value: revoke,
    });
    vi.mocked(fetchProfilePhoto).mockResolvedValue(
      new Blob([new Uint8Array([1])], { type: 'image/jpeg' }),
    );
    vi.mocked(fetchWideBanner).mockResolvedValue(
      new Blob([new Uint8Array([2])], { type: 'image/png' }),
    );
    vi.mocked(putProfilePhoto).mockResolvedValue(undefined);
    renderWithLocale(<ProfileScreen />);
    expect((await screen.findByAltText('Profile photo')).getAttribute('src')).toBe('blob:slot-1');
    expect(screen.getByAltText('Wide profile image').className).toContain('aspect-[5/2]');
    fireEvent.click(screen.getByRole('button', { name: 'Write your About me' }));
    expect(await screen.findByRole('button', { name: 'Remove profile photo' })).toBeTruthy();
    vi.mocked(fetchProfilePhoto).mockRejectedValue(new Error('gone'));
    vi.mocked(fetchWideBanner).mockRejectedValue(new Error('gone'));
    fireEvent.click(screen.getByRole('button', { name: 'Remove profile photo' }));
    await waitFor(() => {
      expect(screen.getByText('Add a profile photo')).toBeTruthy();
    });
    expect(screen.getByText('Add a wide image')).toBeTruthy();
    expect(
      [...document.querySelectorAll('img')].some((img) => img.className.includes('aspect-[5/2]')),
    ).toBe(false);
    expect(screen.queryByAltText('Profile photo')).toBeNull();
    expect(revoke).toHaveBeenCalledWith('blob:slot-1');
    expect(revoke).toHaveBeenCalledWith('blob:slot-2');
  });

  it('clears a stored header picture when the reload is not an image', async () => {
    vi.mocked(fetchProfilePhoto).mockResolvedValue(
      new Blob([new Uint8Array([1])], { type: 'image/jpeg' }),
    );
    vi.mocked(fetchWideBanner).mockResolvedValue(
      new Blob([new Uint8Array([2])], { type: 'image/png' }),
    );
    renderWithLocale(<ProfileScreen />);
    expect(await screen.findByAltText('Profile photo')).toBeTruthy();
    vi.mocked(fetchProfilePhoto).mockResolvedValue(
      new Blob([new Uint8Array([1])], { type: 'application/json' }),
    );
    vi.mocked(fetchWideBanner).mockResolvedValue(new Blob([], { type: 'image/jpeg' }));
    vi.mocked(prepareForumPhoto).mockResolvedValue({
      ok: true,
      photo: { contentType: 'image/jpeg', data: 'pic', previewUrl: 'data:image/jpeg;base64,pic' },
    });
    vi.mocked(putProfilePhoto).mockResolvedValue(undefined);
    const photoInput = document.querySelector('input[name="profile-photo"]') as HTMLInputElement;
    fireEvent.change(photoInput, {
      target: { files: [new File([new Uint8Array([1])], 'face.jpg', { type: 'image/jpeg' })] },
    });
    await waitFor(() => {
      expect(screen.getByText('Add a profile photo')).toBeTruthy();
    });
    expect(screen.getByText('Add a wide image')).toBeTruthy();
    expect(screen.queryByAltText('Profile photo')).toBeNull();
    expect(
      [...document.querySelectorAll('img')].some((img) => img.className.includes('aspect-[5/2]')),
    ).toBe(false);
  });

  it('hides add buttons while a reload from an empty slot is in flight', async () => {
    vi.mocked(putWideBanner).mockClear();
    renderWithLocale(<ProfileScreen />);
    expect(await screen.findByRole('button', { name: 'Add a wide image' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Add a profile photo' })).toBeTruthy();
    let resolveBanner: (blob: Blob) => void = () => undefined;
    vi.mocked(fetchWideBanner).mockReturnValue(
      new Promise((resolve) => {
        resolveBanner = resolve;
      }),
    );
    vi.mocked(fetchProfilePhoto).mockReturnValue(new Promise(() => undefined));
    vi.mocked(putWideBanner).mockResolvedValue(undefined);
    const bannerInput = document.querySelector('input[name="profile-banner"]') as HTMLInputElement;
    fireEvent.change(bannerInput, {
      target: {
        files: [new File([new Uint8Array([0xff, 0xd8, 0xff])], 'tall.jpg', { type: 'image/jpeg' })],
      },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Use this crop' }));
    await waitFor(() => {
      expect(putWideBanner).toHaveBeenCalledTimes(1);
      expect(screen.queryByRole('button', { name: 'Use this crop' })).toBeNull();
      expect(screen.queryByRole('button', { name: 'Add a wide image' })).toBeNull();
      expect(screen.queryByRole('button', { name: 'Add a profile photo' })).toBeNull();
    });
    await act(async () => {
      resolveBanner(new Blob([new Uint8Array([2])], { type: 'image/png' }));
    });
    expect(await screen.findByAltText('Wide profile image')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Add a profile photo' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Add a wide image' })).toBeNull();
  });

  it('does not drop a newer picture when an older load fails', async () => {
    let rejectPicture: (err: Error) => void = () => undefined;
    let rejectBanner: (err: Error) => void = () => undefined;
    vi.mocked(fetchProfilePhoto).mockReturnValue(
      new Promise((_resolve, reject) => {
        rejectPicture = reject;
      }),
    );
    vi.mocked(fetchWideBanner).mockReturnValue(
      new Promise((_resolve, reject) => {
        rejectBanner = reject;
      }),
    );
    renderWithLocale(<ProfileScreen />);
    await waitFor(() => {
      expect(fetchProfilePhoto).toHaveBeenCalled();
    });
    vi.mocked(fetchProfilePhoto).mockResolvedValue(
      new Blob([new Uint8Array([1])], { type: 'image/jpeg' }),
    );
    vi.mocked(fetchWideBanner).mockResolvedValue(
      new Blob([new Uint8Array([2])], { type: 'image/png' }),
    );
    vi.mocked(prepareForumPhoto).mockResolvedValue({
      ok: true,
      photo: { contentType: 'image/jpeg', data: 'pic', previewUrl: 'data:image/jpeg;base64,pic' },
    });
    vi.mocked(putProfilePhoto).mockResolvedValue(undefined);
    const photoInput = document.querySelector('input[name="profile-photo"]') as HTMLInputElement;
    fireEvent.change(photoInput, {
      target: { files: [new File([new Uint8Array([1])], 'face.jpg', { type: 'image/jpeg' })] },
    });
    expect(await screen.findByAltText('Profile photo')).toBeTruthy();
    expect(await screen.findByAltText('Wide profile image')).toBeTruthy();
    await act(async () => {
      rejectPicture(new Error('late'));
      rejectBanner(new Error('late'));
    });
    expect(screen.getByAltText('Profile photo')).toBeTruthy();
    expect(screen.getByAltText('Wide profile image')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Add a profile photo' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Add a wide image' })).toBeNull();
  });

  it('shows a spinner on the picture button while that save is in flight', async () => {
    let release: () => void = () => undefined;
    vi.mocked(prepareForumPhoto).mockResolvedValue({
      ok: true,
      photo: { contentType: 'image/jpeg', data: 'pic', previewUrl: 'data:image/jpeg;base64,pic' },
    });
    vi.mocked(putProfilePhoto).mockReturnValue(
      new Promise((resolve) => {
        release = () => {
          resolve(undefined);
        };
      }),
    );
    renderWithLocale(<ProfileScreen />);
    const button = await screen.findByRole('button', { name: 'Add a profile photo' });
    const input = document.querySelector('input[name="profile-photo"]') as HTMLInputElement;
    const file = new File([new Uint8Array([1])], 'shot.jpg', { type: 'image/jpeg' });
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() => {
      expect(button.hasAttribute('disabled')).toBe(true);
      expect(button.querySelector('.animate-spin')).toBeTruthy();
    });
    await act(async () => {
      release();
    });
  });

  it('ignores a rejected fetchMember after unmount', async () => {
    let rejectMember: (err: Error) => void = () => undefined;
    vi.mocked(fetchMember).mockReturnValue(
      new Promise((_resolve, reject) => {
        rejectMember = reject;
      }),
    );
    const view = renderWithLocale(<ProfileScreen />);
    view.unmount();
    await act(async () => {
      rejectMember(new Error('late'));
    });
  });
});
