import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WALLET_VISUAL_FIXTURE_SATS, useWallet } from '@/hooks/useWallet';
import { clearSessionPhrase, rememberSessionPhrase } from '@/lib/tab-phrase';
import { unlockWalletPhrase } from '@/lib/wallet/wallet-phrase';
import { walletNeedsReload } from '@/lib/wallet/wallet-sdk';
import { connectWallet } from '@/lib/wallet/wallet-service';
import { useAuthStore } from '@/stores/auth-store';
import { useWalletStore, type WalletStatus } from '@/stores/wallet-store';

vi.mock('@/lib/wallet/wallet-phrase', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/wallet/wallet-phrase')>();
  return {
    ...actual,
    unlockWalletPhrase: vi.fn(),
  };
});

vi.mock('@/lib/wallet/wallet-service', () => ({
  connectWallet: vi.fn(),
}));

vi.mock('@/lib/wallet/wallet-sdk', () => ({
  walletNeedsReload: vi.fn(() => false),
}));

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

const originalHref = window.location.href;
const ORIGINAL_E2E_NOW = process.env.NEXT_PUBLIC_E2E_NOW;

function setWallet(status: WalletStatus, balanceSats: number | null = null): void {
  useWalletStore.setState({ status, balanceSats, identityPubkey: null });
}

function setPlaywrightBuild(): void {
  process.env.NEXT_PUBLIC_E2E_NOW = '2026-01-07T12:00:00.000Z';
}

beforeEach(() => {
  window.history.replaceState({}, '', '/wallet');
  clearSessionPhrase();
  delete process.env.NEXT_PUBLIC_E2E_NOW;
  useAuthStore.setState({ session: 'token', account });
  setWallet('locked');
  vi.mocked(unlockWalletPhrase).mockReset().mockResolvedValue('unlocked');
  vi.mocked(connectWallet).mockReset().mockResolvedValue(undefined);
  vi.mocked(walletNeedsReload).mockReset().mockReturnValue(false);
});

afterEach(() => {
  cleanup();
  clearSessionPhrase();
  window.history.replaceState({}, '', originalHref);
  if (ORIGINAL_E2E_NOW === undefined) {
    delete process.env.NEXT_PUBLIC_E2E_NOW;
  } else {
    process.env.NEXT_PUBLIC_E2E_NOW = ORIGINAL_E2E_NOW;
  }
});

