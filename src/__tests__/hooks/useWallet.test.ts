import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WALLET_VISUAL_FIXTURE_SATS, WALLET_VISUAL_REOPEN_MS, useWallet } from '@/hooks/useWallet';
import type { Account } from '@/lib/api-types';
import { connectWallet } from '@/lib/wallet/wallet-service';
import { useAuthStore } from '@/stores/auth-store';
import { useWalletStore, type WalletStatus } from '@/stores/wallet-store';

vi.mock('@/lib/wallet/wallet-service', () => ({ connectWallet: vi.fn() }));

const account: Account = {
  id: 'acc_1',
  linkingKey: null,
  role: 'basis',
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
  sparkPubkey: '02'.padEnd(66, 'a'),
  sparkWalletVerified: true,
};

const originalHref = window.location.href;
const ORIGINAL_E2E_NOW = process.env.NEXT_PUBLIC_E2E_NOW;
const ORIGINAL_BREEZ = process.env.NEXT_PUBLIC_BREEZ_API_KEY;

function setWallet(status: WalletStatus, balanceSats: number | null = null): void {
  useWalletStore.setState({ status, balanceSats, identityPubkey: null });
}

function setPlaywrightBuild(): void {
  process.env.NEXT_PUBLIC_E2E_NOW = '2026-01-07T12:00:00.000Z';
}

beforeEach(() => {
  window.history.replaceState({}, '', '/wallet');
  delete process.env.NEXT_PUBLIC_E2E_NOW;
  process.env.NEXT_PUBLIC_BREEZ_API_KEY = 'test-key';
  useAuthStore.setState({ session: 'token', account, lockedSession: null });
  useWalletStore.setState({ setupFailedSession: null, retrying: false, downloading: false });
  setWallet('locked');
  vi.mocked(connectWallet).mockReset().mockResolvedValue(undefined);
});

afterEach(() => {
  cleanup();
  window.history.replaceState({}, '', originalHref);
  if (ORIGINAL_E2E_NOW === undefined) delete process.env.NEXT_PUBLIC_E2E_NOW;
  else process.env.NEXT_PUBLIC_E2E_NOW = ORIGINAL_E2E_NOW;
  if (ORIGINAL_BREEZ === undefined) delete process.env.NEXT_PUBLIC_BREEZ_API_KEY;
  else process.env.NEXT_PUBLIC_BREEZ_API_KEY = ORIGINAL_BREEZ;
});

const PINS = [
  ['balance-connecting', 'connecting', null],
  ['balance-downloading', 'connecting', null],
  ['balance-ready', 'ready', WALLET_VISUAL_FIXTURE_SATS],
  ['history-empty', 'ready', WALLET_VISUAL_FIXTURE_SATS],
  ['history-rows', 'ready', WALLET_VISUAL_FIXTURE_SATS],
  ['history-heart', 'ready', WALLET_VISUAL_FIXTURE_SATS],
  ['history-heart-pending', 'ready', WALLET_VISUAL_FIXTURE_SATS],
  ['heart-payment', 'ready', WALLET_VISUAL_FIXTURE_SATS],
  ['heart-payment-pending', 'ready', WALLET_VISUAL_FIXTURE_SATS],
  ['history-error', 'ready', WALLET_VISUAL_FIXTURE_SATS],
  ['wallet-received', 'ready', WALLET_VISUAL_FIXTURE_SATS],
  ['move-arrived', 'ready', WALLET_VISUAL_FIXTURE_SATS],
  ['wallet-pay-insufficient', 'ready', WALLET_VISUAL_FIXTURE_SATS],
  ['balance-error', 'error', null],
  ['balance-setup-failed', 'error', null],
  ['send-input', 'ready', WALLET_VISUAL_FIXTURE_SATS],
  ['send-confirm', 'ready', WALLET_VISUAL_FIXTURE_SATS],
  ['setup-pending', 'connecting', null],
  ['balance-reopening', 'error', null],
] as const;

