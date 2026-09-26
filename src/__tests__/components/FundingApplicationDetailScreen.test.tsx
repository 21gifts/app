import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FundingApplicationDetailScreen } from '@/components/FundingApplicationDetailScreen';
import type { Account, FundingApplicationDetail, ForumMessage } from '@/lib/api-types';
import { formatForumTime, formatForumTimeFromMs } from '@/lib/forum-time';
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
  fetchFundingApplication: vi.fn(),
  postFundingAdmit: vi.fn(),
  postFundingReject: vi.fn(),
}));

import { fetchFundingApplication, postFundingAdmit, postFundingReject } from '@/lib/api';

const fetchMock = vi.mocked(fetchFundingApplication);
const admitMock = vi.mocked(postFundingAdmit);
const rejectMock = vi.mocked(postFundingReject);

const account: Account = {
  id: 'acc_1',
  linkingKey: '02abcdef',
  role: 'moderator',
  name: 'Ada',
  location: null,
  lightningAddress: 'alice@walletofsatoshi.com',
  lightningAddressVerified: false,
  createdAt: 1_700_000_000,
  forumLawsDismissed: false,
  rulesAgreedAt: 1_700_000_001,
  viewKey: 'a'.repeat(64),
  aboutMe: null,
  aboutMeHasPhoto: false,
  setup: null,
  missing: [],
};

