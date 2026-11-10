import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FOND_PAYOUT_INTERVAL_MS, FondPayoutSync } from '@/components/FondPayoutSync';
import type { Account } from '@/lib/api-types';
import {
  runFondPayoutTickOnce as runFondPayoutTick,
  waitForFondPayoutRead,
} from '@/lib/wallet/fond-payouts';
import { useAuthStore } from '@/stores/auth-store';
import { useWalletStore } from '@/stores/wallet-store';

vi.mock('@/lib/wallet/fond-payouts', () => ({
  runFondPayoutTickOnce: vi.fn(async () => ({ paid: 0, proved: 0, skipped: 0, stop: null })),
  waitForFondPayoutRead: vi.fn(async () => undefined),
}));

vi.mock('@/lib/api', () => ({
  fetchFondPayouts: vi.fn(),
  postFondPayoutInvoice: vi.fn(),
  postFondPayoutProof: vi.fn(),
}));

vi.mock('@/lib/wallet/wallet-service', () => ({
  payFromWallet: vi.fn(),
  listWalletPayments: vi.fn(),
}));

/**
 * A signed-in account with a role.
 *
 * @param role - The role.
 * @returns The account.
 */
function account(role: Account['role']): Account {
  const baseAccount: Account = {
    id: 'acc_fond',
    linkingKey: null,
    role: 'fond',
    name: 'Fond',
    location: null,
    lightningAddress: null,
    lightningAddressVerified: false,
    forumLawsDismissed: false,
    createdAt: 1,
    rulesAgreedAt: null,
    viewKey: 'a'.repeat(64),
    aboutMe: null,
    aboutMeHasPhoto: false,
    setup: null,
    missing: [],
  };
  return { ...baseAccount, role };
}

/**
 * Puts the auth and wallet stores into one state.
 *
 * @param role - Account role, or `null` to sign out.
 * @param session - Session token, or `null`.
 * @param wallet - Wallet status.
 */
function setState(
  role: Account['role'] | null,
  session: string | null,
  wallet: 'locked' | 'ready',
): void {
  useAuthStore.setState({ account: role === null ? null : account(role), session });
  useWalletStore.setState({ status: wallet, balanceSats: wallet === 'ready' ? 1 : null });
}

async function flush(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
  });
}

beforeEach(() => {
  vi.mocked(runFondPayoutTick).mockReset();
  vi.mocked(runFondPayoutTick).mockResolvedValue({
    paid: 0,
    proved: 0,
    skipped: 0,
    stop: null,
  });
  setState(null, null, 'locked');
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.useRealTimers();
  useAuthStore.setState({ session: null, account: null, wrongAccount: false });
});

