import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useRecoveryFlow } from '@/hooks/useRecoveryFlow';
import {
  createNewPasskey,
  finishWithoutBalance,
  openAndBegin,
  rememberOldWords,
  resetRecovery,
  transfer,
} from '@/lib/recovery-flow';
import { useRecoveryStore, type RecoveryView } from '@/stores/recovery-store';

vi.mock('@/lib/recovery-flow', () => ({
  createNewPasskey: vi.fn(async () => undefined),
  finishWithoutBalance: vi.fn(async () => undefined),
  openAndBegin: vi.fn(async () => undefined),
  rememberOldWords: vi.fn(async () => undefined),
  resetRecovery: vi.fn(async () => undefined),
  transfer: vi.fn(async () => undefined),
}));

const ORIGINAL_E2E_NOW = process.env.NEXT_PUBLIC_E2E_NOW;
const originalHref = window.location.href;

/** Nothing of the move done. */
const NONE = { account: false, address: false, signedIn: false, balance: false };

/**
 * Opens `/recover` with a `?visual=` pin.
 *
 * @param pin - The pin name.
 * @param playwright - Whether this is a Playwright build.
 */
function pinned(pin: string, playwright = true): void {
  if (playwright) {
    process.env.NEXT_PUBLIC_E2E_NOW = '2026-01-07T12:00:00.000Z';
  }
  window.history.replaceState({}, '', `/recover?visual=${pin}`);
}

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.NEXT_PUBLIC_E2E_NOW;
  window.history.replaceState({}, '', '/recover');
  useRecoveryStore.setState({ view: { step: 'start' } });
});

afterEach(() => {
  cleanup();
  window.history.replaceState({}, '', originalHref);
  if (ORIGINAL_E2E_NOW === undefined) {
    delete process.env.NEXT_PUBLIC_E2E_NOW;
  } else {
    process.env.NEXT_PUBLIC_E2E_NOW = ORIGINAL_E2E_NOW;
  }
});

describe('useRecoveryFlow', () => {
  it('shows the view of the store and drives the recovery flow', () => {
    const { result } = renderHook(() => useRecoveryFlow());
    expect(result.current.view).toEqual({ step: 'start' });
    act(() => {
      result.current.onWords('old words', 'acc_ada');
      result.current.retry();
      result.current.createPasskey();
      result.current.transfer();
      result.current.balanceLater();
      result.current.startOver();
    });
    expect(rememberOldWords).toHaveBeenCalledWith('old words', 'acc_ada');
    expect(openAndBegin).toHaveBeenCalledTimes(1);
    expect(createNewPasskey).toHaveBeenCalledTimes(1);
    expect(transfer).toHaveBeenCalledTimes(1);
    expect(finishWithoutBalance).toHaveBeenCalledTimes(1);
    expect(resetRecovery).toHaveBeenCalledTimes(1);
  });

  it('opens the camera or the words field, and the arrow steps back to the start', () => {
    const { result } = renderHook(() => useRecoveryFlow());
    expect(result.current.back()).toBe(false);
    act(() => {
      result.current.scan();
    });
    expect(result.current.view).toEqual({ step: 'scan' });
    let stepped = false;
    act(() => {
      stepped = result.current.back();
    });
    expect(stepped).toBe(true);
    expect(result.current.view).toEqual({ step: 'start' });
    act(() => {
      result.current.type();
    });
    expect(result.current.view).toEqual({ step: 'type' });
    act(() => {
      stepped = result.current.back();
    });
    expect(stepped).toBe(true);
    expect(result.current.view).toEqual({ step: 'start' });
  });

  it('keeps the recovery when the page closes, except on the done step', () => {
    useRecoveryStore.setState({ view: { step: 'opening', waiting: false } });
    const first = renderHook(() => useRecoveryFlow());
    first.unmount();
    expect(resetRecovery).not.toHaveBeenCalled();
    useRecoveryStore.setState({ view: { step: 'done', balanceMissing: false } });
    const second = renderHook(() => useRecoveryFlow());
    second.unmount();
    expect(resetRecovery).toHaveBeenCalledTimes(1);
  });

  it.each<[string, RecoveryView]>([
    ['recover-opening', { step: 'opening', waiting: false }],
    ['recover-opening-wait', { step: 'opening', waiting: true }],
    ['recover-blocked-closed', { step: 'blocked', kind: 'closed' }],
    ['recover-blocked-outdated', { step: 'blocked', kind: 'outdated' }],
    ['recover-not-found', { step: 'refused', reason: 'not_found' }],
    ['recover-done', { step: 'refused', reason: 'done' }],
    ['recover-operator', { step: 'refused', reason: 'operator' }],
    ['recover-other-account', { step: 'refused', reason: 'otherAccount' }],
    ['recover-unavailable', { step: 'retry', reason: 'unavailable' }],
    ['recover-wallet-error', { step: 'retry', reason: 'wallet' }],
    ['recover-found', { step: 'found', username: 'ada', restart: false, error: null, busy: false }],
    [
      'recover-found-busy',
      { step: 'found', username: 'ada', restart: false, error: null, busy: true },
    ],
    [
      'recover-restart',
      { step: 'found', username: 'ada', restart: true, error: null, busy: false },
    ],
    [
      'recover-cancelled',
      { step: 'found', username: 'ada', restart: false, error: 'cancelled', busy: false },
    ],
    [
      'recover-timeout',
      { step: 'found', username: 'ada', restart: false, error: 'timeout', busy: false },
    ],
    ['recover-prf', { step: 'found', username: 'ada', restart: false, error: 'prf', busy: false }],
    [
      'recover-new-wallet-error',
      { step: 'found', username: 'ada', restart: false, error: 'wallet', busy: false },
    ],
    [
      'recover-transfer',
      { step: 'transfer', done: NONE, busy: false, waiting: false, error: null },
    ],
    [
      'recover-transfer-progress',
      {
        step: 'transfer',
        done: { ...NONE, account: true, address: true },
        busy: true,
        waiting: true,
        error: null,
      },
    ],
    [
      'recover-transfer-error',
      {
        step: 'transfer',
        done: { ...NONE, account: true },
        busy: false,
        waiting: false,
        error: 'generic',
      },
    ],
    [
      'recover-balance-error',
      {
        step: 'transfer',
        done: { ...NONE, account: true, address: true, signedIn: true },
        busy: false,
        waiting: false,
        error: 'balance',
      },
    ],
    ['recover-complete', { step: 'done', balanceMissing: false }],
    ['recover-complete-missing', { step: 'done', balanceMissing: true }],
  ])(
    'pin %s opens on %j in a Playwright build, and a production build ignores it',
    (pin, expected) => {
      pinned(pin);
      const playwright = renderHook(() => useRecoveryFlow());
      expect(playwright.result.current.view).toEqual(expected);
      playwright.unmount();
      useRecoveryStore.setState({ view: { step: 'start' } });
      delete process.env.NEXT_PUBLIC_E2E_NOW;
      pinned(pin, false);
      const production = renderHook(() => useRecoveryFlow());
      expect(production.result.current.view).toEqual({ step: 'start' });
    },
  );

  it('ignores an unknown pin', () => {
    pinned('recover-nothing');
    const { result } = renderHook(() => useRecoveryFlow());
    expect(result.current.view).toEqual({ step: 'start' });
  });
});
