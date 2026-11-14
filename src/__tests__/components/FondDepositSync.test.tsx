import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FondDepositSync } from '@/components/FondDepositSync';
import { putFondDepositAddress } from '@/lib/api';
import type { Account } from '@/lib/api-types';
import { claimFondDeposits, registerFondDepositAddress } from '@/lib/wallet/fond-deposits';
import { fondE2eWallet } from '@/lib/wallet/fond-payouts';
import {
  claimWalletDeposit,
  listWalletUnclaimedDeposits,
  onWalletDeposits,
  receiveWalletBitcoinAddress,
} from '@/lib/wallet/wallet-service';
import { useAuthStore } from '@/stores/auth-store';
import { useWalletStore } from '@/stores/wallet-store';

const depositListeners = vi.hoisted(() => new Set<() => void>());

vi.mock('@/lib/wallet/fond-deposits', () => ({
  claimFondDeposits: vi.fn(async () => 0),
  registerFondDepositAddress: vi.fn(async () => 'registered'),
}));

vi.mock('@/lib/wallet/fond-payouts', () => ({
  fondE2eWallet: vi.fn(() => null),
}));

vi.mock('@/lib/api', () => ({
  putFondDepositAddress: vi.fn(),
}));

vi.mock('@/lib/wallet/wallet-service', () => ({
  claimWalletDeposit: vi.fn(),
  listWalletUnclaimedDeposits: vi.fn(),
  receiveWalletBitcoinAddress: vi.fn(),
  onWalletDeposits: vi.fn((listener: () => void) => {
    depositListeners.add(listener);
    return () => {
      depositListeners.delete(listener);
    };
  }),
}));

/**
 * A signed-in account with a role.
 *
 * @param role - The role.
 * @param id - Account id.
 * @returns The account.
 */
