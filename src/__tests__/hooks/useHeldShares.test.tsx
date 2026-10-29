import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useHeldShares } from '@/hooks/useHeldShares';
import type { Account } from '@/lib/api-types';
import { HELD_SHARES_KEY_PREFIX, type HeldShare } from '@/lib/recovery-holder-store';
import { useAuthStore } from '@/stores/auth-store';

/** Two shares of one recovery set (identifier 2864). */
const SHARES = [
  'body lily academic acid acne violence volume package glen escape prospect wealthy gesture venture legal already activity raspy camera easel',
  'body lily academic agency domain sugar learn owner kitchen exhaust aircraft sled fused dragon froth argue traveler reunion library geology',
] as const;

/** A share of another set (a share of another recovery set, identifier 7506). */
const OTHER_SET =
  'domain morning academic acid disease humidity peasant cleanup trend describe romp terminal should knit often alarm visitor tension universe peanut';

const HOLDER = 'acc_holder';
const HOLDER_KEY = `${HELD_SHARES_KEY_PREFIX}${HOLDER}`;

const account: Account = {
  id: HOLDER,
  linkingKey: null,
  role: 'basis',
  name: 'Hal',
  username: 'hal',
  location: null,
  lightningAddress: null,
  lightningAddressVerified: false,
  forumLawsDismissed: false,
  createdAt: 1_700_000_000,
  rulesAgreedAt: 1_700_000_001,
  viewKey: 'a'.repeat(64),
  aboutMe: null,
  aboutMeHasPhoto: false,
  setup: null,
  missing: [],
};

/**
 * A share payload.
 *
 * @param share - Share words.
 * @param owner - Owner account id.
 * @param username - Owner username.
 * @returns The payload text.
 */
function code(share: string, owner = 'acc_bob', username = 'bob'): string {
  return `21gifts-share:v1:${owner}:${username}:${share}`;
}

/**
 * Stores shares under a keeping member's key.
 *
 * @param key - The storage key.
 * @param entries - Payloads with the time they were kept.
 */
function seed(key: string, entries: Array<{ code: string; storedAt: number }>): void {
  window.localStorage.setItem(key, JSON.stringify({ v: 1, shares: entries }));
}

/**
 * The shares the hook lists, by owner.
 *
 * @param shares - Listed shares.
 * @returns Owner usernames in order.
 */
function owners(shares: HeldShare[]): string[] {
  return shares.map((share) => share.ownerUsername);
}

beforeEach(() => {
  window.localStorage.clear();
  useAuthStore.setState({ session: 'sess', account });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  window.localStorage.clear();
  useAuthStore.setState({ session: null, account: null });
});

