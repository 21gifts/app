import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  deleteHeldShare,
  HELD_SHARES_KEY_PREFIX,
  keepHeldShare,
  loadHeldShares,
} from '@/lib/recovery-holder-store';

/** The recovery set of one phrase (identifier 2864), as a fixed random source gives it. */
const SHARES = [
  'body lily academic acid acne violence volume package glen escape prospect wealthy gesture venture legal already activity raspy camera easel',
  'body lily academic agency domain sugar learn owner kitchen exhaust aircraft sled fused dragon froth argue traveler reunion library geology',
] as const;

/** A share of another set (a share of another recovery set, identifier 7506). */
const OTHER_SET =
  'domain morning academic acid disease humidity peasant cleanup trend describe romp terminal should knit often alarm visitor tension universe peanut';

const HOLDER = 'acc_holder';
const OWNER = 'acc_owner';

/**
 * A share payload.
 *
 * @param share - Share words.
 * @param owner - Owner account id.
 * @param username - Owner username.
 * @returns The payload text.
 */
function code(share: string, owner = OWNER, username = 'ada'): string {
  return `21gifts-share:v1:${owner}:${username}:${share}`;
}

/**
 * The raw value stored for a keeping member.
 *
 * @param holder - Keeping member's account id.
 * @returns The parsed value, or `null`.
 */
function stored(holder = HOLDER): unknown {
  const raw = window.localStorage.getItem(`${HELD_SHARES_KEY_PREFIX}${holder}`);
  return raw === null ? null : JSON.parse(raw);
}

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  window.localStorage.clear();
});

describe('keepHeldShare', () => {
  it('keeps a share under the keeping member and returns it', () => {
    const result = keepHeldShare(HOLDER, `  ${code(SHARES[0])}\n`, 1_000);
    expect(result).toEqual({
      ok: true,
      share: {
        code: code(SHARES[0]),
        ownerAccountId: OWNER,
        ownerUsername: 'ada',
        identifier: 2864,
        memberIndex: 0,
        storedAt: 1_000,
      },
    });
    expect(stored()).toEqual({ v: 1, shares: [{ code: code(SHARES[0]), storedAt: 1_000 }] });
  });

  it('refuses text that is not a share payload', () => {
    expect(keepHeldShare(HOLDER, SHARES[0], 1)).toEqual({ ok: false, reason: 'invalid' });
    expect(stored()).toBeNull();
  });

  it("refuses the keeping member's own share", () => {
    expect(keepHeldShare(OWNER, code(SHARES[0]), 1)).toEqual({ ok: false, reason: 'own' });
  });

  it('refuses a second share of one set, also when another account in this browser keeps it', () => {
    expect(keepHeldShare(HOLDER, code(SHARES[0]), 1).ok).toBe(true);
    expect(keepHeldShare(HOLDER, code(SHARES[1]), 2)).toEqual({
      ok: false,
      reason: 'duplicate',
    });
    expect(keepHeldShare('acc_second', code(SHARES[1]), 3)).toEqual({
      ok: false,
      reason: 'duplicate',
    });
    window.localStorage.setItem('unrelated', 'x');
    window.localStorage.setItem(
      `${HELD_SHARES_KEY_PREFIX}acc_seeded`,
      JSON.stringify({ v: 1, shares: [{ code: code(OTHER_SET, 'acc_third'), storedAt: 4 }] }),
    );
    expect(keepHeldShare(HOLDER, code(OTHER_SET, 'acc_third'), 5)).toEqual({
      ok: false,
      reason: 'duplicate',
    });
  });

  it('keeps shares of other owners and other sets side by side', () => {
    expect(keepHeldShare(HOLDER, code(SHARES[0]), 1).ok).toBe(true);
    expect(keepHeldShare(HOLDER, code(SHARES[1], 'acc_other', 'bob'), 2).ok).toBe(true);
    expect(keepHeldShare(HOLDER, code(OTHER_SET), 3).ok).toBe(true);
    expect(loadHeldShares(HOLDER).map((share) => [share.ownerUsername, share.storedAt])).toEqual([
      ['ada', 3],
      ['bob', 2],
      ['ada', 1],
    ]);
  });

  it('skips a key the storage cannot name while it scans', () => {
    window.localStorage.setItem('unrelated', 'x');
    vi.spyOn(window.localStorage, 'key').mockReturnValue(null);
    expect(keepHeldShare(HOLDER, code(SHARES[0]), 1).ok).toBe(true);
  });

  it('answers storage when the browser refuses to read or write', () => {
    const setItem = vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => {
      throw new DOMException('quota', 'QuotaExceededError');
    });
    expect(keepHeldShare(HOLDER, code(SHARES[0]), 1)).toEqual({ ok: false, reason: 'storage' });
    setItem.mockRestore();
    vi.spyOn(window.localStorage, 'getItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError');
    });
    window.localStorage.setItem(`${HELD_SHARES_KEY_PREFIX}${HOLDER}`, '{}');
    expect(keepHeldShare(HOLDER, code(SHARES[0]), 1)).toEqual({ ok: false, reason: 'storage' });
  });
});

