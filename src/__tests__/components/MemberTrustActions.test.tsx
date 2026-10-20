import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemberTrustActions } from '@/components/MemberTrustActions';
import {
  fetchMember,
  postTrustAppoint,
  postTrustConfirm,
  postTrustPropose,
  postTrustVerify,
} from '@/lib/api';
import type { Account, MemberProfile } from '@/lib/api-types';
import { useAuthStore } from '@/stores/auth-store';
import { renderWithLocale } from '@/__tests__/render-with-locale';

const refresh = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: (): { refresh: typeof refresh } => ({ refresh }),
}));

vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock('@/lib/api', () => ({
  fetchMember: vi.fn(),
  postTrustVerify: vi.fn(),
  postTrustPropose: vi.fn(),
  postTrustConfirm: vi.fn(),
  postTrustAppoint: vi.fn(),
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
  lightningAddress: null,
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
  lightningAddress: null,
  createdAt: '2026-01-15T12:00:00.000Z',
  profileMessage: null,
  postCount: 0,
  replyCount: 0,
  trust: NULL_TRUST,
  aboutMe: null,
  aboutMeHasPhoto: false,
};

beforeEach(() => {
  vi.clearAllMocks();
  refresh.mockClear();
  useAuthStore.setState({
    session: 'sess',
    account,
  });
});

afterEach(cleanup);

function openStaffFunctions(): void {
  fireEvent.click(screen.getByText('Moderator functions'));
}

function expectVerifyLink(): void {
  expect(screen.getByRole('link', { name: 'Verify' }).getAttribute('href')).toBe(
    `/members/${profile.id}/verify`,
  );
}

function expectStaffRegionAbsent(): void {
  expect(screen.queryByTestId('state-members-staff-verify')).toBeNull();
  expect(screen.queryByTestId('staff-functions')).toBeNull();
}

describe('MemberTrustActions', () => {
  it('returns null for a basis viewer', () => {
    const { container } = renderWithLocale(<MemberTrustActions profile={profile} />);
    expect(container.firstChild).toBeNull();
    expectStaffRegionAbsent();
  });

  it('returns null when the session is missing', () => {
    useAuthStore.setState({ session: null, account: { ...account, role: 'moderator' } });
    const { container } = renderWithLocale(<MemberTrustActions profile={profile} />);
    expect(container.firstChild).toBeNull();
    expectStaffRegionAbsent();
  });

  it('returns null when the account snapshot is missing', () => {
    useAuthStore.setState({ session: 'sess', account: null });
    const { container } = renderWithLocale(<MemberTrustActions profile={profile} />);
    expect(container.firstChild).toBeNull();
    expectStaffRegionAbsent();
  });

  it('returns null for self', () => {
    useAuthStore.setState({
      session: 'sess',
      account: { ...account, role: 'moderator', id: profile.id },
    });
    const { container } = renderWithLocale(<MemberTrustActions profile={profile} />);
    expect(container.firstChild).toBeNull();
    expectStaffRegionAbsent();
  });

  it('shows Verify as a link for a moderator viewing a basis member', () => {
    useAuthStore.setState({ session: 'sess', account: { ...account, role: 'moderator' } });
    renderWithLocale(<MemberTrustActions profile={profile} />);
    expect(screen.getByTestId('state-members-staff-verify')).toBeTruthy();
    openStaffFunctions();
    expectVerifyLink();
    expect(postTrustVerify).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Appoint as moderator' })).toBeNull();
  });

  it('links Verify when the stored name is missing or blank', () => {
    useAuthStore.setState({ session: 'sess', account: { ...account, role: 'moderator' } });
    const { unmount } = renderWithLocale(
      <MemberTrustActions profile={{ ...profile, name: null }} />,
    );
    openStaffFunctions();
    expectVerifyLink();
    expect(postTrustVerify).not.toHaveBeenCalled();
    expect(
      screen.queryByText('Verification needs a stored name that identifies this person.'),
    ).toBeNull();
    unmount();

    renderWithLocale(<MemberTrustActions profile={{ ...profile, name: '   ' }} />);
    openStaffFunctions();
    expectVerifyLink();
    expect(postTrustVerify).not.toHaveBeenCalled();
    expect(
      screen.queryByText('Verification needs a stored name that identifies this person.'),
    ).toBeNull();
  });

  it('shows Verify and Appoint for a founder viewing a basis member', () => {
    useAuthStore.setState({ session: 'sess', account: { ...account, role: 'founder' } });
    renderWithLocale(<MemberTrustActions profile={profile} />);
    openStaffFunctions();
    expectVerifyLink();
    expect(screen.getByRole('button', { name: 'Appoint as moderator' })).toBeTruthy();
  });

  it('shows Propose for a verified member with no proposedBy', () => {
    useAuthStore.setState({ session: 'sess', account: { ...account, role: 'moderator' } });
    renderWithLocale(
      <MemberTrustActions profile={{ ...profile, role: 'verified', trust: NULL_TRUST }} />,
    );
    openStaffFunctions();
    expect(screen.getByRole('button', { name: 'Propose as moderator' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Confirm as moderator' })).toBeNull();
  });

  it('shows Confirm when proposedBy is another staff member', () => {
    useAuthStore.setState({ session: 'sess', account: { ...account, role: 'moderator' } });
    renderWithLocale(
      <MemberTrustActions
        profile={{
          ...profile,
          role: 'verified',
          trust: {
            ...NULL_TRUST,
            proposedBy: { id: '33333333-3333-4333-8333-333333333333', name: 'Bob' },
          },
        }}
      />,
    );
    openStaffFunctions();
    expect(screen.getByRole('button', { name: 'Confirm as moderator' })).toBeTruthy();
    expect(screen.queryByText('Waiting for another moderator to confirm.')).toBeNull();
  });

  it('shows waiting text and no Confirm when proposedBy is self', () => {
    useAuthStore.setState({ session: 'sess', account: { ...account, role: 'moderator' } });
    renderWithLocale(
      <MemberTrustActions
        profile={{
          ...profile,
          role: 'verified',
          trust: { ...NULL_TRUST, proposedBy: { id: account.id, name: 'Ada' } },
        }}
      />,
    );
    openStaffFunctions();
    expect(screen.getByText('Waiting for another moderator to confirm.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Confirm as moderator' })).toBeNull();
  });

  it('shows Propose and Appoint for a founder viewing a verified member', () => {
    useAuthStore.setState({ session: 'sess', account: { ...account, role: 'founder' } });
    renderWithLocale(
      <MemberTrustActions profile={{ ...profile, role: 'verified', trust: NULL_TRUST }} />,
    );
    openStaffFunctions();
    expect(screen.getByRole('button', { name: 'Propose as moderator' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Appoint as moderator' })).toBeTruthy();
  });

  it('links Already on the Trust Chain for a moderator subject', () => {
    useAuthStore.setState({ session: 'sess', account: { ...account, role: 'moderator' } });
    renderWithLocale(<MemberTrustActions profile={{ ...profile, role: 'moderator' }} />);
    openStaffFunctions();
    expect(
      screen.getByRole('link', { name: 'Already on the Trust Chain.' }).getAttribute('href'),
    ).toBe('/trust-chain');
    expect(screen.queryByRole('link', { name: 'Verify' })).toBeNull();
  });

  it('links Already on the Trust Chain for a founder subject', () => {
    useAuthStore.setState({ session: 'sess', account: { ...account, role: 'founder' } });
    renderWithLocale(<MemberTrustActions profile={{ ...profile, role: 'founder' }} />);
    openStaffFunctions();
    expect(screen.getByRole('link', { name: 'Already on the Trust Chain.' })).toBeTruthy();
  });

  it('links Already on the Trust Chain for an initiator subject', () => {
    useAuthStore.setState({ session: 'sess', account: { ...account, role: 'founder' } });
    renderWithLocale(<MemberTrustActions profile={{ ...profile, role: 'initiator' }} />);
    openStaffFunctions();
    expect(screen.getByRole('link', { name: 'Already on the Trust Chain.' })).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Verify' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Propose as moderator' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Appoint as moderator' })).toBeNull();
  });

  it('sets role=alert when the action fails', async () => {
    useAuthStore.setState({ session: 'sess', account: { ...account, role: 'moderator' } });
    vi.mocked(postTrustPropose).mockRejectedValue(new Error('fail'));
    renderWithLocale(
      <MemberTrustActions profile={{ ...profile, role: 'verified', trust: NULL_TRUST }} />,
    );
    openStaffFunctions();
    fireEvent.click(screen.getByRole('button', { name: 'Propose as moderator' }));
    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toBe(
        'Could not update this member. Please try again.',
      );
    });
  });

  it('disables actions while busy and ignores a second click', async () => {
    useAuthStore.setState({ session: 'sess', account: { ...account, role: 'moderator' } });
    let resolvePropose:
      ((value: { id: string; name: string | null; role: 'verified' }) => void) | undefined;
    vi.mocked(postTrustPropose).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolvePropose = resolve;
        }),
    );
    vi.mocked(fetchMember).mockResolvedValue({ ...profile, role: 'verified' });
    renderWithLocale(
      <MemberTrustActions profile={{ ...profile, role: 'verified', trust: NULL_TRUST }} />,
    );
    openStaffFunctions();
    const button = screen.getByRole('button', {
      name: 'Propose as moderator',
    }) as HTMLButtonElement;
    fireEvent.click(button);
    await waitFor(() => {
      expect(button.disabled).toBe(true);
    });
    fireEvent.click(button);
    expect(postTrustPropose).toHaveBeenCalledTimes(1);
    resolvePropose?.({ id: profile.id, name: profile.name, role: 'verified' });
    await waitFor(() => {
      expect(button.disabled).toBe(false);
    });
  });

  it('calls fetchMember and onUpdated after a successful propose', async () => {
    useAuthStore.setState({ session: 'sess', account: { ...account, role: 'moderator' } });
    const updated: MemberProfile = {
      ...profile,
      role: 'verified',
      trust: { ...NULL_TRUST, proposedBy: { id: account.id, name: account.name } },
    };
    vi.mocked(postTrustPropose).mockResolvedValue({
      id: profile.id,
      name: profile.name,
      role: 'verified',
    });
    vi.mocked(fetchMember).mockResolvedValue(updated);
    const onUpdated = vi.fn();
    renderWithLocale(
      <MemberTrustActions
        profile={{ ...profile, role: 'verified', trust: NULL_TRUST }}
        onUpdated={onUpdated}
      />,
    );
    openStaffFunctions();
    fireEvent.click(screen.getByRole('button', { name: 'Propose as moderator' }));
    await waitFor(() => {
      expect(postTrustPropose).toHaveBeenCalledWith('sess', profile.id);
      expect(fetchMember).toHaveBeenCalledWith('sess', profile.id);
      expect(onUpdated).toHaveBeenCalledWith(updated);
      expect(refresh).toHaveBeenCalled();
    });
  });

  it('skips onUpdated when fetchMember returns null', async () => {
    useAuthStore.setState({ session: 'sess', account: { ...account, role: 'moderator' } });
    vi.mocked(postTrustPropose).mockResolvedValue({
      id: profile.id,
      name: profile.name,
      role: 'verified',
    });
    vi.mocked(fetchMember).mockResolvedValue(null);
    const onUpdated = vi.fn();
    renderWithLocale(
      <MemberTrustActions
        profile={{ ...profile, role: 'verified', trust: NULL_TRUST }}
        onUpdated={onUpdated}
      />,
    );
    openStaffFunctions();
    fireEvent.click(screen.getByRole('button', { name: 'Propose as moderator' }));
    await waitFor(() => {
      expect(fetchMember).toHaveBeenCalled();
      expect(refresh).toHaveBeenCalled();
    });
    expect(onUpdated).not.toHaveBeenCalled();
  });

  it('does not alert when fetchMember throws after a successful propose', async () => {
    useAuthStore.setState({ session: 'sess', account: { ...account, role: 'moderator' } });
    vi.mocked(postTrustPropose).mockResolvedValue({
      id: profile.id,
      name: profile.name,
      role: 'verified',
    });
    vi.mocked(fetchMember).mockRejectedValue(new Error('gone'));
    const onUpdated = vi.fn();
    renderWithLocale(
      <MemberTrustActions
        profile={{ ...profile, role: 'verified', trust: NULL_TRUST }}
        onUpdated={onUpdated}
      />,
    );
    openStaffFunctions();
    fireEvent.click(screen.getByRole('button', { name: 'Propose as moderator' }));
    await waitFor(() => {
      expect(fetchMember).toHaveBeenCalledWith('sess', profile.id);
      expect(refresh).toHaveBeenCalled();
    });
    expect(onUpdated).toHaveBeenCalledWith(
      expect.objectContaining({
        role: 'verified',
        trust: expect.objectContaining({
          proposedBy: expect.objectContaining({ id: account.id }),
        }),
      }),
    );
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('keeps the verified role when fetchMember throws after propose', async () => {
    useAuthStore.setState({ session: 'sess', account: { ...account, role: 'moderator' } });
    vi.mocked(postTrustPropose).mockResolvedValue({
      id: profile.id,
      name: profile.name,
      role: 'verified',
    });
    vi.mocked(fetchMember).mockRejectedValue(new Error('gone'));
    const onUpdated = vi.fn();
    renderWithLocale(
      <MemberTrustActions
        profile={{ ...profile, role: 'verified', trust: NULL_TRUST }}
        onUpdated={onUpdated}
      />,
    );
    openStaffFunctions();
    fireEvent.click(screen.getByRole('button', { name: 'Propose as moderator' }));
    await waitFor(() => {
      expect(onUpdated).toHaveBeenCalledWith(
        expect.objectContaining({
          role: 'verified',
          trust: expect.objectContaining({
            proposedBy: expect.objectContaining({ id: account.id }),
          }),
        }),
      );
    });
  });

  it('posts propose, confirm, and appoint from the matching buttons', async () => {
    useAuthStore.setState({ session: 'sess', account: { ...account, role: 'founder' } });
    vi.mocked(postTrustPropose).mockResolvedValue({
      id: profile.id,
      name: profile.name,
      role: 'verified',
    });
    vi.mocked(postTrustConfirm).mockResolvedValue({
      id: profile.id,
      name: profile.name,
      role: 'moderator',
    });
    vi.mocked(postTrustAppoint).mockResolvedValue({
      id: profile.id,
      name: profile.name,
      role: 'moderator',
    });
    vi.mocked(fetchMember).mockResolvedValue({ ...profile, role: 'verified' });

    const { unmount } = renderWithLocale(
      <MemberTrustActions profile={{ ...profile, role: 'verified', trust: NULL_TRUST }} />,
    );
    openStaffFunctions();
    fireEvent.click(screen.getByRole('button', { name: 'Propose as moderator' }));
    await waitFor(() => {
      expect(postTrustPropose).toHaveBeenCalledWith('sess', profile.id);
    });
    unmount();

    renderWithLocale(
      <MemberTrustActions
        profile={{
          ...profile,
          role: 'verified',
          trust: {
            ...NULL_TRUST,
            proposedBy: { id: '33333333-3333-4333-8333-333333333333', name: 'Bob' },
          },
        }}
      />,
    );
    openStaffFunctions();
    fireEvent.click(screen.getByRole('button', { name: 'Confirm as moderator' }));
    await waitFor(() => {
      expect(postTrustConfirm).toHaveBeenCalledWith('sess', profile.id);
    });
    cleanup();

    renderWithLocale(<MemberTrustActions profile={profile} />);
    openStaffFunctions();
    fireEvent.click(screen.getByRole('button', { name: 'Appoint as moderator' }));
    await waitFor(() => {
      expect(postTrustAppoint).toHaveBeenCalledWith('sess', profile.id);
    });
  });
});