describe('useWallet', () => {
  it.each([
    ['balance-locked', 'locked', null],
    ['balance-connecting', 'connecting', null],
    ['balance-ready', 'ready', WALLET_VISUAL_FIXTURE_SATS],
    ['balance-error', 'error', null],
    ['history-empty', 'ready', WALLET_VISUAL_FIXTURE_SATS],
    ['history-rows', 'ready', WALLET_VISUAL_FIXTURE_SATS],
    ['history-error', 'ready', WALLET_VISUAL_FIXTURE_SATS],
  ] as const)('pins %s to %s', (visual, status, balanceSats) => {
    setPlaywrightBuild();
    window.history.replaceState({}, '', `/wallet?visual=${visual}`);
    const { result } = renderHook(() => useWallet());
    expect(result.current.status).toBe(status);
    expect(result.current.balanceSats).toBe(balanceSats);
  });

  it('ignores visual pins outside a Playwright build', async () => {
    window.history.replaceState({}, '', '/wallet?visual=balance-ready');
    setWallet('disabled');
    const { result } = renderHook(() => useWallet());
    expect(result.current.status).toBe('disabled');
    expect(result.current.balanceSats).toBeNull();
    await act(async () => {
      result.current.unlock();
      await Promise.resolve();
    });
    expect(unlockWalletPhrase).toHaveBeenCalledTimes(1);
  });

  it('ignores an unrelated visual value', () => {
    setPlaywrightBuild();
    window.history.replaceState({}, '', '/wallet?visual=unrelated');
    setWallet('ready', 42);
    const { result } = renderHook(() => useWallet());
    expect(result.current.status).toBe('ready');
    expect(result.current.balanceSats).toBe(42);
  });

  it('stays disabled when the store is disabled', () => {
    setWallet('disabled', 42);
    const { result } = renderHook(() => useWallet());
    expect(result.current.status).toBe('disabled');
    expect(result.current.balanceSats).toBeNull();
  });

  it('stays disabled when the account cannot unlock', () => {
    useAuthStore.setState({ account: { ...account, passkeyCredentialId: null } });
    setWallet('ready', 42);
    const { result } = renderHook(() => useWallet());
    expect(result.current.status).toBe('disabled');
    expect(result.current.balanceSats).toBeNull();
  });

  it('shows connecting during unlock and returns to locked after success', async () => {
    let finish: ((result: 'unlocked') => void) | undefined;
    vi.mocked(unlockWalletPhrase).mockReturnValueOnce(
      new Promise<'unlocked'>((resolve) => {
        finish = resolve;
      }),
    );
    const { result } = renderHook(() => useWallet());
    act(() => result.current.unlock());
    expect(result.current.status).toBe('connecting');
    await act(async () => {
      finish?.('unlocked');
      await Promise.resolve();
    });
    expect(result.current.status).toBe('locked');
  });

  it('returns to locked after a cancelled unlock', async () => {
    vi.mocked(unlockWalletPhrase).mockResolvedValueOnce('cancelled');
    const { result } = renderHook(() => useWallet());
    await act(async () => {
      result.current.unlock();
      await Promise.resolve();
    });
    expect(result.current.status).toBe('locked');
  });

  it('shows an error after a failed unlock', async () => {
    vi.mocked(unlockWalletPhrase).mockResolvedValueOnce('failed');
    const { result } = renderHook(() => useWallet());
    await act(async () => {
      result.current.unlock();
      await Promise.resolve();
    });
    expect(result.current.status).toBe('error');
  });

  it('runs only one unlock ceremony after a double click', async () => {
    let finish: ((result: 'unlocked') => void) | undefined;
    vi.mocked(unlockWalletPhrase).mockReturnValueOnce(
      new Promise<'unlocked'>((resolve) => {
        finish = resolve;
      }),
    );
    const { result } = renderHook(() => useWallet());
    act(() => {
      result.current.unlock();
      result.current.unlock();
    });
    expect(unlockWalletPhrase).toHaveBeenCalledTimes(1);
    await act(async () => {
      finish?.('unlocked');
      await Promise.resolve();
    });
  });

  it('retries by unlocking when tab memory has no phrase', async () => {
    const { result } = renderHook(() => useWallet());
    await act(async () => {
      result.current.retry();
      await Promise.resolve();
    });
    expect(unlockWalletPhrase).toHaveBeenCalledTimes(1);
    expect(connectWallet).not.toHaveBeenCalled();
  });

  it('retries by connecting when tab memory has a phrase', () => {
    rememberSessionPhrase(
      'abandon ability able about above absent absorb abstract absurd abuse access accident',
    );
    const { result } = renderHook(() => useWallet());
    act(() => result.current.retry());
    expect(connectWallet).toHaveBeenCalledTimes(1);
    expect(unlockWalletPhrase).not.toHaveBeenCalled();
  });

  it('retries by reloading when the SDK failed to load', () => {
    rememberSessionPhrase(
      'abandon ability able about above absent absorb abstract absurd abuse access accident',
    );
    vi.mocked(walletNeedsReload).mockReturnValue(true);
    const previous = window.location;
    const reload = vi.fn();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        href: previous.href,
        search: previous.search,
        reload,
      },
    });
    const { result } = renderHook(() => useWallet());
    act(() => result.current.retry());
    Object.defineProperty(window, 'location', { configurable: true, value: previous });
    expect(reload).toHaveBeenCalledTimes(1);
    expect(connectWallet).not.toHaveBeenCalled();
    expect(unlockWalletPhrase).not.toHaveBeenCalled();
  });

  it('retries by connecting when the SDK does not need a reload', () => {
    rememberSessionPhrase(
      'abandon ability able about above absent absorb abstract absurd abuse access accident',
    );
    vi.mocked(walletNeedsReload).mockReturnValue(false);
    const { result } = renderHook(() => useWallet());
    act(() => result.current.retry());
    expect(connectWallet).toHaveBeenCalledTimes(1);
    expect(unlockWalletPhrase).not.toHaveBeenCalled();
  });

  it('does not unlock or connect under a visual pin', () => {
    setPlaywrightBuild();
    window.history.replaceState({}, '', '/wallet?visual=balance-error');
    rememberSessionPhrase(
      'abandon ability able about above absent absorb abstract absurd abuse access accident',
    );
    const { result } = renderHook(() => useWallet());
    act(() => {
      result.current.unlock();
      result.current.retry();
    });
    expect(unlockWalletPhrase).not.toHaveBeenCalled();
    expect(connectWallet).not.toHaveBeenCalled();
  });

  it('follows the store from connecting to ready with its balance', () => {
    setWallet('connecting');
    const { result } = renderHook(() => useWallet());
    const unlock = result.current.unlock;
    const retry = result.current.retry;
    expect(result.current.status).toBe('connecting');
    act(() => setWallet('ready', 21_000));
    expect(result.current.status).toBe('ready');
    expect(result.current.balanceSats).toBe(21_000);
    expect(result.current.unlock).toBe(unlock);
    expect(result.current.retry).toBe(retry);
  });
});
