import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemberVerifyScreen } from '@/components/MemberVerifyScreen';
import { fetchMember, postTrustVerify } from '@/lib/api';
import type { Account, MemberProfile } from '@/lib/api-types';
import { useAuthStore } from '@/stores/auth-store';
import { renderWithLocale } from '@/__tests__/render-with-locale';

const push = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: (): { push: typeof push } => ({ push }),
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
  fetchMember: vi.fn(),
  postTrustVerify: vi.fn(),
}));

const NULL_TRUST = {
  verifiedBy: null,
  proposedBy: null,
  confirmedBy: null,
  appointedBy: null,
};

const account: Account = {
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
  aboutMe: null,
  aboutMeHasPhoto: false,
};

const profile: MemberProfile = {
  id: '22222222-2222-4222-8222-222222222222',
  name: 'Carol',
  location: null,
  role: 'basis',
  lightningAddress: 'carol@walletofsatoshi.com',
  createdAt: '2026-01-15T12:00:00.000Z',
  profileMessage: null,
  postCount: 0,
  replyCount: 0,
  trust: NULL_TRUST,
  aboutMe: null,
  aboutMeHasPhoto: false,
};

const QUESTION = 'Does this stored name match the name that uniquely identifies this person?';

beforeEach(() => {
  vi.clearAllMocks();
  push.mockClear();
  useAuthStore.setState({
    session: 'sess',
    account,
  });
});

afterEach(() => {
  cleanup();
  delete document.documentElement.dataset['localSunday'];
});

function setModerator(overrides: Partial<Account> = {}): void {
  useAuthStore.setState({
    session: 'sess',
    account: { ...account, role: 'moderator', ...overrides },
  });
}