function account(role: Account['role'], id = 'acc_fond'): Account {
  return {
    id,
    linkingKey: null,
    role,
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
  act(() => {
    useAuthStore.setState({ account: role === null ? null : account(role), session });
    useWalletStore.setState({ status: wallet, balanceSats: wallet === 'ready' ? 1 : null });
  });
}

async function flush(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

beforeEach(() => {
  depositListeners.clear();
  vi.mocked(fondE2eWallet).mockReturnValue(null);
  vi.mocked(registerFondDepositAddress).mockResolvedValue('registered');
  vi.mocked(claimFondDeposits).mockResolvedValue(0);
  setState(null, null, 'locked');
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  useAuthStore.setState({ session: null, account: null, wrongAccount: false });
});

describe('FondDepositSync', () => {
  it('renders nothing and stays idle while signed out', async () => {
    const { container } = render(<FondDepositSync />);
    await flush();
    expect(container.firstChild).toBeNull();
    expect(registerFondDepositAddress).not.toHaveBeenCalled();
    expect(claimFondDeposits).not.toHaveBeenCalled();
  });

  it.each([
    ['a session without an account', null, 'sess', 'ready'],
    ['a moderator', 'moderator', 'sess', 'ready'],
    ['a locked wallet', 'fond', 'sess', 'locked'],
  ] as const)('stays idle for %s', async (_label, role, session, wallet) => {
    setState(role, session, wallet);
    render(<FondDepositSync />);
    await flush();
    expect(registerFondDepositAddress).not.toHaveBeenCalled();
    expect(claimFondDeposits).not.toHaveBeenCalled();
  });

  it('registers the wallet address with the session and the real wallet and api', async () => {
    setState('fond', 'sess', 'ready');
    render(<FondDepositSync />);
    await flush();
    expect(registerFondDepositAddress).toHaveBeenCalledTimes(1);
    expect(vi.mocked(registerFondDepositAddress).mock.calls[0]?.[0]).toEqual({
      session: 'sess',
      receiveBitcoinAddress: receiveWalletBitcoinAddress,
      putFondDepositAddress,
    });
  });

  it('registers once per session across wallet reconnects', async () => {
    setState('fond', 'sess', 'ready');
    render(<FondDepositSync />);
    await flush();
    setState('fond', 'sess', 'locked');
    setState('fond', 'sess', 'ready');
    await flush();
    expect(registerFondDepositAddress).toHaveBeenCalledTimes(1);
  });

  it('registers again for a new session', async () => {
    setState('fond', 'sess', 'ready');
    render(<FondDepositSync />);
    await flush();
    setState('fond', 'sess-2', 'ready');
    await flush();
    expect(registerFondDepositAddress).toHaveBeenCalledTimes(2);
    expect(vi.mocked(registerFondDepositAddress).mock.calls[1]?.[0].session).toBe('sess-2');
  });

  it('stops for the session after a 403 or 404 answer, even after a reconnect', async () => {
    vi.mocked(registerFondDepositAddress).mockResolvedValue('stop');
    setState('fond', 'sess', 'ready');
    render(<FondDepositSync />);
    await flush();
    setState('fond', 'sess', 'locked');
    setState('fond', 'sess', 'ready');
    await flush();
    expect(registerFondDepositAddress).toHaveBeenCalledTimes(1);
  });

  it('retries a failed registration on the next activation, not before', async () => {
    vi.mocked(registerFondDepositAddress).mockResolvedValueOnce('retry');
    setState('fond', 'sess', 'ready');
    render(<FondDepositSync />);
    await flush();
    await flush();
    expect(registerFondDepositAddress).toHaveBeenCalledTimes(1);
    setState('fond', 'sess', 'locked');
    setState('fond', 'sess', 'ready');
    await flush();
    expect(registerFondDepositAddress).toHaveBeenCalledTimes(2);
  });

  it('retries a registration that threw on the next activation', async () => {
    vi.mocked(registerFondDepositAddress).mockRejectedValueOnce(new Error('boom'));
    setState('fond', 'sess', 'ready');
    render(<FondDepositSync />);
    await flush();
    setState('fond', 'sess', 'locked');
    setState('fond', 'sess', 'ready');
    await flush();
    expect(registerFondDepositAddress).toHaveBeenCalledTimes(2);
  });

  it('does not start a second registration while one is in flight', async () => {
    let finish: (value: 'registered') => void = () => undefined;
    vi.mocked(registerFondDepositAddress).mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    setState('fond', 'sess', 'ready');
    render(<FondDepositSync />);
    await flush();
    setState('fond', 'sess', 'locked');
    setState('fond', 'sess', 'ready');
    await flush();
    expect(registerFondDepositAddress).toHaveBeenCalledTimes(1);
    finish('registered');
    await flush();
  });

  it('keeps the newer in-flight key when an older registration settles', async () => {
    let finishFirst: (value: 'retry') => void = () => undefined;
    vi.mocked(registerFondDepositAddress)
      .mockReturnValueOnce(
        new Promise((resolve) => {
          finishFirst = resolve;
        }),
      )
      .mockReturnValueOnce(new Promise(() => undefined));
    setState('fond', 'sess', 'ready');
    render(<FondDepositSync />);
    await flush();
    setState('fond', 'sess-2', 'ready');
    await flush();
    finishFirst('retry');
    await flush();
    setState('fond', 'sess-2', 'locked');
    setState('fond', 'sess-2', 'ready');
    await flush();
    expect(registerFondDepositAddress).toHaveBeenCalledTimes(2);
  });

  it.each(['stop', 'retry'] as const)(
    'never claims for an account whose registration answered %s',
    async (outcome) => {
      vi.mocked(registerFondDepositAddress).mockResolvedValue(outcome);
      setState('founder', 'sess', 'ready');
      render(<FondDepositSync />);
      await flush();
      setState('founder', 'sess', 'locked');
      setState('founder', 'sess', 'ready');
      await flush();
      expect(claimFondDeposits).not.toHaveBeenCalled();
      expect(onWalletDeposits).not.toHaveBeenCalled();
    },
  );

  it('claims for the new session only after its own registration', async () => {
    setState('fond', 'sess', 'ready');
    render(<FondDepositSync />);
    await flush();
    expect(claimFondDeposits).toHaveBeenCalledTimes(1);
    vi.mocked(registerFondDepositAddress).mockResolvedValue('stop');
    setState('fond', 'sess-2', 'ready');
    await flush();
    expect(claimFondDeposits).toHaveBeenCalledTimes(1);
    expect(depositListeners.size).toBe(0);
  });

  it('claims deposits on activation and on every deposit report', async () => {
    setState('fond', 'sess', 'ready');
    render(<FondDepositSync />);
    await flush();
    expect(claimFondDeposits).toHaveBeenCalledTimes(1);
    expect(vi.mocked(claimFondDeposits).mock.calls[0]?.[0]).toMatchObject({
      listUnclaimedDeposits: listWalletUnclaimedDeposits,
      claimDeposit: claimWalletDeposit,
    });
    expect(vi.mocked(claimFondDeposits).mock.calls[0]?.[0].isCancelled()).toBe(false);
    expect(onWalletDeposits).toHaveBeenCalledTimes(1);
    act(() => {
      for (const listener of depositListeners) {
        listener();
      }
    });
    await flush();
    expect(claimFondDeposits).toHaveBeenCalledTimes(2);
  });

  it('absorbs a deposit report while a pass is still running', async () => {
    let finish: (value: number) => void = () => undefined;
    vi.mocked(claimFondDeposits).mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    setState('fond', 'sess', 'ready');
    render(<FondDepositSync />);
    await flush();
    act(() => {
      for (const listener of depositListeners) {
        listener();
      }
    });
    await flush();
    expect(claimFondDeposits).toHaveBeenCalledTimes(1);
    finish(0);
    await flush();
  });

  it('keeps listening after a failed pass', async () => {
    vi.mocked(claimFondDeposits).mockRejectedValueOnce(new Error('list failed'));
    setState('fond', 'sess', 'ready');
    render(<FondDepositSync />);
    await flush();
    act(() => {
      for (const listener of depositListeners) {
        listener();
      }
    });
    await flush();
    expect(claimFondDeposits).toHaveBeenCalledTimes(2);
  });

  it('cancels a running pass on sign-out and starts no other', async () => {
    let finish: (value: number) => void = () => undefined;
    vi.mocked(claimFondDeposits).mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    setState('fond', 'sess', 'ready');
    render(<FondDepositSync />);
    await flush();
    const running = vi.mocked(claimFondDeposits).mock.calls[0]?.[0];
    expect(running?.isCancelled()).toBe(false);
    setState(null, null, 'locked');
    await flush();
    expect(running?.isCancelled()).toBe(true);
    finish(0);
    await flush();
    expect(claimFondDeposits).toHaveBeenCalledTimes(1);
  });

  it('runs no pass for a deposit report that arrives after cleanup began', async () => {
    setState('fond', 'sess', 'ready');
    render(<FondDepositSync />);
    await flush();
    const listener = [...depositListeners][0];
    setState(null, null, 'locked');
    await flush();
    listener?.();
    await flush();
    expect(claimFondDeposits).toHaveBeenCalledTimes(1);
  });

  it('drops a registration answer that arrives after the session changed', async () => {
    let finishFirst: (value: 'registered') => void = () => undefined;
    vi.mocked(registerFondDepositAddress)
      .mockReturnValueOnce(
        new Promise((resolve) => {
          finishFirst = resolve;
        }),
      )
      .mockResolvedValueOnce('registered');
    setState('fond', 'sess', 'ready');
    render(<FondDepositSync />);
    await flush();
    setState('fond', 'sess-2', 'ready');
    await flush();
    expect(claimFondDeposits).toHaveBeenCalledTimes(1);
    finishFirst('registered');
    await flush();
    setState('fond', 'sess-2', 'locked');
    setState('fond', 'sess-2', 'ready');
    await flush();
    expect(registerFondDepositAddress).toHaveBeenCalledTimes(2);
    expect(claimFondDeposits).toHaveBeenCalledTimes(2);
  });

  it('stops listening for deposit reports on sign-out', async () => {
    setState('fond', 'sess', 'ready');
    render(<FondDepositSync />);
    await flush();
    expect(depositListeners.size).toBe(1);
    setState(null, null, 'locked');
    await flush();
    expect(depositListeners.size).toBe(0);
  });

  it('uses the Playwright fake wallet without a ready wallet', async () => {
    const fake = {
      payFromWallet: vi.fn(),
      listWalletPayments: vi.fn(),
      receiveBitcoinAddress: vi.fn(),
      listUnclaimedDeposits: vi.fn(),
      claimDeposit: vi.fn(),
    };
    vi.mocked(fondE2eWallet).mockReturnValue(fake);
    setState('fond', 'sess', 'locked');
    render(<FondDepositSync />);
    await flush();
    expect(vi.mocked(registerFondDepositAddress).mock.calls[0]?.[0].receiveBitcoinAddress).toBe(
      fake.receiveBitcoinAddress,
    );
    expect(vi.mocked(claimFondDeposits).mock.calls[0]?.[0]).toMatchObject({
      listUnclaimedDeposits: fake.listUnclaimedDeposits,
      claimDeposit: fake.claimDeposit,
    });
  });
});
