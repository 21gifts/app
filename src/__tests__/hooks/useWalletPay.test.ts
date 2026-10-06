import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WALLET_PAY_CONFIRM_WAIT_MS, useWalletPay } from '@/hooks/useWalletPay';
import { unlockWalletPhrase } from '@/lib/wallet/wallet-phrase';
import { walletNeedsReload } from '@/lib/wallet/wallet-sdk';
import {
  connectWallet,
  payFromWallet,
  type WalletPayResult,
  type WalletSendResult,
} from '@/lib/wallet/wallet-service';
import { useAuthStore } from '@/stores/auth-store';
import { useWalletStore, type WalletStatus } from '@/stores/wallet-store';

vi.mock('@/lib/wallet/wallet-phrase', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/wallet/wallet-phrase')>();
  return { ...actual, unlockWalletPhrase: vi.fn() };
});

vi.mock('@/lib/wallet/wallet-service', () => ({
  connectWallet: vi.fn(),
  payFromWallet: vi.fn(),
}));

vi.mock('@/lib/wallet/wallet-sdk', () => ({ walletNeedsReload: vi.fn(() => false) }));

const account = {
  id: 'acc_1',
  linkingKey: null,
  role: 'basis' as const,
  name: 'Ada',
  username: 'ada',
  location: null,
  lightningAddress: null,
  lightningAddressVerified: false,
  forumLawsDismissed: false,
  createdAt: 1,
  rulesAgreedAt: 1,
  viewKey: 'a'.repeat(64),
  aboutMe: null,
  aboutMeHasPhoto: false,
  setup: null,
  missing: [],
  walletRequired: true,
  passkeyCredentialId: 'credential',
};

const SPARK = 'spark1invoice';
const PR = 'lnbc210n1invoice';
const ORIGINAL_E2E_NOW = process.env.NEXT_PUBLIC_E2E_NOW;
const ORIGINAL_BREEZ_KEY = process.env.NEXT_PUBLIC_BREEZ_API_KEY;

function setWallet(status: WalletStatus, balanceSats: number | null = null): void {
  useWalletStore.setState({ status, balanceSats, identityPubkey: null });
}

function confirmWith(send: () => Promise<WalletSendResult>, feeSats = 0): WalletPayResult {
  return { kind: 'confirm', amountSats: 21, feeSats, send };
}

beforeEach(() => {
  window.history.replaceState({}, '', '/welcome');
  delete process.env.NEXT_PUBLIC_E2E_NOW;
  useAuthStore.setState({ session: 'token', account });
  setWallet('ready');
  vi.mocked(payFromWallet).mockReset();
  vi.mocked(unlockWalletPhrase).mockReset().mockResolvedValue('unlocked');
  vi.mocked(connectWallet).mockReset().mockResolvedValue(undefined);
  vi.mocked(walletNeedsReload).mockReset().mockReturnValue(false);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  if (ORIGINAL_E2E_NOW === undefined) {
    delete process.env.NEXT_PUBLIC_E2E_NOW;
  } else {
    process.env.NEXT_PUBLIC_E2E_NOW = ORIGINAL_E2E_NOW;
  }
  if (ORIGINAL_BREEZ_KEY === undefined) {
    delete process.env.NEXT_PUBLIC_BREEZ_API_KEY;
  } else {
    process.env.NEXT_PUBLIC_BREEZ_API_KEY = ORIGINAL_BREEZ_KEY;
  }
});