describe('useHeldShares', () => {
  it('lists the signed-in member’s shares, newest first, and starts on the list', () => {
    seed(HOLDER_KEY, [
      { code: code(SHARES[0]), storedAt: 1 },
      { code: code(OTHER_SET, 'acc_cara', 'cara'), storedAt: 2 },
    ]);
    seed(`${HELD_SHARES_KEY_PREFIX}acc_other`, [
      { code: code(SHARES[1], 'acc_dan', 'dan'), storedAt: 3 },
    ]);
    const { result } = renderHook(() => useHeldShares());
    expect(owners(result.current.shares)).toEqual(['cara', 'bob']);
    expect(result.current.view).toBe('list');
    expect(result.current.notice).toBeNull();
    expect(result.current.confirmDelete).toBeNull();
  });

  it('opens the camera and keeps a scanned share of another member', () => {
    vi.spyOn(Date, 'now').mockReturnValue(5_000);
    const { result } = renderHook(() => useHeldShares());
    act(() => {
      result.current.scan();
    });
    expect(result.current.view).toBe('scan');
    act(() => {
      result.current.onScanResult(code(SHARES[0]));
    });
    expect(result.current.view).toBe('list');
    expect(result.current.notice).toEqual({ kind: 'stored', username: 'bob' });
    expect(owners(result.current.shares)).toEqual(['bob']);
    expect(result.current.shares[0]?.storedAt).toBe(5_000);
    expect(window.localStorage.getItem(HOLDER_KEY)).toContain(SHARES[0]);
  });

  it('refuses a text that is not a share', () => {
    const { result } = renderHook(() => useHeldShares());
    act(() => {
      result.current.scan();
    });
    act(() => {
      result.current.onScanResult('lightning:lnbc1');
    });
    expect(result.current.view).toBe('list');
    expect(result.current.notice).toEqual({ kind: 'invalid' });
    expect(window.localStorage.getItem(HOLDER_KEY)).toBeNull();
  });

  it('refuses a share of the member’s own account', () => {
    const { result } = renderHook(() => useHeldShares());
    act(() => {
      result.current.onScanResult(code(SHARES[0], HOLDER, 'hal'));
    });
    expect(result.current.notice).toEqual({ kind: 'own', username: 'hal' });
    expect(result.current.shares).toEqual([]);
  });

  it('refuses a second share of one setup, also when another account here keeps it', () => {
    seed(`${HELD_SHARES_KEY_PREFIX}acc_other`, [{ code: code(SHARES[1]), storedAt: 1 }]);
    const { result } = renderHook(() => useHeldShares());
    act(() => {
      result.current.onScanResult(code(SHARES[0]));
    });
    expect(result.current.notice).toEqual({ kind: 'duplicate', username: 'bob' });
    expect(result.current.shares).toEqual([]);
    expect(window.localStorage.getItem(HOLDER_KEY)).toBeNull();
  });

  it('says so when the browser cannot keep the share', () => {
    vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError');
    });
    const { result } = renderHook(() => useHeldShares());
    act(() => {
      result.current.onScanResult(code(SHARES[0]));
    });
    expect(result.current.notice).toEqual({ kind: 'storage', username: 'bob' });
    expect(result.current.shares).toEqual([]);
  });

  it('shows a share’s code, and the arrow returns to the list', () => {
    seed(HOLDER_KEY, [{ code: code(SHARES[0]), storedAt: 1 }]);
    const { result } = renderHook(() => useHeldShares());
    act(() => {
      result.current.onScanResult('not a share');
    });
    const share = result.current.shares[0] as HeldShare;
    act(() => {
      result.current.askDelete(share);
    });
    act(() => {
      result.current.showQr(share);
    });
    expect(result.current.view).toEqual({ qr: share });
    expect(result.current.notice).toBeNull();
    expect(result.current.confirmDelete).toBeNull();
    let stepped = false;
    act(() => {
      stepped = result.current.back();
    });
    expect(stepped).toBe(true);
    expect(result.current.view).toBe('list');
    act(() => {
      stepped = result.current.back();
    });
    expect(stepped).toBe(false);
  });

  it('steps back from the camera to the list', () => {
    const { result } = renderHook(() => useHeldShares());
    act(() => {
      result.current.scan();
    });
    let stepped = false;
    act(() => {
      stepped = result.current.back();
    });
    expect(stepped).toBe(true);
    expect(result.current.view).toBe('list');
  });

  it('asks before a delete, cancels, and deletes on confirm', () => {
    seed(HOLDER_KEY, [
      { code: code(SHARES[0]), storedAt: 1 },
      { code: code(OTHER_SET, 'acc_cara', 'cara'), storedAt: 2 },
    ]);
    const { result } = renderHook(() => useHeldShares());
    act(() => {
      result.current.onScanResult('not a share');
    });
    const bob = result.current.shares[1] as HeldShare;
    act(() => {
      result.current.askDelete(bob);
    });
    expect(result.current.confirmDelete).toBe(bob.code);
    act(() => {
      result.current.cancel();
    });
    expect(result.current.confirmDelete).toBeNull();
    act(() => {
      result.current.askDelete(bob);
    });
    act(() => {
      result.current.scan();
    });
    expect(result.current.confirmDelete).toBeNull();
    act(() => {
      result.current.back();
    });
    act(() => {
      result.current.askDelete(bob);
    });
    act(() => {
      result.current.remove(bob);
    });
    expect(owners(result.current.shares)).toEqual(['cara']);
    expect(result.current.confirmDelete).toBeNull();
    expect(result.current.notice).toBeNull();
    expect(window.localStorage.getItem(HOLDER_KEY)).not.toContain(SHARES[0]);
  });

  it('keeps a share the browser could not delete and says so', () => {
    seed(HOLDER_KEY, [{ code: code(SHARES[0]), storedAt: 1 }]);
    const { result } = renderHook(() => useHeldShares());
    const share = result.current.shares[0] as HeldShare;
    vi.spyOn(window.localStorage, 'removeItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError');
    });
    act(() => {
      result.current.remove(share);
    });
    expect(owners(result.current.shares)).toEqual(['bob']);
    expect(result.current.notice).toEqual({ kind: 'storage' });
  });

  it('lists nothing and does nothing without an account', () => {
    seed(HOLDER_KEY, [{ code: code(SHARES[0]), storedAt: 1 }]);
    useAuthStore.setState({ account: null });
    const { result } = renderHook(() => useHeldShares());
    expect(result.current.shares).toEqual([]);
    const share: HeldShare = {
      code: code(SHARES[0]),
      ownerAccountId: 'acc_bob',
      ownerUsername: 'bob',
      identifier: 2864,
      memberIndex: 0,
      storedAt: 1,
    };
    act(() => {
      result.current.scan();
      result.current.onScanResult(code(SHARES[1]));
      result.current.remove(share);
    });
    expect(result.current.view).toBe('list');
    expect(result.current.notice).toBeNull();
    expect(window.localStorage.getItem(HOLDER_KEY)).toContain(SHARES[0]);
  });
});
