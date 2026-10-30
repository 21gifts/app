/**
 * Shares a member keeps for other members' social recovery, as encrypted
 * boxes on the api under the keeping member's own login (`/me/held-shares`).
 * Each box holds one share code, encrypted in this browser with a key derived
 * from the keeping member's 12 words ({@link heldShareBoxKey}); the api never
 * learns whose share a box holds. A box that does not open with the current
 * words is counted, never deleted on its own, and {@link relockHeldShares}
 * moves boxes from previous words to the current ones after the keeping
 * member's own recovery.
 */
import { fetchHeldShareBoxes, putHeldShareBox } from '@/lib/api';
import {
  heldShareBoxKey,
  newHeldShareBoxId,
  openHeldShare,
  sealHeldShare,
} from '@/lib/held-share-box';
import { encodeShareCode, parseShareCode } from '@/lib/recovery-share-code';

/** One share kept for another member, read from its box. */
export interface HeldShare {
  /** Id of the box it is stored in. */
  boxId: string;
  /** The full share payload. */
  code: string;
  /** Account the share belongs to. */
  ownerAccountId: string;
  /** That account's username. */
  ownerUsername: string;
  /** SLIP-39 identifier of the share's set. */
  identifier: number;
  /** 0 for person 1, 1 for person 2, 2 for the 21.gifts share. */
  memberIndex: number;
}

/** The keeping member's boxes, read with their current words. */
export interface HeldShares {
  /** The shares that opened, by owner username. */
  shares: HeldShare[];
  /** Ids of the boxes that do not open with the current words. */
  lockedIds: string[];
}

/**
 * Outcome of {@link keepHeldShare}: the kept share, or why it was refused
 * (`invalid` payload, the member's `own` share, a `duplicate` of a share of
 * the same set among the member's boxes, or a box the api did not `save`).
 */
export type KeepShareResult =
  { ok: true; share: HeldShare } | { ok: false; reason: 'invalid' | 'own' | 'duplicate' | 'save' };

/**
 * Reads every box of the signed-in member with the given key.
 *
 * @param sessionToken - Bearer session.
 * @param holderAccountId - The signed-in member.
 * @param key - The box key of the member's current words.
 * @returns The shares that opened (by owner username, then box order) and
 *   the ids of the boxes that did not open or hold no share code.
 * @throws Error from {@link fetchHeldShareBoxes} when the boxes cannot be read.
 */
export async function loadHeldShares(
  sessionToken: string,
  holderAccountId: string,
  key: CryptoKey,
): Promise<HeldShares> {
  const boxes = await fetchHeldShareBoxes(sessionToken);
  const shares: HeldShare[] = [];
  const lockedIds: string[] = [];
  for (const box of boxes) {
    const code = await openHeldShare(key, holderAccountId, box.id, box.ciphertext);
    const parsed = code === null ? null : parseShareCode(code);
    if (code === null || parsed === null) {
      lockedIds.push(box.id);
      continue;
    }
    shares.push({
      boxId: box.id,
      code,
      ownerAccountId: parsed.ownerAccountId,
      ownerUsername: parsed.ownerUsername,
      identifier: parsed.identifier,
      memberIndex: parsed.memberIndex,
    });
  }
  shares.sort((a, b) => a.ownerUsername.localeCompare(b.ownerUsername));
  return { shares, lockedIds };
}

/**
 * Keeps a scanned share for another member in a new box. Refuses a share of
 * the member's own account, and a share whose owner and set identifier are
 * already among the member's opened boxes, so one member never keeps two
 * shares of one set.
 *
 * @param sessionToken - Bearer session.
 * @param holderAccountId - The signed-in member who keeps it.
 * @param key - The box key of the member's current words.
 * @param kept - The member's shares, as last read.
 * @param text - The scanned payload.
 * @returns The kept share, or why it was refused.
 */
export async function keepHeldShare(
  sessionToken: string,
  holderAccountId: string,
  key: CryptoKey,
  kept: readonly HeldShare[],
  text: string,
): Promise<KeepShareResult> {
  const parsed = parseShareCode(text);
  if (parsed === null) {
    return { ok: false, reason: 'invalid' };
  }
  if (parsed.ownerAccountId === holderAccountId) {
    return { ok: false, reason: 'own' };
  }
  if (
    kept.some(
      (share) =>
        share.ownerAccountId === parsed.ownerAccountId && share.identifier === parsed.identifier,
    )
  ) {
    return { ok: false, reason: 'duplicate' };
  }
  const code = encodeShareCode(parsed.ownerAccountId, parsed.ownerUsername, parsed.share);
  const boxId = newHeldShareBoxId();
  try {
    const ciphertext = await sealHeldShare(key, holderAccountId, boxId, code);
    await putHeldShareBox(sessionToken, boxId, ciphertext);
  } catch {
    return { ok: false, reason: 'save' };
  }
  return {
    ok: true,
    share: {
      boxId,
      code,
      ownerAccountId: parsed.ownerAccountId,
      ownerUsername: parsed.ownerUsername,
      identifier: parsed.identifier,
      memberIndex: parsed.memberIndex,
    },
  };
}

/**
 * Moves the member's boxes from their previous words to their current ones,
 * after the member's own social recovery: every box that opens with the
 * previous words is encrypted again with the current words and written back
 * under the same id. A box that does not open with the previous words is left
 * as it is. Best effort: it never throws, a box that fails stays as it was,
 * and the next call moves it (the boxes already moved no longer open with the
 * previous words). Same words do nothing.
 *
 * @param sessionToken - Bearer session of the recovered member.
 * @param holderAccountId - The member's account.
 * @param oldWords - The member's previous 12 words.
 * @param newWords - The member's current 12 words.
 * @returns How many boxes were moved.
 */
export async function relockHeldShares(
  sessionToken: string,
  holderAccountId: string,
  oldWords: string,
  newWords: string,
): Promise<number> {
  try {
    const [oldKey, newKey] = await Promise.all([
      heldShareBoxKey(oldWords),
      heldShareBoxKey(newWords),
    ]);
    if (sameWords(oldWords, newWords)) {
      return 0;
    }
    const boxes = await fetchHeldShareBoxes(sessionToken);
    let moved = 0;
    for (const box of boxes) {
      const code = await openHeldShare(oldKey, holderAccountId, box.id, box.ciphertext);
      if (code === null) {
        continue;
      }
      try {
        const ciphertext = await sealHeldShare(newKey, holderAccountId, box.id, code);
        await putHeldShareBox(sessionToken, box.id, ciphertext);
        moved += 1;
      } catch {
        // This box stays under the previous words; the next call moves it.
      }
    }
    return moved;
  } catch {
    return 0;
  }
}

/**
 * Whether two phrases are the same words, ignoring spacing and case.
 *
 * @param a - One phrase.
 * @param b - The other.
 * @returns `true` for the same words.
 */
function sameWords(a: string, b: string): boolean {
  const normal = (words: string): string => words.trim().toLowerCase().split(/\s+/).join(' ');
  return normal(a) === normal(b);
}