describe('useWalletPay path choice', () => {
  it('pays the payment request when there is no sparkInvoice', async () => {
    vi.mocked(payFromWallet).mockResolvedValue(confirmWith(async () => ({ kind: 'paid' })));
    for (const value of [null, undefined, '']) {
      const { result, unmount } = renderHook(() => useWalletPay(value, PR, 21));
      await act(async () => undefined);
      expect(result.current.view).toBe('confirm');
      unmount();
    }
    expect(payFromWallet).toHaveBeenCalledTimes(3);
    for (const call of vi.mocked(payFromWallet).mock.calls) {
      expect(call[0]).toEqual({ type: 'input', input: PR });
    }
  });

  it('pays the sparkInvoice when the api issued one', async () => {
    vi.mocked(payFromWallet).mockResolvedValue(confirmWith(async () => ({ kind: 'paid' })));
    renderHook(() => useWalletPay(SPARK, PR, 21));
    await act(async () => undefined);
    expect(payFromWallet).toHaveBeenCalledWith({ type: 'input', input: SPARK });
  });

  it('is unavailable when the wallet is not configured', () => {
    setWallet('disabled');
    const { result } = renderHook(() => useWalletPay(SPARK, PR, 21));
    expect(result.current.view).toBe('unavailable');
    expect(payFromWallet).not.toHaveBeenCalled();
  });

  it('is unavailable while the account is in the one-time wallet setup', () => {
    process.env.NEXT_PUBLIC_BREEZ_API_KEY = 'breez-key';
    useAuthStore.setState({ account: { ...account, sparkWalletVerified: false } });
    const { result } = renderHook(() => useWalletPay(SPARK, PR, 21));
    expect(result.current.view).toBe('unavailable');
    expect(payFromWallet).not.toHaveBeenCalled();
  });

  it('prepares once the account finishes the one-time wallet setup', async () => {
    process.env.NEXT_PUBLIC_BREEZ_API_KEY = 'breez-key';
    vi.mocked(payFromWallet).mockResolvedValue(confirmWith(async () => ({ kind: 'paid' })));
    useAuthStore.setState({ account: { ...account, sparkWalletVerified: false } });
    const { result } = renderHook(() => useWalletPay(SPARK, PR, 21));
    expect(result.current.view).toBe('unavailable');
    await act(async () => {
      useAuthStore.setState({ account: { ...account, sparkWalletVerified: true } });
    });
    expect(payFromWallet).toHaveBeenCalledTimes(1);
    expect(result.current.view).toBe('confirm');
  });

  it('falls unavailable when the account cannot unlock a wallet', () => {
    useAuthStore.setState({ account: { ...account, passkeyCredentialId: null } });
    const { result } = renderHook(() => useWalletPay(SPARK, PR, 21));
    expect(result.current.view).toBe('unavailable');
    expect(payFromWallet).not.toHaveBeenCalled();
  });

  it('shows failed while the wallet store is in error', () => {
    setWallet('error');
    const { result } = renderHook(() => useWalletPay(SPARK, PR, 21));
    expect(result.current.view).toBe('failed');
    expect(payFromWallet).not.toHaveBeenCalled();
  });

  it('drops an open confirm or prepare when the account leaves wallet mode', async () => {
    const oldSend = vi.fn(async (): Promise<WalletSendResult> => ({ kind: 'paid' }));
    vi.mocked(payFromWallet).mockResolvedValueOnce(confirmWith(oldSend));
    let payDuringRender = false;
    const { result, unmount } = renderHook(() => {
      const slot = useWalletPay(SPARK, PR, 21);
      if (payDuringRender) {
        slot.pay();
      }
      return slot;
    });
    await act(async () => undefined);
    expect(result.current.view).toBe('confirm');
    payDuringRender = true;
    await act(async () => {
      useAuthStore.setState({ account: { ...account, passkeyCredentialId: null } });
    });
    payDuringRender = false;
    expect(oldSend).not.toHaveBeenCalled();
    expect(result.current.view).toBe('unavailable');
    unmount();

    useAuthStore.setState({ account });
    let finish: (value: WalletPayResult) => void = () => undefined;
    vi.mocked(payFromWallet).mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const second = renderHook(() => useWalletPay(SPARK, PR, 21));
    await act(async () => undefined);
    expect(second.result.current.view).toBe('preparing');
    await act(async () => {
      useAuthStore.setState({ account: { ...account, walletRequired: false } });
    });
    expect(second.result.current.view).toBe('unavailable');
    await act(async () => {
      finish(confirmWith(oldSend));
    });
    expect(second.result.current.view).toBe('unavailable');
  });

  it('offers unlock for a locked wallet and prepares once it is ready', async () => {
    setWallet('locked');
    vi.mocked(payFromWallet).mockResolvedValue(confirmWith(async () => ({ kind: 'paid' }), 3));
    const { result } = renderHook(() => useWalletPay(SPARK, PR, 21));
    expect(result.current.view).toBe('unlock');
    expect(payFromWallet).not.toHaveBeenCalled();
    await act(async () => {
      result.current.unlock();
    });
    expect(unlockWalletPhrase).toHaveBeenCalledTimes(1);
    expect(result.current.view).toBe('unlock');
    act(() => {
      setWallet('connecting');
    });
    expect(result.current.view).toBe('preparing');
    await act(async () => {
      setWallet('ready');
    });
    expect(payFromWallet).toHaveBeenCalledWith({ type: 'input', input: SPARK });
    expect(result.current.view).toBe('confirm');
    expect(result.current.feeSats).toBe(3);
  });

  it('shows preparing while the passkey prompt is open and ignores a second unlock', async () => {
    setWallet('locked');
    let finish: (value: 'cancelled') => void = () => undefined;
    vi.mocked(unlockWalletPhrase).mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const { result } = renderHook(() => useWalletPay(SPARK, PR, 21));
    act(() => {
      result.current.unlock();
    });
    expect(result.current.view).toBe('preparing');
    act(() => {
      result.current.unlock();
    });
    expect(unlockWalletPhrase).toHaveBeenCalledTimes(1);
    await act(async () => {
      finish('cancelled');
    });
    expect(result.current.view).toBe('unlock');
  });

  it('fails after a failed unlock', async () => {
    setWallet('locked');
    vi.mocked(unlockWalletPhrase).mockResolvedValue('failed');
    const { result } = renderHook(() => useWalletPay(SPARK, PR, 21));
    await act(async () => {
      result.current.unlock();
    });
    expect(result.current.view).toBe('failed');
  });

  it('fails when prepare fails, and shows insufficient balance', async () => {
    vi.mocked(payFromWallet).mockResolvedValueOnce({ kind: 'failed' });
    const failed = renderHook(() => useWalletPay(SPARK, PR, 21));
    await act(async () => undefined);
    expect(failed.result.current.view).toBe('failed');
    failed.unmount();
    vi.mocked(payFromWallet).mockResolvedValueOnce({ kind: 'unlock' });
    const unlock = renderHook(() => useWalletPay(SPARK, PR, 21));
    await act(async () => undefined);
    expect(unlock.result.current.view).toBe('failed');
    unlock.unmount();
    vi.mocked(payFromWallet).mockResolvedValueOnce({ kind: 'insufficient' });
    const low = renderHook(() => useWalletPay(SPARK, PR, 21));
    await act(async () => undefined);
    expect(low.result.current.view).toBe('insufficient');
  });

  it('ignores a prepare result that arrives after the invoice changed', async () => {
    let finish: (value: WalletPayResult) => void = () => undefined;
    vi.mocked(payFromWallet).mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    vi.mocked(payFromWallet).mockResolvedValueOnce({ kind: 'insufficient' });
    const { result, rerender } = renderHook(({ value }) => useWalletPay(value, PR, 21), {
      initialProps: { value: SPARK },
    });
    await act(async () => {
      rerender({ value: 'spark1other' });
    });
    expect(result.current.view).toBe('insufficient');
    await act(async () => {
      finish(confirmWith(async () => ({ kind: 'paid' })));
    });
    expect(result.current.view).toBe('insufficient');
  });

  it('ignores an unlock result after unmount', async () => {
    setWallet('locked');
    let finish: (value: 'unlocked') => void = () => undefined;
    vi.mocked(unlockWalletPhrase).mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const { result, unmount } = renderHook(() => useWalletPay(SPARK, PR, 21));
    act(() => {
      result.current.unlock();
    });
    unmount();
    await act(async () => {
      finish('unlocked');
    });
    expect(payFromWallet).not.toHaveBeenCalled();
  });
});

