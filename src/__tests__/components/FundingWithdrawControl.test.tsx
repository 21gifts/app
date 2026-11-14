import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FundingWithdrawControl } from '@/components/FundingWithdrawControl';
import type { Account, OwnerFunding } from '@/lib/api-types';
import { useAuthStore } from '@/stores/auth-store';
import { renderWithLocale } from '@/__tests__/render-with-locale';

vi.mock('@/lib/api', () => ({
  fetchMe: vi.fn(),
  postFundingWithdraw: vi.fn(),
}));

vi.mock('@/lib/owner-account-refresh', () => ({
  discardOwnerRefreshes: vi.fn(),
  refreshOwnerAccount: vi.fn(),
}));

import { fetchMe, postFundingWithdraw } from '@/lib/api';
import { discardOwnerRefreshes, refreshOwnerAccount } from '@/lib/owner-account-refresh';

const withdrawMock = vi.mocked(postFundingWithdraw);
const meMock = vi.mocked(fetchMe);
const refreshMock = vi.mocked(refreshOwnerAccount);
const discardMock = vi.mocked(discardOwnerRefreshes);

const admitted: OwnerFunding = {
  status: 'admitted',
  trialUtcDate: null,
  admittedAt: 1_700_000_000_000,
  reviewedByName: 'Ada',
};

const none: OwnerFunding = {
  status: 'none',
  trialUtcDate: null,
  admittedAt: null,
  reviewedByName: null,
};

const account: Account = {
  id: 'acc_1',
  linkingKey: '02abcdef',
  role: 'verified',
  name: 'Ada',
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
  funding: admitted,
};

const LEAVE_TITLE = 'Leave the grant?';
const LEAVE_BODY =
  'Your daily payout stops today. Your place becomes free for someone else. You can apply again later, but a place is not guaranteed.';

/** Opens the confirm step of the admitted control. */
function openLeave(): void {
  renderWithLocale(<FundingWithdrawControl status="admitted" />);
  fireEvent.click(screen.getByRole('button', { name: 'Leave the grant' }));
}

beforeEach(() => {
  withdrawMock.mockReset();
  meMock.mockReset();
  refreshMock.mockReset();
  discardMock.mockReset();
  useAuthStore.setState({ session: 'sess', account });
});

afterEach(cleanup);

