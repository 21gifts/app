import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProposalsScreen } from '@/components/ProposalsScreen';
import type { Account, ModeratorProposal } from '@/lib/api-types';
import { formatForumTime } from '@/lib/forum-time';
import { useAuthStore } from '@/stores/auth-store';
import { renderWithLocale } from '@/__tests__/render-with-locale';

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
  fetchTrustProposals: vi.fn(),
  postTrustConfirm: vi.fn(),
}));

import { fetchTrustProposals, postTrustConfirm } from '@/lib/api';

const proposalsMock = vi.mocked(fetchTrustProposals);
const confirmMock = vi.mocked(postTrustConfirm);

const account: Account = {
  id: 'acc_1',
  linkingKey: '02abcdef',
  role: 'moderator',
  name: 'Ada',
  location: null,
  lightningAddress: 'alice@walletofsatoshi.com',
  lightningAddressVerified: false,
  forumLawsDismissed: false,
  createdAt: 1_700_000_000,
  rulesAgreedAt: 1_700_000_001,
  viewKey: 'a'.repeat(64),
  aboutMe: null,
  setup: null,
  missing: [],
};

const PROPOSAL: ModeratorProposal = {
  subject: { id: 'acc_rose', name: 'Rose', role: 'verified' },
  proposedBy: { id: 'acc_bob', name: 'Bob' },
  createdAt: '2026-08-28T12:00:00.000Z',
};

beforeEach(() => {
  vi.clearAllMocks();
  proposalsMock.mockResolvedValue([]);
  confirmMock.mockResolvedValue({ id: 'acc_rose', name: 'Rose', role: 'moderator' });
  useAuthStore.setState({ session: 'sess', account });
});

afterEach(cleanup);