describe('MemberVerifyScreen', () => {
  it('renders nothing without a session and does not fetch', () => {
    useAuthStore.setState({ session: null, account: { ...account, role: 'moderator' } });
    const { container } = renderWithLocale(<MemberVerifyScreen accountId={profile.id} />);
    expect(container.firstChild).toBeNull();
    expect(fetchMember).not.toHaveBeenCalled();
  });

  it('shows missing for an id that is not a UUID and does not fetch', () => {
    setModerator();
    renderWithLocale(<MemberVerifyScreen accountId="not-a-uuid" />);
    expect(screen.getByText('This profile could not be found.')).toBeTruthy();
    expect(screen.getByTestId('state-members-verify-missing')).toBeTruthy();
    expect(fetchMember).not.toHaveBeenCalled();
  });

  it('shows Loading… while fetchMember is deferred', () => {
    setModerator();
    vi.mocked(fetchMember).mockImplementation(() => new Promise(() => undefined));
    renderWithLocale(<MemberVerifyScreen accountId={profile.id} />);
    expect(screen.getByText('Loading…')).toBeTruthy();
    expect(screen.getByTestId('state-members-verify-loading')).toBeTruthy();
  });

  it('shows the profile error and retries a failed load', async () => {
    setModerator();
    vi.mocked(fetchMember).mockRejectedValueOnce(new Error('boom'));
    vi.mocked(fetchMember).mockResolvedValueOnce(profile);
    renderWithLocale(<MemberVerifyScreen accountId={profile.id} />);
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toBe('Could not load this profile. Please try again.');
    expect(screen.getByTestId('state-members-verify-error')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('Carol')).toBeTruthy();
    expect(fetchMember).toHaveBeenCalledTimes(2);
  });

  it('shows missing when fetchMember returns null', async () => {
    setModerator();
    vi.mocked(fetchMember).mockResolvedValue(null);
    renderWithLocale(<MemberVerifyScreen accountId={profile.id} />);
    expect(await screen.findByText('This profile could not be found.')).toBeTruthy();
    expect(screen.getByTestId('state-members-verify-missing')).toBeTruthy();
  });

  it('shows forbidden for a viewer below moderator and does not fetch', () => {
    renderWithLocale(<MemberVerifyScreen accountId={profile.id} />);
    expect(screen.getByText('You cannot verify this member.')).toBeTruthy();
    expect(screen.getByTestId('state-members-verify-forbidden')).toBeTruthy();
    expect(fetchMember).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Yes' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'No' })).toBeNull();
  });

  it('shows forbidden when the session has no account and does not fetch', () => {
    useAuthStore.setState({ session: 'sess', account: null });
    renderWithLocale(<MemberVerifyScreen accountId={profile.id} />);
    expect(screen.getByText('You cannot verify this member.')).toBeTruthy();
    expect(fetchMember).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Yes' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'No' })).toBeNull();
  });

  it('shows forbidden when a moderator views themself', async () => {
    setModerator({ id: profile.id });
    vi.mocked(fetchMember).mockResolvedValue(profile);
    renderWithLocale(<MemberVerifyScreen accountId={profile.id} />);
    expect(await screen.findByText('You cannot verify this member.')).toBeTruthy();
    expect(screen.queryByText(QUESTION)).toBeNull();
    expect(postTrustVerify).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Yes' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'No' })).toBeNull();
  });

  it('shows forbidden when the member role is not basis', async () => {
    setModerator();
    vi.mocked(fetchMember).mockResolvedValue({ ...profile, role: 'verified' });
    renderWithLocale(<MemberVerifyScreen accountId={profile.id} />);
    expect(await screen.findByText('You cannot verify this member.')).toBeTruthy();
    expect(screen.queryByText(QUESTION)).toBeNull();
    expect(postTrustVerify).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Yes' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'No' })).toBeNull();
  });

  it('shows the missing sentence when the stored name is null or only whitespace', async () => {
    setModerator();
    vi.mocked(fetchMember).mockResolvedValue({ ...profile, name: null });
    const { unmount } = renderWithLocale(<MemberVerifyScreen accountId={profile.id} />);
    expect(
      await screen.findByText('Verification needs a stored name that identifies this person.'),
    ).toBeTruthy();
    expect(screen.getByTestId('state-members-verify-unnamed')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Yes' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'No' })).toBeNull();
    expect(postTrustVerify).not.toHaveBeenCalled();
    unmount();

    vi.mocked(fetchMember).mockResolvedValue({ ...profile, name: '   ' });
    renderWithLocale(<MemberVerifyScreen accountId={profile.id} />);
    expect(
      await screen.findByText('Verification needs a stored name that identifies this person.'),
    ).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Yes' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'No' })).toBeNull();
    expect(postTrustVerify).not.toHaveBeenCalled();
  });

  it('shows the question and Carol without posting until Yes is clicked', async () => {
    setModerator();
    vi.mocked(fetchMember).mockResolvedValue(profile);
    renderWithLocale(<MemberVerifyScreen accountId={profile.id} />);
    expect(await screen.findByText(QUESTION)).toBeTruthy();
    expect(screen.getByText('Carol')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Yes' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'No' })).toBeTruthy();
    expect(postTrustVerify).not.toHaveBeenCalled();
  });

  it('shows the stored name as a link to the member card', async () => {
    setModerator();
    vi.mocked(fetchMember).mockResolvedValue(profile);
    renderWithLocale(<MemberVerifyScreen accountId={profile.id} />);
    expect(await screen.findByRole('link')).toBeTruthy();
    expect(screen.getByRole('link').getAttribute('href')).toBe(`/members/${profile.id}`);
  });

  it('shows and posts the untrimmed stored name', async () => {
    setModerator();
    vi.mocked(fetchMember).mockResolvedValue({ ...profile, name: '  Carol  ' });
    vi.mocked(postTrustVerify).mockResolvedValue({
      id: profile.id,
      name: '  Carol  ',
      role: 'verified',
    });
    renderWithLocale(<MemberVerifyScreen accountId={profile.id} />);
    const link = await screen.findByRole('link');
    expect(link.textContent).toBe('  Carol  ');
    expect(screen.getByRole('button', { name: 'Yes' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'No' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Yes' }));
    await waitFor(() => {
      expect(postTrustVerify).toHaveBeenCalledWith('sess', profile.id, '  Carol  ');
    });
  });

  it('posts the stored name then opens the member card', async () => {
    setModerator();
    vi.mocked(fetchMember).mockResolvedValue(profile);
    vi.mocked(postTrustVerify).mockResolvedValue({
      id: profile.id,
      name: profile.name,
      role: 'verified',
    });
    renderWithLocale(<MemberVerifyScreen accountId={profile.id} />);
    expect(await screen.findByRole('button', { name: 'Yes' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'No' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Yes' }));
    await waitFor(() => {
      expect(postTrustVerify).toHaveBeenCalledWith('sess', profile.id, 'Carol');
      expect(push).toHaveBeenCalledWith(`/members/${profile.id}`);
    });
  });

  it('opens the member card from No without posting', async () => {
    setModerator();
    vi.mocked(fetchMember).mockResolvedValue(profile);
    renderWithLocale(<MemberVerifyScreen accountId={profile.id} />);
    fireEvent.click(await screen.findByRole('button', { name: 'No' }));
    expect(push).toHaveBeenCalledWith(`/members/${profile.id}`);
    expect(postTrustVerify).not.toHaveBeenCalled();
  });

  it('keeps Yes and No and stays on the page when postTrustVerify throws', async () => {
    setModerator();
    vi.mocked(fetchMember).mockResolvedValue(profile);
    vi.mocked(postTrustVerify).mockRejectedValue(new Error('fail'));
    renderWithLocale(<MemberVerifyScreen accountId={profile.id} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Yes' }));
    await waitFor(() => {
      expect(screen.getByTestId('state-members-verify-failed').textContent).toBe(
        'Could not update this member. Please try again.',
      );
    });
    expect(screen.getByRole('button', { name: 'Yes' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'No' })).toBeTruthy();
    expect(push).not.toHaveBeenCalled();
  });

  it('keeps the name and question on Sunday and gates both buttons', async () => {
    document.documentElement.dataset['localSunday'] = '1';
    setModerator();
    vi.mocked(fetchMember).mockResolvedValue(profile);
    renderWithLocale(<MemberVerifyScreen accountId={profile.id} />);
    expect(await screen.findByText(QUESTION)).toBeTruthy();
    expect(screen.getByRole('link')).toBeTruthy();
    expect(screen.getByText('Writing is paused on Sunday.')).toBeTruthy();
    const field = document.querySelector('.sunday-write-field');
    expect(field).not.toBeNull();
    expect(field?.contains(screen.getByRole('button', { name: 'Yes' }))).toBe(true);
    expect(field?.contains(screen.getByRole('button', { name: 'No' }))).toBe(true);
    delete document.documentElement.dataset['localSunday'];
  });

  it('ignores a stale member resolve after unmount', async () => {
    setModerator();
    let resolveMember: ((value: MemberProfile | null) => void) | undefined;
    vi.mocked(fetchMember).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveMember = resolve;
        }),
    );
    const view = renderWithLocale(<MemberVerifyScreen accountId={profile.id} />);
    view.unmount();
    resolveMember?.(profile);
    await Promise.resolve();
    await act(async () => {
      await Promise.resolve();
    });
    expect(fetchMember).toHaveBeenCalled();
  });

  it('ignores a stale member reject after unmount', async () => {
    setModerator();
    let rejectMember: ((reason: Error) => void) | undefined;
    vi.mocked(fetchMember).mockImplementationOnce(
      () =>
        new Promise((_, reject) => {
          rejectMember = reject;
        }),
    );
    const view = renderWithLocale(<MemberVerifyScreen accountId={profile.id} />);
    view.unmount();
    rejectMember?.(new Error('gone'));
    await Promise.resolve();
    await act(async () => {
      await Promise.resolve();
    });
    expect(fetchMember).toHaveBeenCalled();
  });
});
