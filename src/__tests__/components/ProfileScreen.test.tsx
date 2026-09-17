import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProfileScreen } from '@/components/ProfileScreen';
import { fetchAboutMePhoto, fetchAccountActivity, putAboutMe } from '@/lib/api';
import type { Account, AccountActivity } from '@/lib/api-types';
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
  setLightningAddress: vi.fn(),
  unlinkLightningAddress: vi.fn(),
  putAboutMe: vi.fn(),
  fetchAboutMePhoto: vi
    .fn()
    .mockResolvedValue(new Blob([new Uint8Array([1])], { type: 'image/jpeg' })),
}));

vi.mock('@/lib/forum-photo', () => ({
  prepareForumPhoto: vi.fn(),
}));

vi.mock('@/lib/push', () => ({
  enablePush: vi.fn(),
  disablePush: vi.fn(),
  isIosSafari: vi.fn().mockReturnValue(false),
  isStandaloneDisplay: vi.fn().mockReturnValue(false),
  registerPushWorker: vi.fn(),
  vapidPublicKeyToBytes: vi.fn(),
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

beforeEach(() => {
  replace.mockReset();
  vi.mocked(fetchAccountActivity).mockReset();
  vi.mocked(fetchAccountActivity).mockResolvedValue(EMPTY_ACTIVITY);
  vi.mocked(putAboutMe).mockReset();
  vi.mocked(fetchAboutMePhoto).mockReset();
  vi.mocked(fetchAboutMePhoto).mockResolvedValue(
    new Blob([new Uint8Array([1])], { type: 'image/jpeg' }),
  );
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
      lightningAddress: 'alice@walletofsatoshi.com',
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
});

describe('ProfileScreen', () => {
  it('shows the heading, name form, address form, chart, theme group, and number format group', async () => {
    renderWithLocale(<ProfileScreen />);
    expect(screen.getByRole('heading', { name: 'Profile' })).toBeTruthy();
    expect(screen.getByText('Name')).toBeTruthy();
    expect(screen.getByText('Location')).toBeTruthy();
    expect(screen.getByText('Wallet of Satoshi address')).toBeTruthy();
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
    expect(screen.getAllByRole('group', { name: 'Fiat currency' })).toHaveLength(2);
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
    expect(screen.getAllByRole('group', { name: 'Fiat currency' })).toHaveLength(2);
    expect(screen.queryByRole('group', { name: 'Chart scale' })).toBeNull();
    expect(screen.queryByRole('img', { name: 'Given and received in ₿' })).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Given and received' })).toBeNull();
    expect(screen.queryByLabelText('Given ₿0')).toBeNull();
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
    fireEvent.change(document.querySelector('input[type="file"]') as HTMLInputElement, {
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
});
