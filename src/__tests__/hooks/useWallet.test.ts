import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WALLET_VISUAL_FIXTURE_SATS, useWallet } from '@/hooks/useWallet';
import type { Account } from '@/lib/api-types';
import { walletNeedsReload } from '@/lib/wallet/wallet-sdk';
import { connectWallet } from '@/lib/wallet/wallet-service';
import { useAuthStore } from '@/stores/auth-store';
import { useWalletStore, type WalletStatus } from '@/stores/wallet-store';

vi.mock('@/lib/wallet/wallet-service', () => ({ connectWallet: vi.fn() }));
vi.mock('@/lib/wallet/wallet-sdk', () => ({ walletNeedsReload: vi.fn(() => false) }));

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
  useWalletStore.setState({ setupFailedSession: null });
  setWallet('locked');
  vi.mocked(connectWallet).mockReset().mockResolvedValue(undefined);
  vi.mocked(walletNeedsReload).mockReset().mockReturnValue(false);
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
  ['balance-ready', 'ready', WALLET_VISUAL_FIXTURE_SATS],
  ['history-empty', 'ready', WALLET_VISUAL_FIXTURE_SATS],
  ['history-rows', 'ready', WALLET_VISUAL_FIXTURE_SATS],
  ['history-error', 'ready', WALLET_VISUAL_FIXTURE_SATS],
  ['balance-error', 'error', null],
  ['balance-setup-failed', 'error', null],
  ['send-input', 'ready', WALLET_VISUAL_FIXTURE_SATS],
  ['send-confirm', 'ready', WALLET_VISUAL_FIXTURE_SATS],
  ['send-alert-locked', 'ready', WALLET_VISUAL_FIXTURE_SATS],
] as const;

describe('useWallet visual pins', () => {
  it.each(PINS)('pins %s to %s in a Playwright build', (visual, status, balanceSats) => {
    setPlaywrightBuild();
    window.history.replaceState({}, '', `/wallet?visual=${visual}`);
    const { result } = renderHook(() => useWallet());
    expect(result.current.status).toBe(status);
    expect(result.current.balanceSats).toBe(balanceSats);
    expect(result.current.setupFailed).toBe(visual === 'balance-setup-failed');
    expect(result.current.canReceive).toBe(visual !== 'balance-setup-failed');
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
    expect(walletNeedsReload).not.toHaveBeenCalled();
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
      canReceive: true,
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

  it('shows connecting and disables Receive while setup is due', () => {
    useAuthStore.setState({ account: { ...account, sparkWalletVerified: false } });
    setWallet('ready', 21_000);
    const { result } = renderHook(() => useWallet());
    expect(result.current).toMatchObject({
      status: 'connecting',
      balanceSats: null,
      setupFailed: false,
      canReceive: false,
    });
  });

  it('shows the setup error and disables Receive after setup failed', () => {
    useAuthStore.setState({ account: { ...account, sparkWalletVerified: false } });
    useWalletStore.setState({ status: 'error', setupFailedSession: 'token' });
    const { result } = renderHook(() => useWallet());
    expect(result.current).toMatchObject({
      status: 'error',
      balanceSats: null,
      setupFailed: true,
      canReceive: false,
    });
  });

  it('retries by connecting when no reload is required', () => {
    const { result } = renderHook(() => useWallet());
    act(() => result.current.retry());
    expect(walletNeedsReload).toHaveBeenCalledTimes(1);
    expect(connectWallet).toHaveBeenCalledTimes(1);
  });

  it('reloads instead of connecting when the wallet SDK requires it', () => {
    vi.mocked(walletNeedsReload).mockReturnValue(true);
    const previous = window.location;
    const reload = vi.fn();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { href: previous.href, search: previous.search, reload },
    });
    try {
      const { result } = renderHook(() => useWallet());
      act(() => result.current.retry());
      expect(reload).toHaveBeenCalledTimes(1);
      expect(connectWallet).not.toHaveBeenCalled();
    } finally {
      Object.defineProperty(window, 'location', { configurable: true, value: previous });
    }
  });
});
