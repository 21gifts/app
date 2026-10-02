import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WALLET_PAY_CONFIRM_WAIT_MS, useWalletPay } from '@/hooks/useWalletPay';
import { unlockWalletPhrase } from '@/lib/wallet/wallet-phrase';
import {
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

vi.mock('@/lib/wallet/wallet-service', () => ({ payFromWallet: vi.fn() }));

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
const ORIGINAL_E2E_NOW = process.env.NEXT_PUBLIC_E2E_NOW;

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
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  if (ORIGINAL_E2E_NOW === undefined) {
    delete process.env.NEXT_PUBLIC_E2E_NOW;
  } else {
    process.env.NEXT_PUBLIC_E2E_NOW = ORIGINAL_E2E_NOW;
  }
});

describe('useWalletPay path choice', () => {
  it('falls back without a sparkInvoice', () => {
    for (const value of [null, undefined, '']) {
      const { result, unmount } = renderHook(() => useWalletPay(value, 21));
      expect(result.current.view).toBe('fallback');
      unmount();
    }
    expect(payFromWallet).not.toHaveBeenCalled();
  });

  it('falls back when the wallet is disabled or failed', () => {
    for (const status of ['disabled', 'error'] as const) {
      setWallet(status);
      const { result, unmount } = renderHook(() => useWalletPay(SPARK, 21));
      expect(result.current.view).toBe('fallback');
      unmount();
    }
    expect(payFromWallet).not.toHaveBeenCalled();
  });

  it('falls back when the account cannot unlock a wallet', () => {
    useAuthStore.setState({ account: { ...account, passkeyCredentialId: null } });
    const { result } = renderHook(() => useWalletPay(SPARK, 21));
    expect(result.current.view).toBe('fallback');
  });

  it('offers unlock for a locked wallet and prepares once it is ready', async () => {
    setWallet('locked');
    vi.mocked(payFromWallet).mockResolvedValue(confirmWith(async () => ({ kind: 'paid' }), 3));
    const { result } = renderHook(() => useWalletPay(SPARK, 21));
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
    const { result } = renderHook(() => useWalletPay(SPARK, 21));
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

  it('falls back after a failed unlock', async () => {
    setWallet('locked');
    vi.mocked(unlockWalletPhrase).mockResolvedValue('failed');
    const { result } = renderHook(() => useWalletPay(SPARK, 21));
    await act(async () => {
      result.current.unlock();
    });
    expect(result.current.view).toBe('fallback');
  });

  it('falls back when prepare fails, and shows insufficient balance', async () => {
    vi.mocked(payFromWallet).mockResolvedValueOnce({ kind: 'failed' });
    const failed = renderHook(() => useWalletPay(SPARK, 21));
    await act(async () => undefined);
    expect(failed.result.current.view).toBe('fallback');
    failed.unmount();
    vi.mocked(payFromWallet).mockResolvedValueOnce({ kind: 'unlock' });
    const unlock = renderHook(() => useWalletPay(SPARK, 21));
    await act(async () => undefined);
    expect(unlock.result.current.view).toBe('fallback');
    unlock.unmount();
    vi.mocked(payFromWallet).mockResolvedValueOnce({ kind: 'insufficient' });
    const low = renderHook(() => useWalletPay(SPARK, 21));
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
    const { result, rerender } = renderHook(({ value }) => useWalletPay(value, 21), {
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
    const { result, unmount } = renderHook(() => useWalletPay(SPARK, 21));
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

describe('useWalletPay guards', () => {
  it('falls back when the prepared amount differs from the amount on the sheet', async () => {
    vi.mocked(payFromWallet).mockResolvedValue({
      kind: 'confirm',
      amountSats: 22,
      feeSats: 0,
      send: async () => ({ kind: 'paid' }),
    });
    const { result } = renderHook(() => useWalletPay(SPARK, 21));
    await act(async () => undefined);
    expect(result.current.view).toBe('fallback');
  });

  it('drops a confirm step when the wallet leaves ready, and prepares again once ready', async () => {
    vi.mocked(payFromWallet).mockResolvedValue(confirmWith(async () => ({ kind: 'paid' })));
    const { result } = renderHook(() => useWalletPay(SPARK, 21));
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
    expect(result.current.view).toBe('fallback');
  });

  it('drops a prepare result when the wallet leaves ready meanwhile', async () => {
    let finish: (value: WalletPayResult) => void = () => undefined;
    vi.mocked(payFromWallet).mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const { result } = renderHook(() => useWalletPay(SPARK, 21));
    expect(result.current.view).toBe('preparing');
    act(() => {
      setWallet('error');
    });
    await act(async () => {
      finish(confirmWith(async () => ({ kind: 'paid' })));
    });
    expect(result.current.view).toBe('fallback');
  });

  it('keeps the paying view when the wallet leaves ready after the send started', async () => {
    vi.mocked(payFromWallet).mockResolvedValue(
      confirmWith(() => new Promise<WalletSendResult>(() => undefined)),
    );
    const { result } = renderHook(() => useWalletPay(SPARK, 21));
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
    const { result } = renderHook(() => useWalletPay(SPARK, 21));
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

  it('measures a rise from the lowest balance seen after insufficient', async () => {
    setWallet('ready', 1_000);
    vi.mocked(payFromWallet)
      .mockResolvedValueOnce(confirmWith(async () => ({ kind: 'insufficient' })))
      .mockResolvedValueOnce(confirmWith(async () => ({ kind: 'paid' })));
    const { result } = renderHook(() => useWalletPay(SPARK, 21));
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
    const { result } = renderHook(() => useWalletPay(SPARK, 21));
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
    const { result } = renderHook(() => useWalletPay(SPARK, 21));
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
    const { result } = renderHook(() => useWalletPay(SPARK, 21));
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
    const { result } = renderHook(() => useWalletPay(SPARK, 21));
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
    const { result } = renderHook(() => useWalletPay(SPARK, 21));
    await act(async () => undefined);
    await act(async () => {
      result.current.pay();
    });
    expect(result.current.view).toBe('insufficient');
  });

  it('drops the wait when the sheet closes before the timer fires', async () => {
    vi.useFakeTimers();
    vi.mocked(payFromWallet).mockResolvedValue(confirmWith(async () => ({ kind: 'failed' })));
    const { result, unmount } = renderHook(() => useWalletPay(SPARK, 21));
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
    const { result, rerender } = renderHook(({ value }) => useWalletPay(value, 21), {
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
    expect(result.current.view).toBe('fallback');
  });

  it('ignores the 60 s timer of an older invoice', async () => {
    vi.useFakeTimers();
    vi.mocked(payFromWallet).mockResolvedValueOnce(confirmWith(async () => ({ kind: 'failed' })));
    vi.mocked(payFromWallet).mockResolvedValueOnce({ kind: 'insufficient' });
    const { result, rerender } = renderHook(({ value }) => useWalletPay(value, 21), {
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
    ['wallet-pay-unlock', 'unlock'],
    ['wallet-pay-preparing', 'preparing'],
    ['wallet-pay-confirm', 'confirm'],
    ['wallet-pay-paying', 'paying'],
    ['wallet-pay-insufficient', 'insufficient'],
    ['wallet-pay-unconfirmed', 'unconfirmed'],
  ] as const;

  it.each(pins)('pins %s in a Playwright build with a sparkInvoice', (visual, view) => {
    process.env.NEXT_PUBLIC_E2E_NOW = '2026-01-07T12:00:00.000Z';
    setWallet('disabled');
    window.history.replaceState({}, '', `/welcome?visual=${visual}`);
    const { result } = renderHook(() => useWalletPay(SPARK, 21));
    expect(result.current).toMatchObject({ view, feeSats: 0 });
    act(() => {
      result.current.unlock();
      result.current.pay();
    });
    expect(unlockWalletPhrase).not.toHaveBeenCalled();
    expect(payFromWallet).not.toHaveBeenCalled();
  });

  it('ignores pins outside a Playwright build, without a sparkInvoice, or with another value', () => {
    window.history.replaceState({}, '', '/welcome?visual=wallet-pay-confirm');
    setWallet('disabled');
    expect(renderHook(() => useWalletPay(SPARK, 21)).result.current.view).toBe('fallback');
    process.env.NEXT_PUBLIC_E2E_NOW = '2026-01-07T12:00:00.000Z';
    expect(renderHook(() => useWalletPay(null, 21)).result.current.view).toBe('fallback');
    window.history.replaceState({}, '', '/welcome?visual=other');
    expect(renderHook(() => useWalletPay(SPARK, 21)).result.current.view).toBe('fallback');
    window.history.replaceState({}, '', '/welcome');
    expect(renderHook(() => useWalletPay(SPARK, 21)).result.current.view).toBe('fallback');
  });
});