const POST: ForumMessage = {
  id: 'msg_1',
  name: 'Rose',
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

const DETAIL: FundingApplicationDetail = {
  account: {
    id: 'acc_rose',
    name: 'Rose',
    role: 'verified',
    lightningAddress: 'rose@walletofsatoshi.com',
  },
  grant: {
    status: 'pending',
    appliedAt: Date.parse('2026-08-28T12:00:00.000Z'),
    trialUtcDate: null,
    admittedAt: null,
    decidedAt: null,
  },
  messages: [POST],
};

const DECISION = {
  id: 'acc_rose',
  name: 'Rose',
  role: 'verified' as const,
  funding: {
    status: 'trial' as const,
    trialUtcDate: '2026-09-20',
    admittedAt: null,
    reviewedByName: 'Ada',
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  push.mockReset();
  fetchMock.mockResolvedValue(DETAIL);
  admitMock.mockResolvedValue({
    ...DECISION,
    funding: { status: 'admitted', trialUtcDate: null, admittedAt: 1, reviewedByName: 'Ada' },
  });
  rejectMock.mockResolvedValue({
    ...DECISION,
    funding: { status: 'rejected', trialUtcDate: null, admittedAt: null, reviewedByName: null },
  });
  useAuthStore.setState({ session: 'sess', account });
});

afterEach(cleanup);

describe('FundingApplicationDetailScreen', () => {
  it('renders nothing when there is no session', () => {
    useAuthStore.setState({ session: null, account });
    const { container } = renderWithLocale(<FundingApplicationDetailScreen accountId="acc_rose" />);
    expect(container.firstChild).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('shows forbidden copy for a basis account and does not fetch', () => {
    useAuthStore.setState({ session: 'sess', account: { ...account, role: 'basis' } });
    renderWithLocale(<FundingApplicationDetailScreen accountId="acc_rose" />);
    expect(screen.getByRole('heading', { name: 'Grant application' })).toBeTruthy();
    expect(screen.getByText('This page is for moderators.')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Open applications' }).getAttribute('href')).toBe(
      '/grants/applications',
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('shows forbidden copy when the account is missing', () => {
    useAuthStore.setState({ session: 'sess', account: null });
    renderWithLocale(<FundingApplicationDetailScreen accountId="acc_rose" />);
    expect(screen.getByText('This page is for moderators.')).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('shows loading copy', () => {
    fetchMock.mockImplementation(() => new Promise(() => undefined));
    renderWithLocale(<FundingApplicationDetailScreen accountId="acc_rose" />);
    expect(screen.getByText('Loading…')).toBeTruthy();
  });

  it('shows an error and retries', async () => {
    fetchMock.mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce(DETAIL);
    renderWithLocale(<FundingApplicationDetailScreen accountId="acc_rose" />);
    expect(
      await screen.findByText('Could not load this application. Please try again.'),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('button', { name: 'Yes' })).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('shows the staff question, About, and yes/no', async () => {
    renderWithLocale(<FundingApplicationDetailScreen accountId="acc_rose" />);
    expect(await screen.findByRole('link', { name: 'Rose' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Rose' }).getAttribute('href')).toBe(
      '/members/acc_rose',
    );
    expect(
      screen.getAllByText(formatForumTimeFromMs(DETAIL.grant.appliedAt, 'en')).length,
    ).toBeGreaterThan(0);
    expect(
      screen.getByText('Do their profile posts match the core principles of 21.gifts?'),
    ).toBeTruthy();
    expect(screen.getByRole('link', { name: 'About' }).getAttribute('href')).toBe(
      'https://21.gifts/about',
    );
    expect(screen.queryByText('Giving is a duty')).toBeNull();
    expect(screen.getByText('Living-room note.')).toBeTruthy();
    expect(screen.getAllByText(formatForumTime(POST.createdAt, 'en')).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Yes' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'No' })).toBeTruthy();
  });

  it('falls back to Unnamed and hides empty post text', async () => {
    fetchMock.mockResolvedValue({
      ...DETAIL,
      account: { ...DETAIL.account, name: null },
      messages: [{ ...POST, text: '' }],
    });
    renderWithLocale(<FundingApplicationDetailScreen accountId="acc_rose" />);
    expect(await screen.findByRole('link', { name: 'Unnamed' })).toBeTruthy();
    expect(screen.queryByText('Living-room note.')).toBeNull();
  });

  it('falls back to Unnamed for an empty name', async () => {
    fetchMock.mockResolvedValue({
      ...DETAIL,
      account: { ...DETAIL.account, name: '' },
      messages: [],
    });
    renderWithLocale(<FundingApplicationDetailScreen accountId="acc_rose" />);
    expect(await screen.findByRole('link', { name: 'Unnamed' })).toBeTruthy();
    expect(await screen.findByText('No living-room posts.')).toBeTruthy();
  });

  it('shows yes and no when the grant is already on trial', async () => {
    fetchMock.mockResolvedValue({
      ...DETAIL,
      grant: { ...DETAIL.grant, status: 'trial', trialUtcDate: '2026-09-20' },
    });
    renderWithLocale(<FundingApplicationDetailScreen accountId="acc_rose" />);
    expect(await screen.findByRole('button', { name: 'Yes' })).toBeTruthy();
  });

  it('hides decide buttons when the grant is admitted', async () => {
    fetchMock.mockResolvedValue({
      ...DETAIL,
      grant: {
        ...DETAIL.grant,
        status: 'admitted',
        admittedAt: Date.parse('2026-08-28T12:00:00.000Z'),
      },
    });
    renderWithLocale(<FundingApplicationDetailScreen accountId="acc_rose" />);
    expect(await screen.findByRole('link', { name: 'Rose' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Yes' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'No' })).toBeNull();
  });

  it('posts Admit on Yes', async () => {
    renderWithLocale(<FundingApplicationDetailScreen accountId="acc_rose" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Yes' }));
    await waitFor(() => {
      expect(admitMock).toHaveBeenCalledWith('sess', 'acc_rose');
    });
    expect(push).toHaveBeenCalledWith('/grants/applications');
    expect(rejectMock).not.toHaveBeenCalled();
  });

  it('posts Reject when No is clicked', async () => {
    renderWithLocale(<FundingApplicationDetailScreen accountId="acc_rose" />);
    fireEvent.click(await screen.findByRole('button', { name: 'No' }));
    await waitFor(() => {
      expect(rejectMock).toHaveBeenCalledWith('sess', 'acc_rose');
    });
    expect(push).toHaveBeenCalledWith('/grants/applications');
    expect(admitMock).not.toHaveBeenCalled();
  });

  it('posts Reject when requirement is not met', async () => {
    renderWithLocale(<FundingApplicationDetailScreen accountId="acc_rose" />);
    fireEvent.click(await screen.findByRole('button', { name: 'No' }));
    await waitFor(() => {
      expect(rejectMock).toHaveBeenCalledWith('sess', 'acc_rose');
    });
    expect(push).toHaveBeenCalledWith('/grants/applications');
    expect(admitMock).not.toHaveBeenCalled();
  });

  it('shows action-failed copy when a decision throws', async () => {
    rejectMock.mockRejectedValue(new Error('boom'));
    renderWithLocale(<FundingApplicationDetailScreen accountId="acc_rose" />);
    fireEvent.click(await screen.findByRole('button', { name: 'No' }));
    expect(await screen.findByText('Could not update this member. Please try again.')).toBeTruthy();
    expect(push).not.toHaveBeenCalled();
  });

  it('disables decision buttons and shows a spinner while a POST is in flight', async () => {
    rejectMock.mockImplementation(() => new Promise(() => undefined));
    renderWithLocale(<FundingApplicationDetailScreen accountId="acc_rose" />);
    fireEvent.click(await screen.findByRole('button', { name: 'No' }));
    const unmet = screen.getByRole('button', { name: 'No' }) as HTMLButtonElement;
    const met = screen.getByRole('button', { name: 'Yes' }) as HTMLButtonElement;
    expect(unmet.disabled).toBe(true);
    expect(met.disabled).toBe(true);
    expect(unmet.querySelector('.animate-spin')).toBeTruthy();
    fireEvent.click(met);
    fireEvent.click(unmet);
    expect(rejectMock).toHaveBeenCalledTimes(1);
    expect(admitMock).not.toHaveBeenCalled();
  });

  it('ignores a stale resolve after unmount', async () => {
    let resolveDetail: ((value: FundingApplicationDetail) => void) | undefined;
    fetchMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveDetail = resolve;
        }),
    );
    const view = renderWithLocale(<FundingApplicationDetailScreen accountId="acc_rose" />);
    view.unmount();
    await act(async () => {
      resolveDetail?.(DETAIL);
      await Promise.resolve();
    });
    expect(screen.queryByText('Rose')).toBeNull();
  });

  it('ignores a stale reject after unmount', async () => {
    let rejectDetail: ((reason: Error) => void) | undefined;
    fetchMock.mockImplementation(
      () =>
        new Promise((_, reject) => {
          rejectDetail = reject;
        }),
    );
    const view = renderWithLocale(<FundingApplicationDetailScreen accountId="acc_rose" />);
    view.unmount();
    await act(async () => {
      rejectDetail?.(new Error('boom'));
      await Promise.resolve();
    });
    expect(screen.queryByText('Could not load this application. Please try again.')).toBeNull();
  });
});
