import { act, cleanup, fireEvent, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TeamMemberSearchScreen } from '@/components/TeamMemberSearchScreen';
import type { Account } from '@/lib/api-types';
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

vi.mock('@/lib/api', () => ({ searchTeamMembers: vi.fn() }));

import { searchTeamMembers } from '@/lib/api';

const searchMock = vi.mocked(searchTeamMembers);

const account: Account = {
  id: 'acc_mod',
  linkingKey: null,
  role: 'moderator',
  name: 'Mo',
  location: null,
  lightningAddress: null,
  lightningAddressVerified: false,
  forumLawsDismissed: false,
  createdAt: 1_700_000_000,
  rulesAgreedAt: 1_700_000_001,
  viewKey: 'a'.repeat(64),
  aboutMe: null,
  aboutMeHasPhoto: false,
  setup: null,
  missing: [],
};

/** Types into the search field and lets the pause pass. */
async function type(text: string): Promise<void> {
  fireEvent.change(screen.getByLabelText('Name or username'), { target: { value: text } });
  await act(async () => {
    await vi.advanceTimersByTimeAsync(300);
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  useAuthStore.setState({ session: 'sess', account });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('TeamMemberSearchScreen', () => {
  it('shows the hint and sends nothing while the field is empty', async () => {
    renderWithLocale(<TeamMemberSearchScreen />);
    expect(screen.getByRole('heading', { name: 'Member data' })).toBeTruthy();
    expect(screen.getByText('Type a name or username.')).toBeTruthy();
    await type('   ');
    expect(searchMock).not.toHaveBeenCalled();
  });

  it('lists matches after the pause, each linking to the member page', async () => {
    searchMock.mockResolvedValue([
      { id: 'acc_ada', name: 'Ada', username: 'ada' },
      { id: 'acc/x', name: '', username: null },
      { id: 'acc_y', name: null },
    ]);
    renderWithLocale(<TeamMemberSearchScreen />);
    fireEvent.change(screen.getByLabelText('Name or username'), { target: { value: ' Ad ' } });
    expect(screen.getByText('Loading…')).toBeTruthy();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });
    expect(searchMock).toHaveBeenCalledTimes(1);
    expect(searchMock).toHaveBeenCalledWith('sess', 'Ad');
    const list = screen.getByRole('list', { name: 'Members found' });
    expect(list.querySelectorAll('a')[0]?.getAttribute('href')).toBe('/moderate/members/acc_ada');
    expect(list.querySelectorAll('a')[1]?.getAttribute('href')).toBe('/moderate/members/acc%2Fx');
    expect(screen.getByText('@ada')).toBeTruthy();
    expect(screen.getAllByText('Unnamed')).toHaveLength(2);
  });

  it('drops the answer of an older text', async () => {
    let first: (rows: []) => void = () => undefined;
    searchMock
      .mockImplementationOnce(
        () =>
          new Promise((done) => {
            first = done;
          }),
      )
      .mockResolvedValueOnce([]);
    renderWithLocale(<TeamMemberSearchScreen />);
    await type('a');
    await type('ab');
    await act(async () => {
      first([]);
      await Promise.resolve();
    });
    expect(screen.getByText('No member found.')).toBeTruthy();
    expect(searchMock).toHaveBeenLastCalledWith('sess', 'ab');
  });

  it('drops a failure of an older text', async () => {
    let fail: (error: Error) => void = () => undefined;
    searchMock
      .mockImplementationOnce(
        () =>
          new Promise((_done, reject) => {
            fail = reject;
          }),
      )
      .mockResolvedValueOnce([]);
    renderWithLocale(<TeamMemberSearchScreen />);
    await type('a');
    await type('ab');
    await act(async () => {
      fail(new Error('late'));
      await Promise.resolve();
    });
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('shows the error and tries again', async () => {
    searchMock.mockRejectedValueOnce(new Error('down')).mockResolvedValueOnce([]);
    renderWithLocale(<TeamMemberSearchScreen />);
    await type('ada');
    expect(screen.getByText('Could not search members. Please try again.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });
    expect(screen.getByText('No member found.')).toBeTruthy();
  });

  it('shows the forbidden sentence when the api refuses the role', async () => {
    searchMock.mockResolvedValue(null);
    renderWithLocale(<TeamMemberSearchScreen />);
    await type('ada');
    expect(screen.getByText('This page is for moderators.')).toBeTruthy();
    expect(screen.queryByLabelText('Name or username')).toBeNull();
  });

  it('shows the forbidden sentence to a lower role and sends nothing', async () => {
    useAuthStore.setState({ session: 'sess', account: { ...account, role: 'verified' } });
    renderWithLocale(<TeamMemberSearchScreen />);
    expect(screen.getByText('This page is for moderators.')).toBeTruthy();
    expect(searchMock).not.toHaveBeenCalled();
  });

  it('renders nothing without a session', () => {
    useAuthStore.setState({ session: null, account: null });
    const { container } = renderWithLocale(<TeamMemberSearchScreen />);
    expect(container.innerHTML).toBe('');
  });
});
