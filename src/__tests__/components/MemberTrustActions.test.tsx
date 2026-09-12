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
  lightningAddress: 'alice@walletofsatoshi.com',
  lightningAddressVerified: false,
  forumLawsDismissed: true,
  createdAt: 1,
  rulesAgreedAt: 1,
  viewKey: 'a'.repeat(64),
  setup: null,
  missing: [],
};

const profile: MemberProfile = {
  id: '22222222-2222-4222-8222-222222222222',
  name: 'Carol',
  role: 'basis',
  lightningAddress: 'carol@walletofsatoshi.com',
  createdAt: '2026-01-15T12:00:00.000Z',
  profileMessage: null,
  trust: NULL_TRUST,
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

describe('MemberTrustActions', () => {
  it('returns null for a basis viewer', () => {
    const { container } = renderWithLocale(<MemberTrustActions profile={profile} />);
    expect(container.firstChild).toBeNull();
  });

  it('returns null when the session is missing', () => {
    useAuthStore.setState({ session: null, account: { ...account, role: 'moderator' } });
    const { container } = renderWithLocale(<MemberTrustActions profile={profile} />);
    expect(container.firstChild).toBeNull();
  });

  it('returns null when the account snapshot is missing', () => {
    useAuthStore.setState({ session: 'sess', account: null });
    const { container } = renderWithLocale(<MemberTrustActions profile={profile} />);
    expect(container.firstChild).toBeNull();
  });

  it('returns null for self', () => {
    useAuthStore.setState({
      session: 'sess',
      account: { ...account, role: 'moderator', id: profile.id },
    });
    const { container } = renderWithLocale(<MemberTrustActions profile={profile} />);
    expect(container.firstChild).toBeNull();
  });

  it('shows Verify for a moderator viewing a basis member', () => {
    useAuthStore.setState({ session: 'sess', account: { ...account, role: 'moderator' } });
    renderWithLocale(<MemberTrustActions profile={profile} />);
    expect(screen.getByRole('button', { name: 'Verify' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Appoint as moderator' })).toBeNull();
    expect(screen.getByTestId('state-members-staff-verify')).toBeTruthy();
  });

  it('shows Verify and Appoint for a founder viewing a basis member', () => {
    useAuthStore.setState({ session: 'sess', account: { ...account, role: 'founder' } });
    renderWithLocale(<MemberTrustActions profile={profile} />);
    expect(screen.getByRole('button', { name: 'Verify' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Appoint as moderator' })).toBeTruthy();
  });

  it('shows Propose for a verified member with no proposedBy', () => {
    useAuthStore.setState({ session: 'sess', account: { ...account, role: 'moderator' } });
    renderWithLocale(
      <MemberTrustActions profile={{ ...profile, role: 'verified', trust: NULL_TRUST }} />,
    );
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
    expect(screen.getByText('Waiting for another moderator to confirm.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Confirm as moderator' })).toBeNull();
  });

  it('shows Propose and Appoint for a founder viewing a verified member', () => {
    useAuthStore.setState({ session: 'sess', account: { ...account, role: 'founder' } });
    renderWithLocale(
      <MemberTrustActions profile={{ ...profile, role: 'verified', trust: NULL_TRUST }} />,
    );
    expect(screen.getByRole('button', { name: 'Propose as moderator' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Appoint as moderator' })).toBeTruthy();
  });

  it('links Already on the Trust Chain for a moderator subject', () => {
    useAuthStore.setState({ session: 'sess', account: { ...account, role: 'moderator' } });
    renderWithLocale(<MemberTrustActions profile={{ ...profile, role: 'moderator' }} />);
    expect(
      screen.getByRole('link', { name: 'Already on the Trust Chain.' }).getAttribute('href'),
    ).toBe('/trust-chain');
    expect(screen.queryByRole('button', { name: 'Verify' })).toBeNull();
  });

  it('links Already on the Trust Chain for a founder subject', () => {
    useAuthStore.setState({ session: 'sess', account: { ...account, role: 'founder' } });
    renderWithLocale(<MemberTrustActions profile={{ ...profile, role: 'founder' }} />);
    expect(screen.getByRole('link', { name: 'Already on the Trust Chain.' })).toBeTruthy();
  });

  it('sets role=status when the action fails', async () => {
    useAuthStore.setState({ session: 'sess', account: { ...account, role: 'moderator' } });
    vi.mocked(postTrustVerify).mockRejectedValue(new Error('fail'));
    renderWithLocale(<MemberTrustActions profile={profile} />);
    fireEvent.click(screen.getByRole('button', { name: 'Verify' }));
    await waitFor(() => {
      expect(screen.getByRole('status').textContent).toBe(
        'Could not update this member. Please try again.',
      );
    });
  });

  it('disables actions while busy and ignores a second click', async () => {
    useAuthStore.setState({ session: 'sess', account: { ...account, role: 'moderator' } });
    let resolveVerify:
      ((value: { id: string; name: string | null; role: 'verified' }) => void) | undefined;
    vi.mocked(postTrustVerify).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveVerify = resolve;
        }),
    );
    vi.mocked(fetchMember).mockResolvedValue({ ...profile, role: 'verified' });
    renderWithLocale(<MemberTrustActions profile={profile} />);
    const button = screen.getByRole('button', { name: 'Verify' }) as HTMLButtonElement;
    fireEvent.click(button);
    fireEvent.click(button);
    expect(button.disabled).toBe(true);
    expect(postTrustVerify).toHaveBeenCalledTimes(1);
    resolveVerify?.({ id: profile.id, name: profile.name, role: 'verified' });
    await waitFor(() => {
      expect(button.disabled).toBe(false);
    });
  });

  it('calls fetchMember and onUpdated after a successful verify', async () => {
    useAuthStore.setState({ session: 'sess', account: { ...account, role: 'moderator' } });
    const updated: MemberProfile = { ...profile, role: 'verified' };
    vi.mocked(postTrustVerify).mockResolvedValue({
      id: profile.id,
      name: profile.name,
      role: 'verified',
    });
    vi.mocked(fetchMember).mockResolvedValue(updated);
    const onUpdated = vi.fn();
    renderWithLocale(<MemberTrustActions profile={profile} onUpdated={onUpdated} />);
    fireEvent.click(screen.getByRole('button', { name: 'Verify' }));
    await waitFor(() => {
      expect(postTrustVerify).toHaveBeenCalledWith('sess', profile.id);
      expect(fetchMember).toHaveBeenCalledWith('sess', profile.id);
      expect(onUpdated).toHaveBeenCalledWith(updated);
      expect(refresh).toHaveBeenCalled();
    });
  });

  it('skips onUpdated when fetchMember returns null', async () => {
    useAuthStore.setState({ session: 'sess', account: { ...account, role: 'moderator' } });
    vi.mocked(postTrustVerify).mockResolvedValue({
      id: profile.id,
      name: profile.name,
      role: 'verified',
    });
    vi.mocked(fetchMember).mockResolvedValue(null);
    const onUpdated = vi.fn();
    renderWithLocale(<MemberTrustActions profile={profile} onUpdated={onUpdated} />);
    fireEvent.click(screen.getByRole('button', { name: 'Verify' }));
    await waitFor(() => {
      expect(fetchMember).toHaveBeenCalled();
      expect(refresh).toHaveBeenCalled();
    });
    expect(onUpdated).not.toHaveBeenCalled();
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
    fireEvent.click(screen.getByRole('button', { name: 'Confirm as moderator' }));
    await waitFor(() => {
      expect(postTrustConfirm).toHaveBeenCalledWith('sess', profile.id);
    });
    cleanup();

    renderWithLocale(<MemberTrustActions profile={profile} />);
    fireEvent.click(screen.getByRole('button', { name: 'Appoint as moderator' }));
    await waitFor(() => {
      expect(postTrustAppoint).toHaveBeenCalledWith('sess', profile.id);
    });
  });
});
