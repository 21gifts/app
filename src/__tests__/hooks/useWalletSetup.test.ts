import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useWalletSetup, walletSetupPin } from '@/hooks/useWalletSetup';
import type { Account } from '@/lib/api-types';
import { walletNeedsReload } from '@/lib/wallet/wallet-sdk';
import { retryWalletSetup } from '@/lib/wallet/wallet-setup';
import { useAuthStore } from '@/stores/auth-store';
import { useWalletStore } from '@/stores/wallet-store';

vi.mock('@/lib/wallet/wallet-setup', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/wallet/wallet-setup')>();
  return { ...actual, retryWalletSetup: vi.fn() };
});

vi.mock('@/lib/wallet/wallet-sdk', () => ({
  walletNeedsReload: vi.fn(() => false),
}));

const SESSION = 'session-1';
const originalHref = window.location.href;
const ORIGINAL_E2E_NOW = process.env.NEXT_PUBLIC_E2E_NOW;
const ORIGINAL_BREEZ = process.env.NEXT_PUBLIC_BREEZ_API_KEY;

function account(overrides: Partial<Account> = {}): Account {
  return {
    id: 'acc',
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
    sparkPubkey: null,
    sparkWalletVerified: false,
    ...overrides,
  };
}

function setPlaywrightBuild(): void {
  process.env.NEXT_PUBLIC_E2E_NOW = '2026-01-07T12:00:00.000Z';
}

beforeEach(() => {
  window.history.replaceState({}, '', '/wallet');
  delete process.env.NEXT_PUBLIC_E2E_NOW;
  process.env.NEXT_PUBLIC_BREEZ_API_KEY = 'test-key';
  useAuthStore.setState({ session: SESSION, account: account(), wrongAccount: false });
  useWalletStore.setState({ setupFailedSession: null });
  vi.mocked(retryWalletSetup).mockReset().mockResolvedValue('done');
  vi.mocked(walletNeedsReload).mockReset().mockReturnValue(false);
});

afterEach(() => {
  cleanup();
  window.history.replaceState({}, '', originalHref);
  if (ORIGINAL_E2E_NOW === undefined) delete process.env.NEXT_PUBLIC_E2E_NOW;
  else process.env.NEXT_PUBLIC_E2E_NOW = ORIGINAL_E2E_NOW;
  if (ORIGINAL_BREEZ === undefined) delete process.env.NEXT_PUBLIC_BREEZ_API_KEY;
  else process.env.NEXT_PUBLIC_BREEZ_API_KEY = ORIGINAL_BREEZ;
  useWalletStore.setState({ setupFailedSession: null });
});

describe('walletSetupPin', () => {
  it.each(['balance-setup-failed', 'wallet-pay-setup-failed', 'pos-setup-failed'])(
    'recognises %s in a Playwright build',
    (visual) => {
      setPlaywrightBuild();
      window.history.replaceState({}, '', `/wallet?visual=${visual}`);
      expect(walletSetupPin()).toBe(true);
    },
  );

  it('ignores unknown pins', () => {
    setPlaywrightBuild();
    window.history.replaceState({}, '', '/wallet?visual=balance-error');
    expect(walletSetupPin()).toBe(false);
  });

  it('returns false without a visual parameter', () => {
    setPlaywrightBuild();
    expect(walletSetupPin()).toBe(false);
  });

  it.each(['balance-setup-failed', 'wallet-pay-setup-failed', 'pos-setup-failed'])(
    'ignores %s in a production build',
    (visual) => {
      window.history.replaceState({}, '', `/wallet?visual=${visual}`);
      expect(walletSetupPin()).toBe(false);
    },
  );
});

describe('useWalletSetup', () => {
  it.each([
    ['matching failed session while due', SESSION, SESSION, account(), true],
    ['different failed session', 'other', SESSION, account(), false],
    ['no failed session', null, SESSION, account(), false],
    ['logged out', SESSION, null, null, false],
    ['verified account', SESSION, SESSION, account({ sparkWalletVerified: true }), false],
    ['account without username', SESSION, SESSION, account({ username: null }), false],
  ] as const)('sets failed for %s', (_label, failedSession, session, currentAccount, expected) => {
    useWalletStore.setState({ setupFailedSession: failedSession });
    useAuthStore.setState({ session, account: currentAccount });
    const { result } = renderHook(() => useWalletSetup());
    expect(result.current.failed).toBe(expected);
  });

  it('reports a pinned note even without a due setup', () => {
    setPlaywrightBuild();
    window.history.replaceState({}, '', '/wallet?visual=pos-setup-failed');
    useAuthStore.setState({ account: account({ sparkWalletVerified: true }) });
    const { result } = renderHook(() => useWalletSetup());
    expect(result.current.failed).toBe(true);
  });

  it('leaves retry inert while pinned', () => {
    setPlaywrightBuild();
    window.history.replaceState({}, '', '/wallet?visual=wallet-pay-setup-failed');
    const { result } = renderHook(() => useWalletSetup());
    act(() => result.current.retry());
    expect(walletNeedsReload).not.toHaveBeenCalled();
    expect(retryWalletSetup).not.toHaveBeenCalled();
  });

  it('reloads when the SDK requires it', () => {
    vi.mocked(walletNeedsReload).mockReturnValue(true);
    const previous = window.location;
    const reload = vi.fn();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { href: previous.href, search: previous.search, reload },
    });
    try {
      const { result } = renderHook(() => useWalletSetup());
      act(() => result.current.retry());
      expect(reload).toHaveBeenCalledTimes(1);
      expect(retryWalletSetup).not.toHaveBeenCalled();
    } finally {
      Object.defineProperty(window, 'location', { configurable: true, value: previous });
    }
  });

  it('retries setup without reloading otherwise', () => {
    const { result } = renderHook(() => useWalletSetup());
    act(() => result.current.retry());
    expect(walletNeedsReload).toHaveBeenCalledTimes(1);
    expect(retryWalletSetup).toHaveBeenCalledTimes(1);
  });
});
