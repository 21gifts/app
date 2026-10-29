/**
 * Shares a member keeps for other members' social recovery, in this
 * browser's `localStorage` under the keeping member's own account id
 * (`21gifts.recoveryShares.<holder account id>`). A share is never sent to the
 * api. Logging out does not remove it; the screens show a member only the
 * shares kept under the account that is signed in. Every accessor is guarded
 * with `typeof window === 'undefined'` and a try/catch, so the module is safe
 * during server-side rendering and with blocked storage.
 */
import { z } from 'zod';
import { encodeShareCode, parseShareCode } from '@/lib/recovery-share-code';

/** Start of the `localStorage` key of each keeping member's shares. */
export const HELD_SHARES_KEY_PREFIX = '21gifts.recoveryShares.';

/** One share kept for another member. */
export interface HeldShare {
  /** The full share payload, as scanned. */
  code: string;
  /** Account the share belongs to. */
  ownerAccountId: string;
  /** That account's username. */
  ownerUsername: string;
  /** SLIP-39 identifier of the share's set. */
  identifier: number;
  /** 0 for person 1, 1 for person 2, 2 for the 21.gifts share. */
  memberIndex: number;
  /** When it was kept, epoch ms. */
  storedAt: number;
}

/**
 * Outcome of {@link keepHeldShare}: the kept share, or why it was refused
 * (`invalid` payload, the member's `own` share, a `duplicate` of a share of
 * the same set kept in this browser, or `storage` that could not be written).
 */
export type KeepShareResult =
  | { ok: true; share: HeldShare }
  | { ok: false; reason: 'invalid' | 'own' | 'duplicate' | 'storage' };

/** The stored value of one keeping member. */
const storedSharesSchema = z.object({
  v: z.literal(1),
  shares: z.array(z.object({ code: z.string(), storedAt: z.number() })),
});

/**
 * The `localStorage` key of a keeping member's shares.
 *
 * @param holderAccountId - Account of the member who keeps the shares.
 * @returns The key.
 */
function storageKey(holderAccountId: string): string {
  return `${HELD_SHARES_KEY_PREFIX}${holderAccountId}`;
}

/**
 * The valid shares stored under one key, in stored order. A missing,
 * unreadable, or malformed value counts as none, and a payload that no longer
 * reads is left out.
 *
 * @param storage - The browser's `localStorage`.
 * @param key - A key starting with {@link HELD_SHARES_KEY_PREFIX}.
 * @returns The shares.
 */
function storedShares(storage: Storage, key: string): HeldShare[] {
  const raw = storage.getItem(key);
  if (raw === null) {
    return [];
  }
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return [];
  }
  const parsed = storedSharesSchema.safeParse(value);
  if (!parsed.success) {
    return [];
  }
  return parsed.data.shares.flatMap(({ code, storedAt }) => {
    const share = parseShareCode(code);
    return share === null
      ? []
      : [
          {
            code,
            ownerAccountId: share.ownerAccountId,
            ownerUsername: share.ownerUsername,
            identifier: share.identifier,
            memberIndex: share.memberIndex,
            storedAt,
          },
        ];
  });
}

/**
 * Writes one keeping member's shares, or removes the key when none is left.
 *
 * @param storage - The browser's `localStorage`.
 * @param key - The member's key.
 * @param shares - The shares to keep.
 * @throws When the browser refuses the write.
 */
function writeShares(storage: Storage, key: string, shares: readonly HeldShare[]): void {
  if (shares.length === 0) {
    storage.removeItem(key);
    return;
  }
  const value = { v: 1, shares: shares.map(({ code, storedAt }) => ({ code, storedAt })) };
  storage.setItem(key, JSON.stringify(value));
}

/**
 * Reads the shares the signed-in member keeps for others, newest first.
 *
 * @param holderAccountId - Account of the signed-in member.
 * @returns The shares; none on the server, with blocked storage, or when the
 *   stored value is unreadable. Payloads that no longer read are left out.
 */
export function loadHeldShares(holderAccountId: string): HeldShare[] {
  if (typeof window === 'undefined') {
    return [];
  }
  try {
    return storedShares(window.localStorage, storageKey(holderAccountId)).sort(
      (a, b) => b.storedAt - a.storedAt,
    );
  } catch {
    return [];
  }
}

/**
 * Keeps a scanned share for another member. Refuses a share of the member's
 * own account, and a share whose owner and set identifier are already kept in
 * this browser under any account, so one phone never holds two shares of one
 * set.
 *
 * @param holderAccountId - Account of the signed-in member who keeps it.
 * @param text - The scanned payload.
 * @param now - Epoch ms to store as the time it was kept.
 * @returns The kept share, or why it was refused.
 */
export function keepHeldShare(holderAccountId: string, text: string, now: number): KeepShareResult {
  const parsed = parseShareCode(text);
  if (parsed === null) {
    return { ok: false, reason: 'invalid' };
  }
  if (parsed.ownerAccountId === holderAccountId) {
    return { ok: false, reason: 'own' };
  }
  if (typeof window === 'undefined') {
    return { ok: false, reason: 'storage' };
  }
  try {
    const storage = window.localStorage;
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (key !== null && key.startsWith(HELD_SHARES_KEY_PREFIX)) {
        const kept = storedShares(storage, key).some(
          (share) =>
            share.ownerAccountId === parsed.ownerAccountId &&
            share.identifier === parsed.identifier,
        );
        if (kept) {
          return { ok: false, reason: 'duplicate' };
        }
      }
    }
    const share: HeldShare = {
      code: encodeShareCode(parsed.ownerAccountId, parsed.ownerUsername, parsed.share),
      ownerAccountId: parsed.ownerAccountId,
      ownerUsername: parsed.ownerUsername,
      identifier: parsed.identifier,
      memberIndex: parsed.memberIndex,
      storedAt: now,
    };
    const key = storageKey(holderAccountId);
    writeShares(storage, key, [...storedShares(storage, key), share]);
    return { ok: true, share };
  } catch {
    return { ok: false, reason: 'storage' };
  }
}

/**
 * Deletes a kept share: the one of this owner and set identifier.
 *
 * @param holderAccountId - Account of the signed-in member who keeps it.
 * @param ownerAccountId - Account the share belongs to.
 * @param identifier - SLIP-39 identifier of the share's set.
 * @returns `true` when a share was deleted; `false` when none matched, on the
 *   server, or when storage could not be written.
 */
export function deleteHeldShare(
  holderAccountId: string,
  ownerAccountId: string,
  identifier: number,
): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  try {
    const storage = window.localStorage;
    const key = storageKey(holderAccountId);
    const shares = storedShares(storage, key);
    const left = shares.filter(
      (share) => share.ownerAccountId !== ownerAccountId || share.identifier !== identifier,
    );
    if (left.length === shares.length) {
      return false;
    }
    writeShares(storage, key, left);
    return true;
  } catch {
    return false;
  }
}