describe('loadHeldShares', () => {
  it('reads nothing while nothing is kept', () => {
    expect(loadHeldShares(HOLDER)).toEqual([]);
  });

  it('reads only the keeping member, newest first, and leaves out payloads that no longer read', () => {
    window.localStorage.setItem(
      `${HELD_SHARES_KEY_PREFIX}${HOLDER}`,
      JSON.stringify({
        v: 1,
        shares: [
          { code: code(SHARES[0]), storedAt: 5 },
          { code: 'not a share', storedAt: 9 },
          { code: code(OTHER_SET, 'acc_other'), storedAt: 7 },
        ],
      }),
    );
    expect(keepHeldShare('acc_second', code(SHARES[1], 'acc_x'), 8).ok).toBe(true);
    expect(loadHeldShares(HOLDER)).toEqual([
      {
        code: code(OTHER_SET, 'acc_other'),
        ownerAccountId: 'acc_other',
        ownerUsername: 'ada',
        identifier: 7506,
        memberIndex: 0,
        storedAt: 7,
      },
      {
        code: code(SHARES[0]),
        ownerAccountId: OWNER,
        ownerUsername: 'ada',
        identifier: 2864,
        memberIndex: 0,
        storedAt: 5,
      },
    ]);
  });

  it('reads an unreadable or malformed value as none', () => {
    const key = `${HELD_SHARES_KEY_PREFIX}${HOLDER}`;
    for (const raw of ['{', '[]', '{"v":2,"shares":[]}', '{"v":1,"shares":[{"code":1}]}']) {
      window.localStorage.setItem(key, raw);
      expect(loadHeldShares(HOLDER)).toEqual([]);
    }
  });

  it('reads none when the browser blocks storage', () => {
    vi.spyOn(window.localStorage, 'getItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError');
    });
    expect(loadHeldShares(HOLDER)).toEqual([]);
  });
});

describe('deleteHeldShare', () => {
  it('deletes the share of one owner and set, and the key with the last share', () => {
    keepHeldShare(HOLDER, code(SHARES[0]), 1);
    keepHeldShare(HOLDER, code(OTHER_SET), 2);
    expect(deleteHeldShare(HOLDER, OWNER, 2864)).toBe(true);
    expect(loadHeldShares(HOLDER).map((share) => share.identifier)).toEqual([7506]);
    expect(deleteHeldShare(HOLDER, OWNER, 7506)).toBe(true);
    expect(stored()).toBeNull();
  });

  it('deletes nothing for another owner, another set, or another keeping member', () => {
    keepHeldShare(HOLDER, code(SHARES[0]), 1);
    expect(deleteHeldShare(HOLDER, 'acc_other', 2864)).toBe(false);
    expect(deleteHeldShare(HOLDER, OWNER, 7506)).toBe(false);
    expect(deleteHeldShare('acc_second', OWNER, 2864)).toBe(false);
    expect(loadHeldShares(HOLDER)).toHaveLength(1);
  });

  it('answers false when the browser refuses the write', () => {
    keepHeldShare(HOLDER, code(SHARES[0]), 1);
    vi.spyOn(window.localStorage, 'removeItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError');
    });
    expect(deleteHeldShare(HOLDER, OWNER, 2864)).toBe(false);
  });
});

describe('server-side rendering', () => {
  it('reads, keeps, and deletes nothing without a window', () => {
    vi.stubGlobal('window', undefined);
    expect(loadHeldShares(HOLDER)).toEqual([]);
    expect(keepHeldShare(HOLDER, code(SHARES[0]), 1)).toEqual({ ok: false, reason: 'storage' });
    expect(deleteHeldShare(HOLDER, OWNER, 2864)).toBe(false);
  });
});