describe('ProposalsScreen', () => {
  it('renders nothing when there is no session', () => {
    useAuthStore.setState({ session: null, account });
    const { container } = renderWithLocale(<ProposalsScreen />);
    expect(container.firstChild).toBeNull();
    expect(proposalsMock).not.toHaveBeenCalled();
  });

  it('shows forbidden copy for a basis account and does not fetch', () => {
    useAuthStore.setState({ session: 'sess', account: { ...account, role: 'basis' } });
    renderWithLocale(<ProposalsScreen />);
    expect(screen.getByRole('heading', { name: 'Open proposals' })).toBeTruthy();
    expect(screen.getByText('This page is for founders and moderators.')).toBeTruthy();
    expect(screen.queryByText('No open proposals.')).toBeNull();
    expect(screen.queryByRole('list')).toBeNull();
    expect(screen.getByRole('link', { name: 'Moderation' }).getAttribute('href')).toBe('/moderate');
    expect(screen.queryByText('Moderation')).toBeNull();
    expect(proposalsMock).not.toHaveBeenCalled();
  });

  it('shows forbidden copy for a verified account and does not fetch', () => {
    useAuthStore.setState({ session: 'sess', account: { ...account, role: 'verified' } });
    renderWithLocale(<ProposalsScreen />);
    expect(screen.getByText('This page is for founders and moderators.')).toBeTruthy();
    expect(proposalsMock).not.toHaveBeenCalled();
  });

  it('shows forbidden copy when the account is missing', () => {
    useAuthStore.setState({ session: 'sess', account: null });
    renderWithLocale(<ProposalsScreen />);
    expect(screen.getByText('This page is for founders and moderators.')).toBeTruthy();
    expect(proposalsMock).not.toHaveBeenCalled();
  });

  it('shows loading heading and copy', () => {
    proposalsMock.mockImplementation(() => new Promise(() => undefined));
    renderWithLocale(<ProposalsScreen />);
    expect(screen.getByRole('heading', { name: 'Open proposals' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Moderation' }).getAttribute('href')).toBe('/moderate');
    expect(screen.queryByText('Moderation')).toBeNull();
    expect(screen.getByText('Loading…')).toBeTruthy();
  });

  it('shows empty copy', async () => {
    proposalsMock.mockResolvedValue([]);
    renderWithLocale(<ProposalsScreen />);
    expect(await screen.findByText('No open proposals.')).toBeTruthy();
    expect(proposalsMock).toHaveBeenCalledWith('sess');
  });

  it('shows an error and retries', async () => {
    proposalsMock.mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce([PROPOSAL]);
    renderWithLocale(<ProposalsScreen />);
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toBe('Could not load open proposals. Please try again.');
    expect(alert.className).toContain('text-app-danger');
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('button', { name: 'Confirm as moderator' })).toBeTruthy();
    expect(proposalsMock).toHaveBeenCalledTimes(2);
  });

  it('fetches for a founder account', async () => {
    useAuthStore.setState({ session: 'sess', account: { ...account, role: 'founder' } });
    proposalsMock.mockResolvedValue([PROPOSAL]);
    renderWithLocale(<ProposalsScreen />);
    expect(await screen.findByRole('button', { name: 'Confirm as moderator' })).toBeTruthy();
    expect(proposalsMock).toHaveBeenCalledWith('sess');
  });

  it('shows a proposal with Confirm as moderator', async () => {
    proposalsMock.mockResolvedValue([PROPOSAL]);
    renderWithLocale(<ProposalsScreen />);
    expect(await screen.findByRole('heading', { name: 'Open proposals' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Rose' }).getAttribute('href')).toBe(
      '/members/acc_rose',
    );
    expect(screen.getByText('Proposed by Bob')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Confirm as moderator' })).toBeTruthy();
    expect(screen.getByText(formatForumTime(PROPOSAL.createdAt, 'en'))).toBeTruthy();
  });

  it('shows waiting copy and no Confirm on a self-proposal', async () => {
    proposalsMock.mockResolvedValue([{ ...PROPOSAL, proposedBy: { id: account.id, name: 'Ada' } }]);
    renderWithLocale(<ProposalsScreen />);
    expect(await screen.findByText('Rose')).toBeTruthy();
    expect(screen.getByText('Waiting for another moderator to confirm.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Confirm as moderator' })).toBeNull();
  });

  it('confirms a proposal and removes the row', async () => {
    proposalsMock.mockResolvedValue([PROPOSAL]);
    renderWithLocale(<ProposalsScreen />);
    fireEvent.click(await screen.findByRole('button', { name: 'Confirm as moderator' }));
    await waitFor(() => {
      expect(confirmMock).toHaveBeenCalledWith('sess', 'acc_rose');
    });
    await waitFor(() => {
      expect(screen.queryByText('Rose')).toBeNull();
    });
    expect(screen.getByText('No open proposals.')).toBeTruthy();
  });

  it('shows action-failed copy when confirm throws', async () => {
    proposalsMock.mockResolvedValue([PROPOSAL]);
    confirmMock.mockRejectedValue(new Error('boom'));
    renderWithLocale(<ProposalsScreen />);
    fireEvent.click(await screen.findByRole('button', { name: 'Confirm as moderator' }));
    expect(await screen.findByText('Could not update this member. Please try again.')).toBeTruthy();
    expect(screen.getByText('Rose')).toBeTruthy();
  });

  it('falls back to Unnamed for proposal names', async () => {
    proposalsMock.mockResolvedValue([
      {
        subject: { id: 'acc_x', name: null, role: 'verified' },
        proposedBy: { id: 'acc_bob', name: '' },
        createdAt: '2026-08-28T12:00:00.000Z',
      },
    ]);
    renderWithLocale(<ProposalsScreen />);
    expect(await screen.findByRole('link', { name: 'Unnamed' })).toBeTruthy();
    expect(screen.getByText('Proposed by Unnamed')).toBeTruthy();
  });

  it('ignores a stale proposals resolve after unmount', async () => {
    let resolveProposals: ((value: ModeratorProposal[]) => void) | undefined;
    proposalsMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveProposals = resolve;
        }),
    );
    const view = renderWithLocale(<ProposalsScreen />);
    view.unmount();
    await act(async () => {
      resolveProposals?.([PROPOSAL]);
      await Promise.resolve();
    });
    expect(screen.queryByText('Rose')).toBeNull();
  });

  it('ignores a stale proposals reject after unmount', async () => {
    let rejectProposals: ((reason: Error) => void) | undefined;
    proposalsMock.mockImplementation(
      () =>
        new Promise((_, reject) => {
          rejectProposals = reject;
        }),
    );
    const view = renderWithLocale(<ProposalsScreen />);
    view.unmount();
    await act(async () => {
      rejectProposals?.(new Error('boom'));
      await Promise.resolve();
    });
    expect(screen.queryByText('Could not load open proposals. Please try again.')).toBeNull();
  });

  it('does not apply a late resolve after the session is cleared', async () => {
    let resolveProposals: ((value: ModeratorProposal[]) => void) | undefined;
    proposalsMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveProposals = resolve;
        }),
    );
    renderWithLocale(<ProposalsScreen />);
    expect(screen.getByText('Loading…')).toBeTruthy();
    useAuthStore.setState({ session: null, account: null });
    await waitFor(() => {
      expect(screen.queryByText('Loading…')).toBeNull();
    });
    await act(async () => {
      resolveProposals?.([PROPOSAL]);
      await Promise.resolve();
    });
    expect(screen.queryByText('Rose')).toBeNull();
  });
});
