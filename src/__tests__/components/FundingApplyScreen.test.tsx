import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  FundingApplyScreen,
  aboutMeFilled,
  locationFilled,
  nextFillStep,
} from '@/components/FundingApplyScreen';
import type { Account, ForumMessage } from '@/lib/api-types';
import { MissingRequirementsError } from '@/lib/missing-requirements';
import { useAuthStore } from '@/stores/auth-store';
import { renderWithLocale } from '@/__tests__/render-with-locale';

const push = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: (): { push: typeof push; replace: typeof push } => ({ push, replace: push }),
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

vi.mock('@/lib/api', () => ({
  fetchAboutMePhoto: vi.fn(),
  fetchMemberPosts: vi.fn(),
  postFundingApply: vi.fn(),
  putAboutMe: vi.fn(),
}));

import { fetchMemberPosts, postFundingApply, putAboutMe } from '@/lib/api';

const postsMock = vi.mocked(fetchMemberPosts);
const applyMock = vi.mocked(postFundingApply);
const putAboutMock = vi.mocked(putAboutMe);

const account: Account = {
  id: 'acc_1',
  linkingKey: '02abcdef',
  role: 'verified',
  name: 'Ada',
  location: null,
  lightningAddress: 'alice@walletofsatoshi.com',
  lightningAddressVerified: false,
  forumLawsDismissed: false,
  createdAt: 1_700_000_000,
  rulesAgreedAt: 1_700_000_001,
  viewKey: 'a'.repeat(64),
  aboutMe: null,
  aboutMeHasPhoto: false,
  setup: null,
  missing: [],
  funding: {
    status: 'none',
    trialUtcDate: null,
    admittedAt: null,
    reviewedByName: null,
  },
};

const complete: Account = {
  ...account,
  aboutMe: 'I build on Bitcoin',
  aboutMeHasPhoto: true,
  location: 'Zurich',
};

const post: ForumMessage = {
  id: 'msg_1',
  name: 'Ada',
  text: 'Living-room note.',
  createdAt: '2026-08-28T12:00:00.000Z',
  sats: 0,
  payable: false,
  hasPhoto: false,
  photoCount: 0,
  hasVideo: false,
  videoContentType: null,
  role: 'verified',
  replyCount: 0,
};

beforeEach(() => {
  vi.clearAllMocks();
  push.mockReset();
  postsMock.mockResolvedValue([post]);
  applyMock.mockResolvedValue({
    status: 'pending',
    trialUtcDate: null,
    admittedAt: null,
    reviewedByName: null,
  });
  useAuthStore.setState({ session: 'sess', account });
});

afterEach(cleanup);

describe('aboutMeFilled', () => {
  it('rejects empty and name-only notes', () => {
    expect(aboutMeFilled(null, 'Ada')).toBe(false);
    expect(aboutMeFilled('Ada', 'Ada')).toBe(false);
    expect(aboutMeFilled('I build on Bitcoin', 'Ada')).toBe(true);
    expect(aboutMeFilled('I build on Bitcoin', null)).toBe(true);
    expect(aboutMeFilled('I build on Bitcoin', '')).toBe(true);
  });
});

describe('nextFillStep', () => {
  it('walks about, photo, then location', () => {
    expect(nextFillStep(account)).toBe('about');
    expect(nextFillStep({ ...account, aboutMe: 'I build on Bitcoin' })).toBe('photo');
    expect(nextFillStep({ ...account, aboutMe: 'I build on Bitcoin', aboutMeHasPhoto: true })).toBe(
      'location',
    );
    expect(nextFillStep(complete)).toBeNull();
    expect(locationFilled('Zurich')).toBe(true);
    expect(locationFilled('  ')).toBe(false);
    expect(locationFilled(null)).toBe(false);
  });
});

