import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useWalletSetup, walletSetupPin } from '@/hooks/useWalletSetup';
import { clearSessionPhrase, rememberSessionPhrase } from '@/lib/tab-phrase';
import { walletNeedsReload } from '@/lib/wallet/wallet-sdk';
import {
  runWalletSetup,
  walletSetupInFlight,
  type WalletSetupOutcome,
} from '@/lib/wallet/wallet-setup';

vi.mock('@/lib/wallet/wallet-setup', () => ({
  runWalletSetup: vi.fn(),
  walletSetupInFlight: vi.fn(() => false),
}));

vi.mock('@/lib/wallet/wallet-sdk', () => ({
  walletNeedsReload: vi.fn(() => false),
}));

const MNEMONIC =
  'abandon ability able about above absent absorb abstract absurd abuse access accident';
const originalHref = window.location.href;
const ORIGINAL_E2E_NOW = process.env.NEXT_PUBLIC_E2E_NOW;

function deferred(): {
  promise: Promise<WalletSetupOutcome>;
  resolve: (o: WalletSetupOutcome) => void;
} {
  let resolve: (o: WalletSetupOutcome) => void = () => undefined;
  const promise = new Promise<WalletSetupOutcome>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

beforeEach(() => {
  window.history.replaceState({}, '', '/wallet');
  delete process.env.NEXT_PUBLIC_E2E_NOW;
  clearSessionPhrase();
  vi.mocked(runWalletSetup).mockReset().mockResolvedValue('done');
  vi.mocked(walletSetupInFlight).mockReset().mockReturnValue(false);
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

describe('walletSetupPin', () => {
  it.each([
    ['setup-intro', 'intro'],
    ['setup-progress', 'progress'],
    ['setup-error', 'error'],
    ['setup-no-prf', 'noPrf'],
    ['other', null],
  ] as const)('maps %s to %s in a Playwright build', (visual, view) => {
    process.env.NEXT_PUBLIC_E2E_NOW = '2026-01-07T12:00:00.000Z';
    window.history.replaceState({}, '', `/wallet?visual=${visual}`);
    expect(walletSetupPin()).toBe(view);
  });

  it('ignores pins outside a Playwright build', () => {
    window.history.replaceState({}, '', '/wallet?visual=setup-error');
    expect(walletSetupPin()).toBeNull();
  });
});

describe('useWalletSetup', () => {
  it('waits on the intro when the phrase is not in tab memory', () => {
    const { result } = renderHook(() => useWalletSetup());
    expect(result.current.view).toBe('intro');
    expect(runWalletSetup).not.toHaveBeenCalled();
  });

  it('starts by itself when the phrase is in tab memory', async () => {
    rememberSessionPhrase(MNEMONIC);
    const run = deferred();
    vi.mocked(runWalletSetup).mockReturnValueOnce(run.promise);
    const { result } = renderHook(() => useWalletSetup());
    expect(result.current.view).toBe('progress');
    expect(runWalletSetup).toHaveBeenCalledTimes(1);
    await act(async () => {
      run.resolve('done');
      await run.promise;
    });
    expect(result.current.view).toBe('progress');
  });

  it('joins a run that is still in flight after a remount, without a phrase in tab memory', async () => {
    vi.mocked(walletSetupInFlight).mockReturnValue(true);
    const run = deferred();
    vi.mocked(runWalletSetup).mockReturnValueOnce(run.promise);
    const { result } = renderHook(() => useWalletSetup());
    expect(result.current.view).toBe('progress');
    expect(runWalletSetup).toHaveBeenCalledTimes(1);
    await act(async () => {
      run.resolve('failed');
      await run.promise;
    });
    expect(result.current.view).toBe('error');
  });

  it.each([
    ['noPrf', 'noPrf'],
    ['failed', 'error'],
    ['cancelled', 'intro'],
    ['superseded', 'intro'],
  ] as const)('shows %s as %s', async (outcome, view) => {
    vi.mocked(runWalletSetup).mockResolvedValueOnce(outcome);
    const { result } = renderHook(() => useWalletSetup());
    await act(async () => {
      result.current.start();
      await Promise.resolve();
    });
    expect(result.current.view).toBe(view);
  });

  it('ignores a second start while running', async () => {
    const run = deferred();
    vi.mocked(runWalletSetup).mockReturnValueOnce(run.promise);
    const { result } = renderHook(() => useWalletSetup());
    act(() => {
      result.current.start();
      result.current.start();
    });
    expect(result.current.view).toBe('progress');
    expect(runWalletSetup).toHaveBeenCalledTimes(1);
    await act(async () => {
      run.resolve('failed');
      await run.promise;
    });
    expect(result.current.view).toBe('error');
  });

  it('retry runs the setup again after an error', async () => {
    vi.mocked(runWalletSetup).mockResolvedValueOnce('failed').mockResolvedValueOnce('done');
    const { result } = renderHook(() => useWalletSetup());
    await act(async () => {
      result.current.start();
      await Promise.resolve();
    });
    expect(result.current.view).toBe('error');
    await act(async () => {
      result.current.retry();
      await Promise.resolve();
    });
    expect(result.current.view).toBe('progress');
    expect(runWalletSetup).toHaveBeenCalledTimes(2);
  });

  it('retry reloads the page when the wallet must reload', () => {
    vi.mocked(walletNeedsReload).mockReturnValue(true);
    const reload = vi.fn();
    const original = window.location;
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...original, reload, search: '' },
    });
    try {
      const { result } = renderHook(() => useWalletSetup());
      act(() => {
        result.current.retry();
      });
      expect(reload).toHaveBeenCalledTimes(1);
      expect(runWalletSetup).not.toHaveBeenCalled();
    } finally {
      Object.defineProperty(window, 'location', { configurable: true, value: original });
    }
  });

  it('a pinned view stays put and leaves the actions inert', () => {
    process.env.NEXT_PUBLIC_E2E_NOW = '2026-01-07T12:00:00.000Z';
    window.history.replaceState({}, '', '/wallet?visual=setup-error');
    rememberSessionPhrase(MNEMONIC);
    const { result } = renderHook(() => useWalletSetup());
    expect(result.current.view).toBe('error');
    act(() => {
      result.current.start();
      result.current.retry();
    });
    expect(runWalletSetup).not.toHaveBeenCalled();
    expect(result.current.view).toBe('error');
  });
});