describe('FundingWithdrawControl', () => {
  it('offers Leave the grant for an admitted member and sends nothing before the confirm', () => {
    renderWithLocale(<FundingWithdrawControl status="admitted" />);
    const action = screen.getByRole('button', { name: 'Leave the grant' });
    expect(action.className).toContain('underline');
    fireEvent.click(action);
    expect(withdrawMock).not.toHaveBeenCalled();
    const group = screen.getByRole('group', { name: LEAVE_TITLE });
    expect(group.textContent).toContain(LEAVE_BODY);
    expect(screen.getByRole('button', { name: 'Leave the grant' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeTruthy();
  });

  it('offers Leave the grant with the same question for a trial', () => {
    renderWithLocale(<FundingWithdrawControl status="trial" />);
    fireEvent.click(screen.getByRole('button', { name: 'Leave the grant' }));
    expect(screen.getByRole('group', { name: LEAVE_TITLE }).textContent).toContain(LEAVE_BODY);
  });

  it('offers Withdraw my application with its own question for a pending application', () => {
    renderWithLocale(<FundingWithdrawControl status="pending" />);
    fireEvent.click(screen.getByRole('button', { name: 'Withdraw my application' }));
    const group = screen.getByRole('group', { name: 'Withdraw your application?' });
    expect(group.textContent).toContain(
      'A moderator will no longer review it. You can apply again later.',
    );
    expect(screen.getByRole('button', { name: 'Withdraw my application' })).toBeTruthy();
  });

  it('closes the question on Cancel without sending', () => {
    openLeave();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('group', { name: LEAVE_TITLE })).toBeNull();
    expect(screen.getByRole('button', { name: 'Leave the grant' })).toBeTruthy();
    expect(withdrawMock).not.toHaveBeenCalled();
  });

  it("stores the answered funding, reloads today's payout, and closes the question on success", async () => {
    withdrawMock.mockResolvedValue(none);
    openLeave();
    fireEvent.click(screen.getByRole('button', { name: 'Leave the grant' }));
    expect(withdrawMock).toHaveBeenCalledWith('sess');
    await waitFor(() => {
      expect(useAuthStore.getState().account?.funding).toEqual(none);
    });
    expect(refreshMock).toHaveBeenCalledTimes(1);
    expect(refreshMock).toHaveBeenCalledWith('sess');
    expect(discardMock).toHaveBeenCalledTimes(1);
    expect(discardMock.mock.invocationCallOrder[0]).toBeLessThan(
      refreshMock.mock.invocationCallOrder[0] as number,
    );
    expect(screen.queryByRole('group', { name: LEAVE_TITLE })).toBeNull();
  });

  it('disables both actions while the request runs and sends one request on a double tap', async () => {
    let resolve: (value: OwnerFunding) => void = () => undefined;
    withdrawMock.mockReturnValue(
      new Promise<OwnerFunding>((next) => {
        resolve = next;
      }),
    );
    openLeave();
    const confirm = screen.getByRole('button', { name: 'Leave the grant' });
    fireEvent.click(confirm);
    fireEvent.click(confirm);
    expect(withdrawMock).toHaveBeenCalledTimes(1);
    expect(confirm.hasAttribute('disabled')).toBe(true);
    expect(screen.getByRole('button', { name: 'Cancel' }).hasAttribute('disabled')).toBe(true);
    expect(confirm.querySelector('.animate-spin')).not.toBeNull();
    await act(async () => {
      resolve(none);
      await Promise.resolve();
    });
    expect(withdrawMock).toHaveBeenCalledTimes(1);
  });

  it('ignores a second confirm that arrives before the busy state renders', async () => {
    let resolve: (value: OwnerFunding) => void = () => undefined;
    withdrawMock.mockReturnValue(
      new Promise<OwnerFunding>((next) => {
        resolve = next;
      }),
    );
    openLeave();
    const confirm = screen.getByRole('button', { name: 'Leave the grant' });
    act(() => {
      confirm.click();
      confirm.click();
    });
    expect(withdrawMock).toHaveBeenCalledTimes(1);
    await act(async () => {
      resolve(none);
      await Promise.resolve();
    });
  });

  it('reloads the account on 409 and shows the current state without an error', async () => {
    withdrawMock.mockRejectedValue(new Error('Conflict'));
    const reloaded: Account = { ...account, funding: none };
    meMock.mockResolvedValue(reloaded);
    openLeave();
    fireEvent.click(screen.getByRole('button', { name: 'Leave the grant' }));
    await waitFor(() => {
      expect(useAuthStore.getState().account).toEqual(reloaded);
    });
    expect(meMock).toHaveBeenCalledWith('sess');
    expect(discardMock).toHaveBeenCalledTimes(1);
    expect(refreshMock).not.toHaveBeenCalled();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByRole('group', { name: LEAVE_TITLE })).toBeNull();
  });

  it('signs out when the reload after 409 answers 401', async () => {
    withdrawMock.mockRejectedValue(new Error('Conflict'));
    meMock.mockResolvedValue(null);
    openLeave();
    fireEvent.click(screen.getByRole('button', { name: 'Leave the grant' }));
    await waitFor(() => {
      expect(useAuthStore.getState().session).toBeNull();
    });
    expect(useAuthStore.getState().account).toBeNull();
  });

  it('shows the inline error and keeps the question open when the reload after 409 fails', async () => {
    withdrawMock.mockRejectedValue(new Error('Conflict'));
    meMock.mockRejectedValue(new Error('Failed to fetch account: 503'));
    openLeave();
    fireEvent.click(screen.getByRole('button', { name: 'Leave the grant' }));
    expect((await screen.findByRole('alert')).textContent).toBe(
      'Could not leave the grant. Please try again.',
    );
    expect(screen.getByRole('group', { name: LEAVE_TITLE })).toBeTruthy();
    expect(useAuthStore.getState().account).toEqual(account);
    expect(discardMock).not.toHaveBeenCalled();
  });

  it('keeps the newer session when another login replaced it during the reload', async () => {
    withdrawMock.mockRejectedValue(new Error('Conflict'));
    meMock.mockImplementation(async () => {
      useAuthStore.setState({ session: 'other', account });
      return null;
    });
    openLeave();
    fireEvent.click(screen.getByRole('button', { name: 'Leave the grant' }));
    await waitFor(() => {
      expect(meMock).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(screen.queryByRole('group', { name: LEAVE_TITLE })).toBeNull();
    });
    expect(useAuthStore.getState().session).toBe('other');
  });

  it('clears the session on 401', async () => {
    withdrawMock.mockRejectedValue(new Error('Unauthorized'));
    openLeave();
    fireEvent.click(screen.getByRole('button', { name: 'Leave the grant' }));
    await waitFor(() => {
      expect(useAuthStore.getState().session).toBeNull();
    });
    expect(meMock).not.toHaveBeenCalled();
  });

  it('shows the inline error and keeps the question open on any other failure, then retries', async () => {
    withdrawMock.mockRejectedValueOnce(new Error('Could not withdraw. Please try again.'));
    openLeave();
    fireEvent.click(screen.getByRole('button', { name: 'Leave the grant' }));
    expect((await screen.findByRole('alert')).textContent).toBe(
      'Could not leave the grant. Please try again.',
    );
    const confirm = screen.getByRole('button', { name: 'Leave the grant' });
    expect(confirm.hasAttribute('disabled')).toBe(false);
    expect(refreshMock).not.toHaveBeenCalled();
    expect(discardMock).not.toHaveBeenCalled();
    withdrawMock.mockResolvedValueOnce(none);
    fireEvent.click(confirm);
    await waitFor(() => {
      expect(useAuthStore.getState().account?.funding).toEqual(none);
    });
    expect(withdrawMock).toHaveBeenCalledTimes(2);
  });

  it('shows the application error for a pending withdrawal and clears it on Cancel', async () => {
    withdrawMock.mockRejectedValue('offline');
    renderWithLocale(<FundingWithdrawControl status="pending" />);
    fireEvent.click(screen.getByRole('button', { name: 'Withdraw my application' }));
    fireEvent.click(screen.getByRole('button', { name: 'Withdraw my application' }));
    expect((await screen.findByRole('alert')).textContent).toBe(
      'Could not withdraw your application. Please try again.',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    fireEvent.click(screen.getByRole('button', { name: 'Withdraw my application' }));
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('sends nothing without a session', () => {
    openLeave();
    useAuthStore.setState({ session: null, account: null });
    fireEvent.click(screen.getByRole('button', { name: 'Leave the grant' }));
    expect(withdrawMock).not.toHaveBeenCalled();
  });

  it('drops a success answer that arrives after the session changed', async () => {
    withdrawMock.mockImplementation(async () => {
      useAuthStore.setState({ session: 'other', account });
      return none;
    });
    openLeave();
    fireEvent.click(screen.getByRole('button', { name: 'Leave the grant' }));
    await waitFor(() => {
      expect(withdrawMock).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Leave the grant' }).hasAttribute('disabled')).toBe(
        false,
      );
    });
    expect(useAuthStore.getState().account?.funding).toEqual(admitted);
    expect(refreshMock).not.toHaveBeenCalled();
  });

  it('drops a failure that arrives after the session changed', async () => {
    withdrawMock.mockImplementation(async () => {
      useAuthStore.setState({ session: 'other', account });
      throw new Error('Unauthorized');
    });
    openLeave();
    fireEvent.click(screen.getByRole('button', { name: 'Leave the grant' }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Leave the grant' }).hasAttribute('disabled')).toBe(
        false,
      );
    });
    expect(useAuthStore.getState().session).toBe('other');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('drops a success answer when the account is gone', async () => {
    withdrawMock.mockImplementation(async () => {
      useAuthStore.setState({ account: null });
      return none;
    });
    openLeave();
    fireEvent.click(screen.getByRole('button', { name: 'Leave the grant' }));
    await waitFor(() => {
      expect(withdrawMock).toHaveBeenCalled();
    });
    expect(useAuthStore.getState().account).toBeNull();
    expect(refreshMock).not.toHaveBeenCalled();
  });
});