describe('FundingApplyScreen', () => {
  it('renders nothing without a session', () => {
    useAuthStore.setState({ session: null, account });
    const { container } = renderWithLocale(<FundingApplyScreen />);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when there is no account', () => {
    useAuthStore.setState({ session: 'sess', account: null });
    const { container } = renderWithLocale(<FundingApplyScreen />);
    expect(container.firstChild).toBeNull();
    expect(postsMock).not.toHaveBeenCalled();
  });

  it('shows not-verified copy for basis', () => {
    useAuthStore.setState({
      session: 'sess',
      account: { ...account, role: 'basis', funding: null },
    });
    renderWithLocale(<FundingApplyScreen />);
    expect(screen.getByText('You are not verified yet.')).toBeTruthy();
    expect(
      screen.queryByText('First, write a short About me so people can get to know you.'),
    ).toBeNull();
  });

  it('treats missing funding as none and starts on About me', () => {
    useAuthStore.setState({ session: 'sess', account: { ...account, funding: undefined } });
    renderWithLocale(<FundingApplyScreen />);
    expect(
      screen.getByText('First, write a short About me so people can get to know you.'),
    ).toBeTruthy();
  });

  it('starts on About me when the bio is empty', () => {
    renderWithLocale(<FundingApplyScreen />);
    expect(
      screen.getByText('First, write a short About me so people can get to know you.'),
    ).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
    const back = screen.getByRole('link', { name: 'Back to grants' });
    expect(back.getAttribute('href')).toBe('/grants');
    expect(screen.queryByText('Back to grants')).toBeNull();
  });

  it('advances to the photo step after About me is saved', async () => {
    putAboutMock.mockResolvedValue({
      ...account,
      aboutMe: 'I build on Bitcoin',
      aboutMeHasPhoto: false,
      aboutMessageId: 'note-1',
    });
    renderWithLocale(<FundingApplyScreen />);
    fireEvent.change(screen.getByRole('textbox', { name: 'About me' }), {
      target: { value: 'I build on Bitcoin' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save About me' }));
    expect(await screen.findByText('Next, add a photo to your About me.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Add a photo' })).toBeTruthy();
    expect(useAuthStore.getState().account?.aboutMessageId).toBe('note-1');
  });

  it('keeps the About me note id when a save sends a blank id', async () => {
    useAuthStore.setState({ account: { ...account, aboutMessageId: 'note-1' } });
    putAboutMock.mockResolvedValue({
      ...account,
      aboutMe: 'I build on Bitcoin',
      aboutMeHasPhoto: false,
      aboutMessageId: '',
    });
    renderWithLocale(<FundingApplyScreen />);
    fireEvent.change(screen.getByRole('textbox', { name: 'About me' }), {
      target: { value: 'I build on Bitcoin' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save About me' }));
    expect(await screen.findByText('Next, add a photo to your About me.')).toBeTruthy();
    expect(useAuthStore.getState().account?.aboutMessageId).toBe('note-1');
  });

  it('sends a missing-rules save to setup', async () => {
    putAboutMock.mockRejectedValue(new MissingRequirementsError(['rules']));
    renderWithLocale(<FundingApplyScreen />);
    fireEvent.change(screen.getByRole('textbox', { name: 'About me' }), {
      target: { value: 'I build on Bitcoin' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save About me' }));
    await waitFor(() => {
      expect(push).toHaveBeenCalledWith('/setup/rules');
    });
  });

  it('keeps the About me step when save misses a non-rules requirement', async () => {
    putAboutMock.mockRejectedValue(new MissingRequirementsError(['name']));
    renderWithLocale(<FundingApplyScreen />);
    fireEvent.change(screen.getByRole('textbox', { name: 'About me' }), {
      target: { value: 'I build on Bitcoin' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save About me' }));
    expect(await screen.findByRole('textbox', { name: 'About me' })).toBeTruthy();
    expect(push).not.toHaveBeenCalledWith('/setup/rules');
    expect(screen.queryByText('Could not save. Please try again.')).toBeNull();
  });

  it('keeps the About me step when save fails', async () => {
    putAboutMock.mockRejectedValue(new Error('boom'));
    renderWithLocale(<FundingApplyScreen />);
    fireEvent.change(screen.getByRole('textbox', { name: 'About me' }), {
      target: { value: 'I build on Bitcoin' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save About me' }));
    expect(await screen.findByText('Could not save. Please try again.')).toBeTruthy();
  });

  it('asks for a photo when About me is filled without one', () => {
    useAuthStore.setState({
      session: 'sess',
      account: { ...account, aboutMe: 'I build on Bitcoin', aboutMessageId: 'note-1' },
    });
    renderWithLocale(<FundingApplyScreen />);
    expect(screen.getByText('Next, add a photo to your About me.')).toBeTruthy();
  });

  it('asks for a location when About me and photo are set', () => {
    useAuthStore.setState({
      session: 'sess',
      account: { ...account, aboutMe: 'I build on Bitcoin', aboutMeHasPhoto: true },
    });
    renderWithLocale(<FundingApplyScreen />);
    expect(screen.getByText('Next, add the place you live.')).toBeTruthy();
  });

  it('asks the principles question, then the truth question, then posts apply', async () => {
    useAuthStore.setState({ session: 'sess', account: complete });
    renderWithLocale(<FundingApplyScreen />);
    expect(
      await screen.findByText('Do your profile posts match the core principles of 21.gifts?'),
    ).toBeTruthy();
    expect(screen.getByRole('link', { name: 'About' }).getAttribute('href')).toBe(
      'https://21.gifts/about',
    );
    expect(screen.queryByText('Giving is a duty')).toBeNull();
    expect(screen.getByText('Living-room note.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Yes' }));
    expect(
      await screen.findByText('Do these posts, to your knowledge, correspond to the truth?'),
    ).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'About' })).toBeNull();
    expect(applyMock).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Yes' }));
    await waitFor(() => {
      expect(applyMock).toHaveBeenCalledWith('sess');
    });
    expect(push).toHaveBeenCalledWith('/grants');
  });

  it('disables Yes while apply is in flight', async () => {
    applyMock.mockImplementation(() => new Promise(() => undefined));
    useAuthStore.setState({ session: 'sess', account: complete });
    renderWithLocale(<FundingApplyScreen />);
    fireEvent.click(await screen.findByRole('button', { name: 'Yes' }));
    expect(
      await screen.findByText('Do these posts, to your knowledge, correspond to the truth?'),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Yes' }));
    const yes = screen.getByRole('button', { name: 'Yes' }) as HTMLButtonElement;
    expect(yes.disabled).toBe(true);
  });

  it('renders a living-room post that has no text', async () => {
    postsMock.mockResolvedValue([{ ...post, text: '' }]);
    useAuthStore.setState({ session: 'sess', account: complete });
    renderWithLocale(<FundingApplyScreen />);
    expect(
      await screen.findByText('Do your profile posts match the core principles of 21.gifts?'),
    ).toBeTruthy();
    expect(screen.getByText('Ada')).toBeTruthy();
    expect(screen.queryByText('Living-room note.')).toBeNull();
  });

  it('shows empty posts copy when the member has no notes', async () => {
    postsMock.mockResolvedValue([]);
    useAuthStore.setState({ session: 'sess', account: complete });
    renderWithLocale(<FundingApplyScreen />);
    expect(await screen.findByText('No living-room posts.')).toBeTruthy();
  });

  it('does not apply when requirement is not met', async () => {
    useAuthStore.setState({ session: 'sess', account: complete });
    renderWithLocale(<FundingApplyScreen />);
    fireEvent.click(await screen.findByRole('button', { name: 'No' }));
    expect(await screen.findByText('When your posts match, you can apply again.')).toBeTruthy();
    expect(applyMock).not.toHaveBeenCalled();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByRole('link', { name: 'Back to grants' }).getAttribute('href')).toBe(
      '/grants',
    );
    expect(screen.queryByText('Back to grants')).toBeNull();
  });

  it('shows trial copy when already on trial', () => {
    useAuthStore.setState({
      session: 'sess',
      account: {
        ...complete,
        funding: {
          status: 'trial',
          trialUtcDate: '2026-09-20',
          admittedAt: null,
          reviewedByName: null,
        },
      },
    });
    renderWithLocale(<FundingApplyScreen />);
    expect(screen.getByText('You are on a one-day trial. Review repeats tomorrow.')).toBeTruthy();
  });

  it('shows admitted copy when already admitted', () => {
    useAuthStore.setState({
      session: 'sess',
      account: {
        ...complete,
        funding: {
          status: 'admitted',
          trialUtcDate: null,
          admittedAt: 1,
          reviewedByName: 'Ada',
        },
      },
    });
    renderWithLocale(<FundingApplyScreen />);
    expect(screen.getByText('You are admitted to daily 21.gifts grant payouts.')).toBeTruthy();
  });

  it('retries a failed posts load', async () => {
    postsMock.mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce([post]);
    useAuthStore.setState({ session: 'sess', account: complete });
    renderWithLocale(<FundingApplyScreen />);
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.getByText('Could not load this application. Please try again.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(
      await screen.findByText('Do your profile posts match the core principles of 21.gifts?'),
    ).toBeTruthy();
  });

  it('shows apply-error copy when Yes fails', async () => {
    applyMock.mockRejectedValue(new Error('boom'));
    useAuthStore.setState({ session: 'sess', account: complete });
    renderWithLocale(<FundingApplyScreen />);
    fireEvent.click(await screen.findByRole('button', { name: 'Yes' }));
    expect(
      await screen.findByText('Do these posts, to your knowledge, correspond to the truth?'),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Yes' }));
    expect(
      await screen.findByText('Could not submit your application. Please try again.'),
    ).toBeTruthy();
    expect(
      screen.getByText('Do these posts, to your knowledge, correspond to the truth?'),
    ).toBeTruthy();
  });

  it('shows pending copy when already applied', () => {
    useAuthStore.setState({
      session: 'sess',
      account: {
        ...complete,
        funding: {
          status: 'pending',
          trialUtcDate: null,
          admittedAt: null,
          reviewedByName: null,
        },
      },
    });
    renderWithLocale(<FundingApplyScreen />);
    expect(
      screen.getByText('Your application is open. A moderator will review your posts.'),
    ).toBeTruthy();
    expect(postsMock).not.toHaveBeenCalled();
  });

  it('shows the question when funding was rejected', async () => {
    useAuthStore.setState({
      session: 'sess',
      account: {
        ...complete,
        funding: {
          status: 'rejected',
          trialUtcDate: null,
          admittedAt: null,
          reviewedByName: null,
        },
      },
    });
    renderWithLocale(<FundingApplyScreen />);
    expect(
      await screen.findByText('Do your profile posts match the core principles of 21.gifts?'),
    ).toBeTruthy();
    expect(postsMock).toHaveBeenCalled();
    expect(
      screen.queryByText('Your application is open. A moderator will review your posts.'),
    ).toBeNull();
    expect(screen.queryByText('You are on a one-day trial. Review repeats tomorrow.')).toBeNull();
    expect(screen.queryByText('You are admitted to daily 21.gifts grant payouts.')).toBeNull();
  });
});