describe('useWalletPay one tap unlock and pay', () => {
  function lockedWith(send: () => Promise<WalletSendResult>, feeSats = 0): void {
    setWallet('locked');
    vi.mocked(payFromWallet).mockResolvedValue(confirmWith(send, feeSats));
  }

  async function unlockToReady(result: { current: { unlock: () => void } }): Promise<void> {
    await act(async () => {
      result.current.unlock();
    });
    await act(async () => {
      setWallet('ready', 5_000);
    });
  }

  it('pays once at once when the fee is ₿0, without a confirm step', async () => {
    const send = vi.fn(async (): Promise<WalletSendResult> => ({ kind: 'paid' }));
    lockedWith(send);
    const { result } = renderHook(() => useWalletPay(SPARK, PR, 21));
    expect(result.current.view).toBe('unlock');
    await unlockToReady(result);
    expect(unlockWalletPhrase).toHaveBeenCalledTimes(1);
    expect(payFromWallet).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledTimes(1);
    expect(result.current.view).toBe('paying');
    expect(result.current.feeSats).toBe(0);
    act(() => {
      result.current.pay();
    });
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('turns neutral 60 s after an automatic send, like Pay from wallet', async () => {
    vi.useFakeTimers();
    const send = vi.fn(async (): Promise<WalletSendResult> => ({ kind: 'paid' }));
    lockedWith(send);
    const { result } = renderHook(() => useWalletPay(SPARK, PR, 21));
    await unlockToReady(result);
    expect(result.current.view).toBe('paying');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(WALLET_PAY_CONFIRM_WAIT_MS);
    });
    expect(result.current.view).toBe('unconfirmed');
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('stops at confirm with the fee when the fee is above ₿0', async () => {
    const send = vi.fn(async (): Promise<WalletSendResult> => ({ kind: 'paid' }));
    lockedWith(send, 3);
    const { result } = renderHook(() => useWalletPay(SPARK, PR, 21));
    await unlockToReady(result);
    expect(result.current.view).toBe('confirm');
    expect(result.current.feeSats).toBe(3);
    expect(send).not.toHaveBeenCalled();
    await act(async () => {
      result.current.pay();
    });
    expect(send).toHaveBeenCalledTimes(1);
    expect(result.current.view).toBe('paying');
  });

  it('shows insufficient balance after the unlock and pays nothing', async () => {
    setWallet('locked');
    vi.mocked(payFromWallet).mockResolvedValue({ kind: 'insufficient' });
    const { result } = renderHook(() => useWalletPay(SPARK, PR, 21));
    await unlockToReady(result);
    expect(result.current.view).toBe('insufficient');
  });

  it('shows insufficient balance when the automatic send says so', async () => {
    lockedWith(async () => ({ kind: 'insufficient' }));
    const { result } = renderHook(() => useWalletPay(SPARK, PR, 21));
    await unlockToReady(result);
    expect(result.current.view).toBe('insufficient');
  });

  it('does not pay on its own when the balance rises after insufficient', async () => {
    const send = vi.fn(async (): Promise<WalletSendResult> => ({ kind: 'paid' }));
    setWallet('locked');
    vi.mocked(payFromWallet)
      .mockResolvedValueOnce({ kind: 'insufficient' })
      .mockResolvedValueOnce(confirmWith(send));
    const { result } = renderHook(() => useWalletPay(SPARK, PR, 21));
    await unlockToReady(result);
    expect(result.current.view).toBe('insufficient');
    await act(async () => {
      setWallet('ready', 50_000);
    });
    expect(payFromWallet).toHaveBeenCalledTimes(2);
    expect(result.current.view).toBe('confirm');
    expect(send).not.toHaveBeenCalled();
  });

  it('fails when prepare fails after the unlock, and Try again stops at confirm', async () => {
    const send = vi.fn(async (): Promise<WalletSendResult> => ({ kind: 'paid' }));
    setWallet('locked');
    vi.mocked(payFromWallet)
      .mockResolvedValueOnce({ kind: 'failed' })
      .mockResolvedValueOnce(confirmWith(send));
    const { result } = renderHook(() => useWalletPay(SPARK, PR, 21));
    await unlockToReady(result);
    expect(result.current.view).toBe('failed');
    await act(async () => {
      result.current.retry();
    });
    expect(result.current.view).toBe('confirm');
    expect(send).not.toHaveBeenCalled();
  });

  it('returns to the one button after a cancelled prompt and never pays on its own', async () => {
    const send = vi.fn(async (): Promise<WalletSendResult> => ({ kind: 'paid' }));
    lockedWith(send);
    vi.mocked(unlockWalletPhrase).mockResolvedValue('cancelled');
    const { result } = renderHook(() => useWalletPay(SPARK, PR, 21));
    await act(async () => {
      result.current.unlock();
    });
    expect(result.current.view).toBe('unlock');
    expect(payFromWallet).not.toHaveBeenCalled();
    await act(async () => {
      setWallet('ready', 5_000);
    });
    expect(result.current.view).toBe('confirm');
    expect(send).not.toHaveBeenCalled();
  });

  it('never pays on its own after a failed prompt', async () => {
    const send = vi.fn(async (): Promise<WalletSendResult> => ({ kind: 'paid' }));
    lockedWith(send);
    vi.mocked(unlockWalletPhrase).mockResolvedValue('failed');
    const { result } = renderHook(() => useWalletPay(SPARK, PR, 21));
    await act(async () => {
      result.current.unlock();
    });
    expect(result.current.view).toBe('failed');
    await act(async () => {
      result.current.retry();
    });
    await act(async () => {
      setWallet('ready', 5_000);
    });
    expect(result.current.view).toBe('confirm');
    expect(send).not.toHaveBeenCalled();
  });

  it('says the passkey cannot hold the wallet when the prompt gives no PRF output', async () => {
    const send = vi.fn(async (): Promise<WalletSendResult> => ({ kind: 'paid' }));
    lockedWith(send);
    vi.mocked(unlockWalletPhrase).mockResolvedValue('noPrf');
    const { result } = renderHook(() => useWalletPay(SPARK, PR, 21));
    await act(async () => {
      result.current.unlock();
    });
    expect(result.current.view).toBe('prfUnsupported');
    await act(async () => {
      result.current.retry();
    });
    expect(result.current.view).toBe('unlock');
    expect(send).not.toHaveBeenCalled();
  });

  it('ignores the prf-unsupported pin outside a Playwright build', () => {
    window.history.replaceState({}, '', '/welcome?visual=wallet-pay-prf-unsupported');
    setWallet('disabled');
    expect(renderHook(() => useWalletPay(SPARK, PR, 21)).result.current.view).toBe('unavailable');
  });

  it('never pays on its own when the wallet fails after the unlock and opens later', async () => {
    const send = vi.fn(async (): Promise<WalletSendResult> => ({ kind: 'paid' }));
    lockedWith(send);
    const { result } = renderHook(() => useWalletPay(SPARK, PR, 21));
    await act(async () => {
      result.current.unlock();
    });
    act(() => {
      setWallet('error');
    });
    expect(result.current.view).toBe('failed');
    await act(async () => {
      setWallet('ready', 5_000);
    });
    expect(result.current.view).toBe('confirm');
    expect(send).not.toHaveBeenCalled();
  });

  it('never pays on its own when the account leaves wallet mode after the unlock', async () => {
    const send = vi.fn(async (): Promise<WalletSendResult> => ({ kind: 'paid' }));
    lockedWith(send);
    const { result } = renderHook(() => useWalletPay(SPARK, PR, 21));
    await act(async () => {
      result.current.unlock();
    });
    act(() => {
      useAuthStore.setState({ account: { ...account, passkeyCredentialId: null } });
    });
    expect(result.current.view).toBe('unavailable');
    await act(async () => {
      useAuthStore.setState({ account });
      setWallet('ready', 5_000);
    });
    expect(result.current.view).toBe('confirm');
    expect(send).not.toHaveBeenCalled();
  });

  it('pays nothing when the slot closes while the prompt is open', async () => {
    const send = vi.fn(async (): Promise<WalletSendResult> => ({ kind: 'paid' }));
    lockedWith(send);
    let finish: (value: 'unlocked') => void = () => undefined;
    vi.mocked(unlockWalletPhrase).mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const { result, unmount } = renderHook(() => useWalletPay(SPARK, PR, 21));
    act(() => {
      result.current.unlock();
    });
    unmount();
    await act(async () => {
      finish('unlocked');
      setWallet('ready', 5_000);
    });
    expect(payFromWallet).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });

  it('pays nothing when the slot closes while the payment is prepared', async () => {
    const send = vi.fn(async (): Promise<WalletSendResult> => ({ kind: 'paid' }));
    setWallet('locked');
    let finish: (value: WalletPayResult) => void = () => undefined;
    vi.mocked(payFromWallet).mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const { result, unmount } = renderHook(() => useWalletPay(SPARK, PR, 21));
    await unlockToReady(result);
    expect(result.current.view).toBe('preparing');
    unmount();
    await act(async () => {
      finish(confirmWith(send));
    });
    expect(send).not.toHaveBeenCalled();
  });

  it('stops at confirm when the invoice changes while the prompt is open', async () => {
    const send = vi.fn(async (): Promise<WalletSendResult> => ({ kind: 'paid' }));
    lockedWith(send);
    let finish: (value: 'unlocked') => void = () => undefined;
    vi.mocked(unlockWalletPhrase).mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const { result, rerender } = renderHook(({ value }) => useWalletPay(value, PR, 21), {
      initialProps: { value: SPARK },
    });
    act(() => {
      result.current.unlock();
    });
    rerender({ value: 'spark1other' });
    await act(async () => {
      finish('unlocked');
      setWallet('ready', 5_000);
    });
    expect(payFromWallet).toHaveBeenCalledWith({ type: 'input', input: 'spark1other' });
    expect(result.current.view).toBe('confirm');
    expect(send).not.toHaveBeenCalled();
  });

  it('stops at confirm when the amount changes while the payment is prepared', async () => {
    const oldSend = vi.fn(async (): Promise<WalletSendResult> => ({ kind: 'paid' }));
    const newSend = vi.fn(async (): Promise<WalletSendResult> => ({ kind: 'paid' }));
    setWallet('locked');
    let finish: (value: WalletPayResult) => void = () => undefined;
    vi.mocked(payFromWallet)
      .mockReturnValueOnce(
        new Promise((resolve) => {
          finish = resolve;
        }),
      )
      .mockResolvedValueOnce({ kind: 'confirm', amountSats: 42, feeSats: 0, send: newSend });
    const { result, rerender } = renderHook(({ amount }) => useWalletPay(SPARK, PR, amount), {
      initialProps: { amount: 21 },
    });
    await unlockToReady(result);
    await act(async () => {
      rerender({ amount: 42 });
    });
    await act(async () => {
      finish(confirmWith(oldSend));
    });
    expect(result.current.view).toBe('confirm');
    expect(oldSend).not.toHaveBeenCalled();
    expect(newSend).not.toHaveBeenCalled();
  });

  it('stops at confirm when the wallet leaves ready during the first prepare', async () => {
    const send = vi.fn(async (): Promise<WalletSendResult> => ({ kind: 'paid' }));
    setWallet('locked');
    let finish: (value: WalletPayResult) => void = () => undefined;
    vi.mocked(payFromWallet)
      .mockReturnValueOnce(
        new Promise((resolve) => {
          finish = resolve;
        }),
      )
      .mockResolvedValueOnce(confirmWith(send));
    const { result } = renderHook(() => useWalletPay(SPARK, PR, 21));
    await unlockToReady(result);
    act(() => {
      setWallet('connecting');
    });
    await act(async () => {
      finish(confirmWith(send));
    });
    await act(async () => {
      setWallet('ready', 5_000);
    });
    expect(result.current.view).toBe('confirm');
    expect(send).not.toHaveBeenCalled();
  });

  it('leaves an already open wallet unchanged: fee ₿0 still waits for Pay from wallet', async () => {
    const send = vi.fn(async (): Promise<WalletSendResult> => ({ kind: 'paid' }));
    vi.mocked(payFromWallet).mockResolvedValue(confirmWith(send));
    const { result } = renderHook(() => useWalletPay(SPARK, PR, 21));
    await act(async () => undefined);
    expect(result.current.view).toBe('confirm');
    expect(result.current.feeSats).toBe(0);
    expect(send).not.toHaveBeenCalled();
    act(() => {
      result.current.unlock();
    });
    expect(unlockWalletPhrase).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });
});

describe('useWalletPay guards', () => {
  it('fails when the prepared amount differs from the amount on the sheet', async () => {
    vi.mocked(payFromWallet).mockResolvedValue({
      kind: 'confirm',
      amountSats: 22,
      feeSats: 0,
      send: async () => ({ kind: 'paid' }),
    });
    const { result } = renderHook(() => useWalletPay(SPARK, PR, 21));
    await act(async () => undefined);
    expect(result.current.view).toBe('failed');
  });

  it('never pays or shows a confirm prepared for another invoice or amount, even before the reset runs', async () => {
    const oldSend = vi.fn(async (): Promise<WalletSendResult> => ({ kind: 'paid' }));
    vi.mocked(payFromWallet).mockImplementation(async () => confirmWith(oldSend));
    for (const next of [
      { input: SPARK, sats: 42 },
      { input: 'spark1other', sats: 21 },
    ]) {
      const seen: string[] = [];
      const { result, rerender } = renderHook(
        ({ input, sats }) => {
          const slot = useWalletPay(input, PR, sats);
          if (input !== SPARK || sats !== 21) {
            seen.push(slot.view);
            slot.pay();
          }
          return slot;
        },
        { initialProps: { input: SPARK, sats: 21 } },
      );
      await act(async () => undefined);
      expect(result.current.view).toBe('confirm');
      rerender(next);
      expect(seen[0]).toBe('preparing');
      expect(oldSend).not.toHaveBeenCalled();
    }
  });

  it('starts over when the sheet amount changes for the same invoice', async () => {
    const oldSend = vi.fn(async (): Promise<WalletSendResult> => ({ kind: 'paid' }));
    vi.mocked(payFromWallet)
      .mockResolvedValueOnce(confirmWith(oldSend))
      .mockResolvedValueOnce({
        kind: 'confirm',
        amountSats: 42,
        feeSats: 0,
        send: async () => ({ kind: 'paid' }),
      });
    const { result, rerender } = renderHook(({ sats }) => useWalletPay(SPARK, PR, sats), {
      initialProps: { sats: 21 },
    });
    await act(async () => undefined);
    expect(result.current.view).toBe('confirm');
    rerender({ sats: 42 });
    await act(async () => {
      result.current.pay();
    });
    expect(oldSend).not.toHaveBeenCalled();
    expect(payFromWallet).toHaveBeenCalledTimes(2);
    expect(result.current.view).toBe('confirm');
  });

  it('drops a confirm step when the wallet leaves ready, and prepares again once ready', async () => {
    vi.mocked(payFromWallet).mockResolvedValue(confirmWith(async () => ({ kind: 'paid' })));
    const { result } = renderHook(() => useWalletPay(SPARK, PR, 21));
    await act(async () => undefined);
    expect(result.current.view).toBe('confirm');
    act(() => {
      setWallet('connecting');
    });
    expect(result.current.view).toBe('preparing');
    expect(result.current.feeSats).toBeNull();
    act(() => {
      result.current.pay();
    });
    await act(async () => {
      setWallet('ready');
    });
    expect(result.current.view).toBe('confirm');
    expect(payFromWallet).toHaveBeenCalledTimes(2);
    act(() => {
      setWallet('error');
    });
    expect(result.current.view).toBe('failed');
  });

  it('drops a prepare result when the wallet leaves ready meanwhile', async () => {
    let finish: (value: WalletPayResult) => void = () => undefined;
    vi.mocked(payFromWallet).mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const { result } = renderHook(() => useWalletPay(SPARK, PR, 21));
    expect(result.current.view).toBe('preparing');
    act(() => {
      setWallet('error');
    });
    await act(async () => {
      finish(confirmWith(async () => ({ kind: 'paid' })));
    });
    expect(result.current.view).toBe('failed');
  });

  it('keeps the paying view when the wallet leaves ready after the send started', async () => {
    vi.mocked(payFromWallet).mockResolvedValue(
      confirmWith(() => new Promise<WalletSendResult>(() => undefined)),
    );
    const { result } = renderHook(() => useWalletPay(SPARK, PR, 21));
    await act(async () => undefined);
    act(() => {
      result.current.pay();
    });
    act(() => {
      setWallet('error');
    });
    expect(result.current.view).toBe('paying');
  });
});

describe('useWalletPay balance after insufficient', () => {
  it('prepares again once the balance rises, and not while it stays the same', async () => {
    setWallet('ready', 10);
    vi.mocked(payFromWallet)
      .mockResolvedValueOnce({ kind: 'insufficient' })
      .mockResolvedValueOnce(confirmWith(async () => ({ kind: 'paid' })));
    const { result } = renderHook(() => useWalletPay(SPARK, PR, 21));
    await act(async () => undefined);
    expect(result.current.view).toBe('insufficient');
    await act(async () => {
      setWallet('ready', 10);
    });
    expect(result.current.view).toBe('insufficient');
    expect(payFromWallet).toHaveBeenCalledTimes(1);
    await act(async () => {
      setWallet('ready', 5_000);
    });
    expect(result.current.view).toBe('confirm');
    expect(payFromWallet).toHaveBeenCalledTimes(2);
  });

  it('starts over when the wallet leaves ready while insufficient shows', async () => {
    setWallet('ready', 10);
    vi.mocked(payFromWallet)
      .mockResolvedValueOnce({ kind: 'insufficient' })
      .mockResolvedValueOnce(confirmWith(async () => ({ kind: 'paid' })));
    const { result } = renderHook(() => useWalletPay(SPARK, PR, 21));
    await act(async () => undefined);
    expect(result.current.view).toBe('insufficient');
    await act(async () => {
      setWallet('error', null);
    });
    expect(result.current.view).toBe('failed');
    await act(async () => {
      setWallet('ready', 10);
    });
    expect(result.current.view).toBe('confirm');
    expect(payFromWallet).toHaveBeenCalledTimes(2);
  });

  it('prepares again when the balance rose while the prepare was in flight', async () => {
    setWallet('ready', 10);
    let finish: (value: WalletPayResult) => void = () => undefined;
    vi.mocked(payFromWallet)
      .mockReturnValueOnce(
        new Promise((resolve) => {
          finish = resolve;
        }),
      )
      .mockResolvedValueOnce(confirmWith(async () => ({ kind: 'paid' })));
    const { result } = renderHook(() => useWalletPay(SPARK, PR, 21));
    await act(async () => undefined);
    expect(result.current.view).toBe('preparing');
    await act(async () => {
      setWallet('ready', 5_000);
      finish({ kind: 'insufficient' });
    });
    expect(payFromWallet).toHaveBeenCalledTimes(2);
    expect(result.current.view).toBe('confirm');
  });

  it('measures a rise from the lowest balance seen after insufficient', async () => {
    setWallet('ready', 1_000);
    vi.mocked(payFromWallet)
      .mockResolvedValueOnce(confirmWith(async () => ({ kind: 'insufficient' })))
      .mockResolvedValueOnce(confirmWith(async () => ({ kind: 'paid' })));
    const { result } = renderHook(() => useWalletPay(SPARK, PR, 21));
    await act(async () => undefined);
    await act(async () => {
      result.current.pay();
    });
    expect(result.current.view).toBe('insufficient');
    await act(async () => {
      setWallet('ready', 10);
    });
    expect(result.current.view).toBe('insufficient');
    await act(async () => {
      setWallet('ready', 500);
    });
    expect(result.current.view).toBe('confirm');
    expect(payFromWallet).toHaveBeenCalledTimes(2);
  });

  it('prepares again after an insufficient send once the balance rises', async () => {
    setWallet('ready', 10);
    vi.mocked(payFromWallet)
      .mockResolvedValueOnce(confirmWith(async () => ({ kind: 'insufficient' })))
      .mockResolvedValueOnce(confirmWith(async () => ({ kind: 'paid' })));
    const { result } = renderHook(() => useWalletPay(SPARK, PR, 21));
    await act(async () => undefined);
    await act(async () => {
      result.current.pay();
    });
    expect(result.current.view).toBe('insufficient');
    await act(async () => {
      setWallet('ready', 5_000);
    });
    expect(result.current.view).toBe('confirm');
  });

  it('prepares again when the balance becomes known after an insufficient result', async () => {
    setWallet('ready', null);
    vi.mocked(payFromWallet)
      .mockResolvedValueOnce({ kind: 'insufficient' })
      .mockResolvedValueOnce(confirmWith(async () => ({ kind: 'paid' })));
    const { result } = renderHook(() => useWalletPay(SPARK, PR, 21));
    await act(async () => undefined);
    expect(result.current.view).toBe('insufficient');
    await act(async () => {
      setWallet('ready', 0);
    });
    expect(payFromWallet).toHaveBeenCalledTimes(2);
  });
});

describe('useWalletPay sending', () => {
  it('pays once, keeps the paying view while the long-poll waits, then turns neutral after 60 s', async () => {
    vi.useFakeTimers();
    const send = vi.fn(async (): Promise<WalletSendResult> => ({ kind: 'paid' }));
    vi.mocked(payFromWallet).mockResolvedValue(confirmWith(send));
    const { result } = renderHook(() => useWalletPay(SPARK, PR, 21));
    await act(async () => undefined);
    expect(result.current.view).toBe('confirm');
    await act(async () => {
      result.current.pay();
    });
    expect(result.current.view).toBe('paying');
    await act(async () => {
      result.current.pay();
      await vi.advanceTimersByTimeAsync(WALLET_PAY_CONFIRM_WAIT_MS - 1);
    });
    expect(result.current.view).toBe('paying');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(result.current.view).toBe('unconfirmed');
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('after a failed send waits 60 s on the long-poll, then says not confirmed yet, without retrying', async () => {
    vi.useFakeTimers();
    const send = vi.fn(async (): Promise<WalletSendResult> => ({ kind: 'failed' }));
    vi.mocked(payFromWallet).mockResolvedValue(confirmWith(send));
    const { result } = renderHook(() => useWalletPay(SPARK, PR, 21));
    await act(async () => undefined);
    await act(async () => {
      result.current.pay();
    });
    expect(result.current.view).toBe('paying');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(WALLET_PAY_CONFIRM_WAIT_MS - 1);
    });
    expect(result.current.view).toBe('paying');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(result.current.view).toBe('unconfirmed');
    expect(send).toHaveBeenCalledTimes(1);
    expect(payFromWallet).toHaveBeenCalledTimes(1);
  });

  it('shows insufficient balance when the send says so', async () => {
    vi.mocked(payFromWallet).mockResolvedValue(confirmWith(async () => ({ kind: 'insufficient' })));
    const { result } = renderHook(() => useWalletPay(SPARK, PR, 21));
    await act(async () => undefined);
    await act(async () => {
      result.current.pay();
    });
    expect(result.current.view).toBe('insufficient');
  });

  it('drops the wait when the sheet closes before the timer fires', async () => {
    vi.useFakeTimers();
    vi.mocked(payFromWallet).mockResolvedValue(confirmWith(async () => ({ kind: 'failed' })));
    const { result, unmount } = renderHook(() => useWalletPay(SPARK, PR, 21));
    await act(async () => undefined);
    await act(async () => {
      result.current.pay();
    });
    unmount();
    await vi.advanceTimersByTimeAsync(WALLET_PAY_CONFIRM_WAIT_MS);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('ignores a send result for an older invoice', async () => {
    let finish: (value: WalletSendResult) => void = () => undefined;
    vi.mocked(payFromWallet).mockResolvedValueOnce(
      confirmWith(
        () =>
          new Promise((resolve) => {
            finish = resolve;
          }),
      ),
    );
    vi.mocked(payFromWallet).mockResolvedValueOnce({ kind: 'failed' });
    const { result, rerender } = renderHook(({ value }) => useWalletPay(value, PR, 21), {
      initialProps: { value: SPARK },
    });
    await act(async () => undefined);
    act(() => {
      result.current.pay();
    });
    await act(async () => {
      rerender({ value: 'spark1other' });
    });
    await act(async () => {
      finish({ kind: 'insufficient' });
    });
    expect(result.current.view).toBe('failed');
  });

  it('ignores the 60 s timer of an older invoice', async () => {
    vi.useFakeTimers();
    vi.mocked(payFromWallet).mockResolvedValueOnce(confirmWith(async () => ({ kind: 'failed' })));
    vi.mocked(payFromWallet).mockResolvedValueOnce({ kind: 'insufficient' });
    const { result, rerender } = renderHook(({ value }) => useWalletPay(value, PR, 21), {
      initialProps: { value: SPARK },
    });
    await act(async () => undefined);
    await act(async () => {
      result.current.pay();
    });
    await act(async () => {
      rerender({ value: 'spark1other' });
      await vi.advanceTimersByTimeAsync(WALLET_PAY_CONFIRM_WAIT_MS);
    });
    expect(result.current.view).toBe('insufficient');
  });
});

describe('useWalletPay visual pins', () => {
  const pins = [
    ['wallet-pay-unavailable', 'unavailable'],
    ['wallet-pay-unlock', 'unlock'],
    ['wallet-pay-preparing', 'preparing'],
    ['wallet-pay-confirm', 'confirm'],
    ['wallet-pay-paying', 'paying'],
    ['wallet-pay-insufficient', 'insufficient'],
    ['wallet-pay-failed', 'failed'],
    ['wallet-pay-prf-unsupported', 'prfUnsupported'],
    ['wallet-pay-unconfirmed', 'unconfirmed'],
  ] as const;

  it.each(pins)('pins %s in a Playwright build', (visual, view) => {
    process.env.NEXT_PUBLIC_E2E_NOW = '2026-01-07T12:00:00.000Z';
    setWallet('error');
    window.history.replaceState({}, '', `/welcome?visual=${visual}`);
    const { result } = renderHook(() => useWalletPay(SPARK, PR, 21));
    expect(result.current).toMatchObject({ view, feeSats: 0 });
    act(() => {
      result.current.unlock();
      result.current.pay();
      result.current.retry();
    });
    expect(unlockWalletPhrase).not.toHaveBeenCalled();
    expect(payFromWallet).not.toHaveBeenCalled();
    expect(connectWallet).not.toHaveBeenCalled();
    expect(walletNeedsReload).not.toHaveBeenCalled();
  });

  it('pins a view without a sparkInvoice', () => {
    process.env.NEXT_PUBLIC_E2E_NOW = '2026-01-07T12:00:00.000Z';
    setWallet('disabled');
    window.history.replaceState({}, '', '/welcome?visual=wallet-pay-confirm');
    expect(renderHook(() => useWalletPay(null, PR, 21)).result.current.view).toBe('confirm');
  });

  it('ignores pins outside a Playwright build or with another value', () => {
    window.history.replaceState({}, '', '/welcome?visual=wallet-pay-confirm');
    setWallet('disabled');
    expect(renderHook(() => useWalletPay(SPARK, PR, 21)).result.current.view).toBe('unavailable');
    process.env.NEXT_PUBLIC_E2E_NOW = '2026-01-07T12:00:00.000Z';
    window.history.replaceState({}, '', '/welcome?visual=other');
    expect(renderHook(() => useWalletPay(SPARK, PR, 21)).result.current.view).toBe('unavailable');
    window.history.replaceState({}, '', '/welcome');
    expect(renderHook(() => useWalletPay(SPARK, PR, 21)).result.current.view).toBe('unavailable');
  });
});

describe('useWalletPay retry', () => {
  it('prepares again after a failed prepare without reconnecting', async () => {
    vi.mocked(payFromWallet).mockResolvedValueOnce({ kind: 'failed' });
    vi.mocked(payFromWallet).mockResolvedValueOnce(confirmWith(async () => ({ kind: 'paid' }), 2));
    const { result } = renderHook(() => useWalletPay(SPARK, PR, 21));
    await act(async () => undefined);
    expect(result.current.view).toBe('failed');
    await act(async () => {
      result.current.retry();
    });
    expect(result.current.view).toBe('confirm');
    expect(result.current.feeSats).toBe(2);
    expect(payFromWallet).toHaveBeenCalledTimes(2);
    expect(connectWallet).not.toHaveBeenCalled();
    expect(walletNeedsReload).not.toHaveBeenCalled();
  });

  it('prepares again after an amount mismatch', async () => {
    vi.mocked(payFromWallet).mockResolvedValueOnce({
      kind: 'confirm',
      amountSats: 22,
      feeSats: 0,
      send: async () => ({ kind: 'paid' }),
    });
    vi.mocked(payFromWallet).mockResolvedValueOnce({ kind: 'insufficient' });
    const { result } = renderHook(() => useWalletPay(SPARK, PR, 21));
    await act(async () => undefined);
    expect(result.current.view).toBe('failed');
    await act(async () => {
      result.current.retry();
    });
    expect(result.current.view).toBe('insufficient');
  });

  it('offers unlock again after a failed unlock', async () => {
    setWallet('locked');
    vi.mocked(unlockWalletPhrase).mockResolvedValueOnce('failed');
    const { result } = renderHook(() => useWalletPay(SPARK, PR, 21));
    await act(async () => {
      result.current.unlock();
    });
    expect(result.current.view).toBe('failed');
    act(() => {
      result.current.retry();
    });
    expect(result.current.view).toBe('unlock');
    await act(async () => {
      result.current.unlock();
    });
    expect(unlockWalletPhrase).toHaveBeenCalledTimes(2);
    expect(result.current.view).toBe('unlock');
    expect(connectWallet).not.toHaveBeenCalled();
  });

  it('connects the wallet again when the store is in error', () => {
    setWallet('error');
    const { result } = renderHook(() => useWalletPay(SPARK, PR, 21));
    act(() => {
      result.current.retry();
    });
    expect(walletNeedsReload).toHaveBeenCalledTimes(1);
    expect(connectWallet).toHaveBeenCalledTimes(1);
    expect(result.current.view).toBe('failed');
  });

  it('reloads the page when the wallet library failed to load', () => {
    setWallet('error');
    vi.mocked(walletNeedsReload).mockReturnValue(true);
    const { result } = renderHook(() => useWalletPay(SPARK, PR, 21));
    const previous = window.location;
    const reload = vi.fn();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { href: previous.href, search: previous.search, reload },
    });
    act(() => {
      result.current.retry();
    });
    Object.defineProperty(window, 'location', { configurable: true, value: previous });
    expect(reload).toHaveBeenCalledTimes(1);
    expect(connectWallet).not.toHaveBeenCalled();
  });

  it('ignores a prepare result from before the retry', async () => {
    let finish: (value: WalletPayResult) => void = () => undefined;
    vi.mocked(payFromWallet).mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    vi.mocked(payFromWallet).mockResolvedValueOnce({ kind: 'insufficient' });
    const { result } = renderHook(() => useWalletPay(SPARK, PR, 21));
    expect(result.current.view).toBe('preparing');
    act(() => {
      setWallet('error');
    });
    expect(result.current.view).toBe('failed');
    await act(async () => {
      result.current.retry();
      setWallet('ready');
    });
    expect(result.current.view).toBe('insufficient');
    await act(async () => {
      finish(confirmWith(async () => ({ kind: 'paid' })));
    });
    expect(result.current.view).toBe('insufficient');
  });
});
