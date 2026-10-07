import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  WALLET_PAY_BALANCE_POLL_MS,
  WALLET_PAY_CONFIRM_WAIT_MS,
  useWalletPay,
} from '@/hooks/useWalletPay';
import { walletNeedsReload } from '@/lib/wallet/wallet-sdk';
import {
  connectWallet,
  payFromWallet,
  refreshWallet,
  type WalletPayResult,
  type WalletSendResult,
} from '@/lib/wallet/wallet-service';
import { logInteraction } from '@/lib/interaction-log';
import { useAuthStore } from '@/stores/auth-store';
import { useWalletStore, type WalletStatus } from '@/stores/wallet-store';

vi.mock('@/lib/wallet/wallet-service', () => ({
  connectWallet: vi.fn(),
  payFromWallet: vi.fn(),
  refreshWallet: vi.fn(),
}));

vi.mock('@/lib/interaction-log', () => ({ logInteraction: vi.fn() }));
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
  useWalletStore.setState({ setupFailedSession: null });
  setWallet('ready');
  vi.mocked(payFromWallet).mockReset();
  vi.mocked(connectWallet).mockReset().mockResolvedValue(undefined);
  vi.mocked(refreshWallet).mockReset().mockResolvedValue(undefined);
  vi.mocked(walletNeedsReload).mockReset().mockReturnValue(false);
  vi.mocked(logInteraction).mockClear();
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

  it('shows preparing while the account is in the one-time wallet setup', () => {
    process.env.NEXT_PUBLIC_BREEZ_API_KEY = 'breez-key';
    useAuthStore.setState({ account: { ...account, sparkWalletVerified: false } });
    const { result } = renderHook(() => useWalletPay(SPARK, PR, 21));
    expect(result.current.view).toBe('preparing');
    expect(payFromWallet).not.toHaveBeenCalled();
  });

  it('prepares once the account finishes the one-time wallet setup', async () => {
    process.env.NEXT_PUBLIC_BREEZ_API_KEY = 'breez-key';
    vi.mocked(payFromWallet).mockResolvedValue(confirmWith(async () => ({ kind: 'paid' })));
    useAuthStore.setState({ account: { ...account, sparkWalletVerified: false } });
    const { result } = renderHook(() => useWalletPay(SPARK, PR, 21));
    expect(result.current.view).toBe('preparing');
    await act(async () => {
      useAuthStore.setState({ account: { ...account, sparkWalletVerified: true } });
    });
    expect(payFromWallet).toHaveBeenCalledTimes(1);
    expect(result.current.view).toBe('confirm');
  });

  it('falls unavailable when the account cannot hold a wallet', () => {
    useAuthStore.setState({ account: { ...account, passkeyCredentialId: null } });
    const { result } = renderHook(() => useWalletPay(SPARK, PR, 21));
    expect(result.current.view).toBe('unavailable');
    expect(payFromWallet).not.toHaveBeenCalled();
  });

  it('shows setupFailed after background setup gave up for this session', () => {
    process.env.NEXT_PUBLIC_BREEZ_API_KEY = 'breez-key';
    useAuthStore.setState({ account: { ...account, sparkWalletVerified: false } });
    useWalletStore.setState({ setupFailedSession: 'token' });
    const { result } = renderHook(() => useWalletPay(SPARK, PR, 21));
    expect(result.current.view).toBe('setupFailed');
    expect(payFromWallet).not.toHaveBeenCalled();
  });

  it('shows failed while the wallet store is in error', () => {
    setWallet('error');
    const { result } = renderHook(() => useWalletPay(SPARK, PR, 21));
    expect(result.current.view).toBe('failed');
    expect(payFromWallet).not.toHaveBeenCalled();
  });

  it('shows preparing while the store has not connected, then prepares when ready', async () => {
    setWallet('locked');
    vi.mocked(payFromWallet).mockResolvedValue(confirmWith(async () => ({ kind: 'paid' }), 3));
    const { result } = renderHook(() => useWalletPay(SPARK, PR, 21));
    expect(result.current.view).toBe('preparing');
    expect(payFromWallet).not.toHaveBeenCalled();
    await act(async () => setWallet('ready'));
    expect(result.current.view).toBe('confirm');
    expect(result.current.feeSats).toBe(3);
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

  it('becomes unavailable and stops balance reads when the account leaves wallet mode', async () => {
    vi.useFakeTimers();
    setWallet('ready', 10);
    vi.mocked(payFromWallet).mockResolvedValue({ kind: 'insufficient' });
    const { result } = renderHook(() => useWalletPay(SPARK, PR, 21));
    await act(async () => undefined);
    expect(result.current.view).toBe('insufficient');
    await act(async () => {
      useAuthStore.setState({ account: { ...account, passkeyCredentialId: null } });
      await vi.advanceTimersByTimeAsync(WALLET_PAY_BALANCE_POLL_MS * 2);
    });
    expect(result.current.view).toBe('unavailable');
    expect(refreshWallet).not.toHaveBeenCalled();
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

  it('prepares again when the balance becomes known after an insufficient result and covers it', async () => {
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
    expect(payFromWallet).toHaveBeenCalledTimes(1);
    expect(result.current.view).toBe('insufficient');
    await act(async () => {
      setWallet('ready', 21);
    });
    expect(payFromWallet).toHaveBeenCalledTimes(2);
    expect(result.current.view).toBe('confirm');
  });

  it('keeps the insufficient view while a top-up does not yet cover amount and known fee', async () => {
    setWallet('ready', 0);
    vi.mocked(payFromWallet)
      .mockResolvedValueOnce({ kind: 'insufficient', feeSats: 4 })
      .mockResolvedValueOnce(confirmWith(async () => ({ kind: 'paid' }), 4));
    const { result } = renderHook(() => useWalletPay(SPARK, PR, 21));
    await act(async () => undefined);
    expect(result.current.view).toBe('insufficient');
    expect(result.current.feeSats).toBe(4);
    expect(result.current.missingSats).toBe(25);
    await act(async () => {
      setWallet('ready', 21);
    });
    expect(result.current.view).toBe('insufficient');
    expect(result.current.missingSats).toBe(4);
    expect(payFromWallet).toHaveBeenCalledTimes(1);
    await act(async () => {
      setWallet('ready', 25);
    });
    expect(payFromWallet).toHaveBeenCalledTimes(2);
    expect(result.current.view).toBe('confirm');
    expect(result.current.feeSats).toBe(4);
    expect(result.current.missingSats).toBeNull();
  });

  it('counts the fee of an insufficient send in the missing amount, and waits for Send after the top-up', async () => {
    const send = vi.fn(async (): Promise<WalletSendResult> => ({ kind: 'paid' }));
    setWallet('ready', 10);
    vi.mocked(payFromWallet)
      .mockResolvedValueOnce(confirmWith(async () => ({ kind: 'insufficient' }), 2))
      .mockResolvedValueOnce(confirmWith(send, 2));
    const { result } = renderHook(() => useWalletPay(SPARK, PR, 21));
    await act(async () => undefined);
    await act(async () => {
      result.current.pay();
    });
    expect(result.current.view).toBe('insufficient');
    expect(result.current.missingSats).toBe(13);
    await act(async () => {
      setWallet('ready', 23);
    });
    expect(result.current.view).toBe('confirm');
    expect(send).not.toHaveBeenCalled();
    await act(async () => {
      result.current.pay();
    });
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('gives no missing amount while the balance is unknown or the fee makes up the rest', async () => {
    setWallet('ready', null);
    vi.mocked(payFromWallet).mockResolvedValue({ kind: 'insufficient' });
    const { result } = renderHook(() => useWalletPay(SPARK, PR, 21));
    await act(async () => undefined);
    expect(result.current.view).toBe('insufficient');
    expect(result.current.missingSats).toBeNull();
    await act(async () => {
      setWallet('ready', 30);
    });
    await act(async () => {
      setWallet('ready', 30);
    });
    expect(result.current.view).toBe('insufficient');
    expect(result.current.missingSats).toBeNull();
  });
});

describe('useWalletPay balance reads while insufficient', () => {
  it('reads the synced balance every few seconds, one read at a time, and stops after insufficient', async () => {
    vi.useFakeTimers();
    let finish: () => void = () => undefined;
    vi.mocked(refreshWallet).mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    setWallet('ready', 0);
    vi.mocked(payFromWallet)
      .mockResolvedValueOnce({ kind: 'insufficient' })
      .mockResolvedValueOnce(confirmWith(async () => ({ kind: 'paid' })));
    const { result } = renderHook(() => useWalletPay(SPARK, PR, 21));
    await act(async () => undefined);
    expect(result.current.view).toBe('insufficient');
    expect(refreshWallet).not.toHaveBeenCalled();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(WALLET_PAY_BALANCE_POLL_MS);
    });
    expect(refreshWallet).toHaveBeenCalledTimes(1);
    expect(refreshWallet).toHaveBeenCalledWith({ ensureSynced: true, ignoreFailure: true });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(WALLET_PAY_BALANCE_POLL_MS * 2);
    });
    expect(refreshWallet).toHaveBeenCalledTimes(1);
    await act(async () => {
      finish();
      await vi.advanceTimersByTimeAsync(WALLET_PAY_BALANCE_POLL_MS);
    });
    expect(refreshWallet).toHaveBeenCalledTimes(2);
    await act(async () => {
      finish();
      setWallet('ready', 21);
    });
    expect(result.current.view).toBe('confirm');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(WALLET_PAY_BALANCE_POLL_MS * 3);
    });
    expect(refreshWallet).toHaveBeenCalledTimes(2);
  });

  it('stops reading when the slot closes or the wallet leaves ready', async () => {
    vi.useFakeTimers();
    setWallet('ready', 0);
    vi.mocked(payFromWallet).mockResolvedValue({ kind: 'insufficient' });
    const first = renderHook(() => useWalletPay(SPARK, PR, 21));
    await act(async () => undefined);
    first.unmount();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(WALLET_PAY_BALANCE_POLL_MS * 2);
    });
    expect(refreshWallet).not.toHaveBeenCalled();
    const second = renderHook(() => useWalletPay(SPARK, PR, 21));
    await act(async () => undefined);
    expect(second.result.current.view).toBe('insufficient');
    await act(async () => {
      setWallet('locked', null);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(WALLET_PAY_BALANCE_POLL_MS * 2);
    });
    expect(refreshWallet).not.toHaveBeenCalled();
  });

  it('never reads while a pinned view shows', async () => {
    vi.useFakeTimers();
    process.env.NEXT_PUBLIC_E2E_NOW = '2026-01-07T12:00:00.000Z';
    window.history.replaceState({}, '', '/welcome?visual=wallet-pay-insufficient');
    const { result } = renderHook(() => useWalletPay(SPARK, PR, 21));
    expect(result.current).toMatchObject({ view: 'insufficient', missingSats: 21 });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(WALLET_PAY_BALANCE_POLL_MS * 2);
    });
    expect(refreshWallet).not.toHaveBeenCalled();
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
    expect(logInteraction).toHaveBeenCalledTimes(1);
    expect(logInteraction).toHaveBeenCalledWith('gift_sent', { amountSats: 21 });
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
    expect(logInteraction).not.toHaveBeenCalled();
  });

  it('shows insufficient balance when the send says so', async () => {
    vi.mocked(payFromWallet).mockResolvedValue(confirmWith(async () => ({ kind: 'insufficient' })));
    const { result } = renderHook(() => useWalletPay(SPARK, PR, 21));
    await act(async () => undefined);
    await act(async () => {
      result.current.pay();
    });
    expect(result.current.view).toBe('insufficient');
    expect(logInteraction).not.toHaveBeenCalled();
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
    ['wallet-pay-preparing', 'preparing'],
    ['wallet-pay-confirm', 'confirm'],
    ['wallet-pay-paying', 'paying'],
    ['wallet-pay-insufficient', 'insufficient'],
    ['wallet-pay-failed', 'failed'],
    ['wallet-pay-setup-failed', 'setupFailed'],
    ['wallet-pay-unconfirmed', 'unconfirmed'],
  ] as const;

  it.each(pins)('pins %s in a Playwright build', (visual, view) => {
    process.env.NEXT_PUBLIC_E2E_NOW = '2026-01-07T12:00:00.000Z';
    setWallet('error');
    window.history.replaceState({}, '', `/welcome?visual=${visual}`);
    const { result } = renderHook(() => useWalletPay(SPARK, PR, 21));
    expect(result.current).toMatchObject({ view, feeSats: 0, missingSats: 21 });
    act(() => {
      result.current.pay();
      result.current.retry();
    });
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

  it.each(pins.map(([visual]) => visual))('ignores %s in a production build', (visual) => {
    window.history.replaceState({}, '', `/welcome?visual=${visual}`);
    setWallet('disabled');
    expect(renderHook(() => useWalletPay(SPARK, PR, 21)).result.current.view).toBe('unavailable');
  });

  it('ignores another or missing visual value', () => {
    setWallet('disabled');
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