describe('FondPayoutSync', () => {
  it('renders nothing and stays idle without the form', async () => {
    const { container } = render(<FondPayoutSync />);
    await flush();
    expect(container.firstChild).toBeNull();
    expect(runFondPayoutTick).not.toHaveBeenCalled();
  });

  it.each([
    ['a signed-out account', null, null, 'ready'],
    ['a session without an account', null, 'sess', 'ready'],
    ['a moderator', 'moderator', 'sess', 'ready'],
    ['a locked wallet', 'fond', 'sess', 'locked'],
  ] as const)('stays idle for %s', async (_label, role, session, wallet) => {
    setState(role, session, wallet);
    render(<FondPayoutSync />);
    await flush();
    expect(runFondPayoutTick).not.toHaveBeenCalled();
  });

  it('runs one tick on activation for a fond account with a ready wallet', async () => {
    setState('fond', 'sess', 'ready');
    render(<FondPayoutSync />);
    await flush();
    expect(runFondPayoutTick).toHaveBeenCalledTimes(1);
    expect(vi.mocked(runFondPayoutTick).mock.calls[0]?.[0]).toMatchObject({ session: 'sess' });
    expect(vi.mocked(runFondPayoutTick).mock.calls[0]?.[0]?.sleep).toBe(waitForFondPayoutRead);
    expect(vi.mocked(runFondPayoutTick).mock.calls[0]?.[0]?.isCancelled()).toBe(false);
  });

  it('cancels the running tick on unmount', async () => {
    let finish: (() => void) | null = null;
    vi.mocked(runFondPayoutTick).mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = () => resolve({ paid: 0, proved: 0, skipped: 0, stop: null });
        }),
    );
    setState('fond', 'sess', 'ready');
    const { unmount } = render(<FondPayoutSync />);
    await flush();
    const deps = vi.mocked(runFondPayoutTick).mock.calls[0]?.[0];
    expect(deps?.isCancelled()).toBe(false);
    unmount();
    expect(deps?.isCancelled()).toBe(true);
    await act(async () => {
      finish?.();
      await Promise.resolve();
    });
  });

  it('cancels the running tick on a sign-out and schedules no further tick', async () => {
    vi.useFakeTimers();
    let finish: (() => void) | null = null;
    vi.mocked(runFondPayoutTick).mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = () => resolve({ paid: 0, proved: 0, skipped: 0, stop: null });
        }),
    );
    setState('fond', 'sess', 'ready');
    render(<FondPayoutSync />);
    await act(async () => {
      await Promise.resolve();
    });
    const deps = vi.mocked(runFondPayoutTick).mock.calls[0]?.[0];
    expect(deps?.isCancelled()).toBe(false);
    act(() => {
      setState(null, null, 'locked');
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(deps?.isCancelled()).toBe(true);
    await act(async () => {
      finish?.();
      await Promise.resolve();
    });
    await act(async () => {
      vi.advanceTimersByTime(FOND_PAYOUT_INTERVAL_MS);
    });
    expect(runFondPayoutTick).toHaveBeenCalledTimes(1);
  });

  it('runs again on the interval and stops one tick from overlapping another', async () => {
    expect(FOND_PAYOUT_INTERVAL_MS).toBe(60_000);
    vi.useFakeTimers();
    let finish: (() => void) | null = null;
    vi.mocked(runFondPayoutTick).mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = () => resolve({ paid: 0, proved: 0, skipped: 0, stop: null });
        }),
    );
    setState('fond', 'sess', 'ready');
    const { unmount } = render(<FondPayoutSync />);
    await act(async () => {
      await Promise.resolve();
    });
    expect(runFondPayoutTick).toHaveBeenCalledTimes(1);
    await act(async () => {
      vi.advanceTimersByTime(FOND_PAYOUT_INTERVAL_MS);
    });
    expect(runFondPayoutTick).toHaveBeenCalledTimes(1);
    await act(async () => {
      finish?.();
      await Promise.resolve();
    });
    await act(async () => {
      vi.advanceTimersByTime(FOND_PAYOUT_INTERVAL_MS);
    });
    expect(runFondPayoutTick).toHaveBeenCalledTimes(2);
    unmount();
    await act(async () => {
      finish?.();
      await Promise.resolve();
    });
    await act(async () => {
      vi.advanceTimersByTime(FOND_PAYOUT_INTERVAL_MS);
    });
    expect(runFondPayoutTick).toHaveBeenCalledTimes(2);
  });

  it('never overlaps two ticks even when one lasts longer than the interval', async () => {
    vi.useFakeTimers();
    let finish: (() => void) | null = null;
    vi.mocked(runFondPayoutTick).mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = () => resolve({ paid: 0, proved: 0, skipped: 0, stop: null });
        }),
    );
    setState('fond', 'sess', 'ready');
    render(<FondPayoutSync />);
    await act(async () => {
      await Promise.resolve();
    });
    for (let i = 0; i < 3; i += 1) {
      await act(async () => {
        vi.advanceTimersByTime(FOND_PAYOUT_INTERVAL_MS);
      });
    }
    expect(runFondPayoutTick).toHaveBeenCalledTimes(1);
    await act(async () => {
      finish?.();
      await Promise.resolve();
    });
    await act(async () => {
      vi.advanceTimersByTime(FOND_PAYOUT_INTERVAL_MS);
    });
    expect(runFondPayoutTick).toHaveBeenCalledTimes(2);
  });

  it('schedules nothing more when unmounted during a tick', async () => {
    vi.useFakeTimers();
    let finish: (() => void) | null = null;
    vi.mocked(runFondPayoutTick).mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = () => resolve({ paid: 0, proved: 0, skipped: 0, stop: null });
        }),
    );
    setState('fond', 'sess', 'ready');
    const { unmount } = render(<FondPayoutSync />);
    await act(async () => {
      await Promise.resolve();
    });
    expect(runFondPayoutTick).toHaveBeenCalledTimes(1);
    unmount();
    await act(async () => {
      finish?.();
      await Promise.resolve();
    });
    await act(async () => {
      vi.advanceTimersByTime(FOND_PAYOUT_INTERVAL_MS);
    });
    expect(runFondPayoutTick).toHaveBeenCalledTimes(1);
  });

  it('stops the loop after forbidden and keeps it stopped for the same account', async () => {
    vi.useFakeTimers();
    vi.mocked(runFondPayoutTick).mockResolvedValue({
      paid: 0,
      proved: 0,
      skipped: 0,
      stop: 'forbidden',
    });
    setState('fond', 'sess', 'ready');
    render(<FondPayoutSync />);
    await act(async () => {
      await Promise.resolve();
    });
    expect(runFondPayoutTick).toHaveBeenCalledTimes(1);
    await act(async () => {
      vi.advanceTimersByTime(FOND_PAYOUT_INTERVAL_MS);
    });
    expect(runFondPayoutTick).toHaveBeenCalledTimes(1);
  });

  it('stops the loop after off and starts again for another account', async () => {
    vi.useFakeTimers();
    vi.mocked(runFondPayoutTick).mockResolvedValue({
      paid: 0,
      proved: 0,
      skipped: 0,
      stop: 'off',
    });
    setState('fond', 'sess', 'ready');
    render(<FondPayoutSync />);
    await act(async () => {
      await Promise.resolve();
    });
    expect(runFondPayoutTick).toHaveBeenCalledTimes(1);
    await act(async () => {
      vi.advanceTimersByTime(FOND_PAYOUT_INTERVAL_MS);
    });
    expect(runFondPayoutTick).toHaveBeenCalledTimes(1);

    vi.mocked(runFondPayoutTick).mockResolvedValue({
      paid: 0,
      proved: 0,
      skipped: 0,
      stop: null,
    });
    act(() => {
      useAuthStore.setState({ session: 'other', account: { ...account('fond'), id: 'acc_other' } });
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(runFondPayoutTick).toHaveBeenCalledTimes(2);
  });

  it('starts again for the same account after a sign-out and sign-in with a new session', async () => {
    vi.useFakeTimers();
    vi.mocked(runFondPayoutTick).mockResolvedValue({
      paid: 0,
      proved: 0,
      skipped: 0,
      stop: 'forbidden',
    });
    setState('fond', 'sess', 'ready');
    render(<FondPayoutSync />);
    await act(async () => {
      await Promise.resolve();
    });
    expect(runFondPayoutTick).toHaveBeenCalledTimes(1);
    act(() => {
      setState(null, null, 'locked');
    });
    await act(async () => {
      await Promise.resolve();
    });
    vi.mocked(runFondPayoutTick).mockResolvedValue({
      paid: 0,
      proved: 0,
      skipped: 0,
      stop: null,
    });
    act(() => {
      setState('fond', 'new-session', 'ready');
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(runFondPayoutTick).toHaveBeenCalledTimes(2);
  });

  it('swallows a rejected tick and retries on the interval', async () => {
    vi.useFakeTimers();
    vi.mocked(runFondPayoutTick).mockRejectedValueOnce(new Error('boom'));
    setState('fond', 'sess', 'ready');
    render(<FondPayoutSync />);
    await act(async () => {
      await Promise.resolve();
    });
    expect(runFondPayoutTick).toHaveBeenCalledTimes(1);
    await act(async () => {
      vi.advanceTimersByTime(FOND_PAYOUT_INTERVAL_MS);
    });
    expect(runFondPayoutTick).toHaveBeenCalledTimes(2);
  });

  it('cleans up the timer when the wallet locks', async () => {
    vi.useFakeTimers();
    setState('fond', 'sess', 'ready');
    const { rerender } = render(<FondPayoutSync />);
    await act(async () => {
      await Promise.resolve();
    });
    expect(runFondPayoutTick).toHaveBeenCalledTimes(1);
    act(() => {
      useWalletStore.setState({ status: 'locked', balanceSats: null });
    });
    rerender(<FondPayoutSync />);
    await act(async () => {
      vi.advanceTimersByTime(FOND_PAYOUT_INTERVAL_MS);
    });
    expect(runFondPayoutTick).toHaveBeenCalledTimes(1);
  });

  it('runs for an initiator, who ranks above fond', async () => {
    setState('initiator', 'sess', 'ready');
    render(<FondPayoutSync />);
    await flush();
    expect(runFondPayoutTick).toHaveBeenCalledTimes(1);
  });
});