describe('useWallet visual pins', () => {
  it.each(PINS)('pins %s to %s in a Playwright build', (visual, status, balanceSats) => {
    setPlaywrightBuild();
    window.history.replaceState({}, '', `/wallet?visual=${visual}`);
    const { result } = renderHook(() => useWallet());
    expect(result.current.status).toBe(status);
    expect(result.current.balanceSats).toBe(balanceSats);
    expect(result.current.setupFailed).toBe(visual === 'balance-setup-failed');
    expect(result.current.retrying).toBe(visual === 'balance-reopening');
    expect(result.current.downloading).toBe(visual === 'balance-downloading');
  });

  it('turns the balance-reopening pin ready by itself after its time', () => {
    vi.useFakeTimers();
    try {
      setPlaywrightBuild();
      window.history.replaceState({}, '', '/wallet?visual=balance-reopening');
      const { result, unmount } = renderHook(() => useWallet());
      act(() => {
        vi.advanceTimersByTime(WALLET_VISUAL_REOPEN_MS - 1);
      });
      expect(result.current).toMatchObject({ status: 'error', balanceSats: null, retrying: true });
      act(() => {
        vi.advanceTimersByTime(1);
      });
      expect(result.current).toMatchObject({
        status: 'ready',
        balanceSats: WALLET_VISUAL_FIXTURE_SATS,
        retrying: false,
      });
      unmount();
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('drops the balance-reopening timer when it unmounts first', () => {
    vi.useFakeTimers();
    try {
      setPlaywrightBuild();
      window.history.replaceState({}, '', '/wallet?visual=balance-reopening');
      const { unmount } = renderHook(() => useWallet());
      expect(vi.getTimerCount()).toBe(1);
      unmount();
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('starts no timer for balance-reopening in a production build', () => {
    vi.useFakeTimers();
    try {
      window.history.replaceState({}, '', '/wallet?visual=balance-reopening');
      setWallet('error');
      const { result } = renderHook(() => useWallet());
      expect(vi.getTimerCount()).toBe(0);
      act(() => {
        vi.advanceTimersByTime(WALLET_VISUAL_REOPEN_MS);
      });
      expect(result.current).toMatchObject({ status: 'error', retrying: false });
    } finally {
      vi.useRealTimers();
    }
  });

  it.each(PINS.map(([visual]) => visual))('ignores %s in a production build', (visual) => {
    window.history.replaceState({}, '', `/wallet?visual=${visual}`);
    setWallet('disabled');
    const { result } = renderHook(() => useWallet());
    expect(result.current.status).toBe('disabled');
  });

  it('ignores a missing or unrelated visual value', () => {
    setPlaywrightBuild();
    setWallet('disabled');
    expect(renderHook(() => useWallet()).result.current.status).toBe('disabled');
    cleanup();
    window.history.replaceState({}, '', '/wallet?visual=unrelated');
    expect(renderHook(() => useWallet()).result.current.status).toBe('disabled');
  });

  it('leaves retry inert while pinned', () => {
    setPlaywrightBuild();
    window.history.replaceState({}, '', '/wallet?visual=balance-error');
    const { result } = renderHook(() => useWallet());
    act(() => result.current.retry());
    expect(connectWallet).not.toHaveBeenCalled();
  });
});

describe('useWallet live state', () => {
  it('is disabled when the store is disabled or the account cannot hold a wallet', () => {
    setWallet('disabled', 42);
    let view = renderHook(() => useWallet());
    expect(view.result.current).toMatchObject({
      status: 'disabled',
      balanceSats: null,
      setupFailed: false,
    });
    view.unmount();
    useAuthStore.setState({ account: { ...account, passkeyCredentialId: null } });
    setWallet('ready', 42);
    view = renderHook(() => useWallet());
    expect(view.result.current.status).toBe('disabled');
  });

  it('maps an unstarted store to connecting and follows later store state', () => {
    const { result } = renderHook(() => useWallet());
    const retry = result.current.retry;
    expect(result.current.status).toBe('connecting');
    act(() => setWallet('ready', 21_000));
    expect(result.current.status).toBe('ready');
    expect(result.current.balanceSats).toBe(21_000);
    expect(result.current.retry).toBe(retry);
  });

  it('shows connecting while setup is due', () => {
    useAuthStore.setState({ account: { ...account, sparkWalletVerified: false } });
    setWallet('ready', 21_000);
    const { result } = renderHook(() => useWallet());
    expect(result.current).toMatchObject({
      status: 'connecting',
      balanceSats: null,
      setupFailed: false,
    });
  });

  it('reports downloading while setup is due and the wallet code downloads', () => {
    useAuthStore.setState({ account: { ...account, sparkWalletVerified: false } });
    useWalletStore.setState({ status: 'connecting', downloading: true });
    const { result } = renderHook(() => useWallet());
    expect(result.current).toMatchObject({ status: 'connecting', downloading: true });
    act(() => {
      useWalletStore.setState({ status: 'ready', downloading: false });
    });
    expect(result.current).toMatchObject({ status: 'connecting', downloading: false });
  });

  it('shows the setup error after setup failed', () => {
    useAuthStore.setState({ account: { ...account, sparkWalletVerified: false } });
    useWalletStore.setState({ status: 'error', setupFailedSession: 'token' });
    const { result } = renderHook(() => useWallet());
    expect(result.current).toMatchObject({
      status: 'error',
      balanceSats: null,
      setupFailed: true,
    });
  });

  it('reports retrying only while the store is at error with a retry on its way', () => {
    useWalletStore.setState({ status: 'error', retrying: true });
    const { result } = renderHook(() => useWallet());
    expect(result.current).toMatchObject({ status: 'error', retrying: true, setupFailed: false });
    act(() => useWalletStore.setState({ retrying: false }));
    expect(result.current.retrying).toBe(false);
    act(() => useWalletStore.setState({ status: 'connecting', retrying: true }));
    expect(result.current.retrying).toBe(false);
  });

  it('does not report retrying while the setup error shows', () => {
    useAuthStore.setState({ account: { ...account, sparkWalletVerified: false } });
    useWalletStore.setState({ status: 'error', setupFailedSession: 'token', retrying: true });
    const { result } = renderHook(() => useWallet());
    expect(result.current).toMatchObject({ status: 'error', setupFailed: true, retrying: false });
  });

  it('retries by connecting in this page, never by reloading it', () => {
    const previous = window.location;
    const reload = vi.fn();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { href: previous.href, search: previous.search, reload },
    });
    try {
      useWalletStore.setState({ status: 'error' });
      const { result } = renderHook(() => useWallet());
      act(() => result.current.retry());
      expect(connectWallet).toHaveBeenCalledTimes(1);
      expect(reload).not.toHaveBeenCalled();
    } finally {
      Object.defineProperty(window, 'location', { configurable: true, value: previous });
    }
  });

  it('reports downloading only while the wallet is connecting', () => {
    useWalletStore.setState({ status: 'connecting', downloading: true });
    const { result, rerender } = renderHook(() => useWallet());
    expect(result.current).toMatchObject({ status: 'connecting', downloading: true });
    act(() => {
      useWalletStore.setState({ status: 'error', downloading: true });
    });
    rerender();
    expect(result.current).toMatchObject({ status: 'error', downloading: false });
  });
});
