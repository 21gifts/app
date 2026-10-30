/**
 * Social recovery shares as QR payloads, and the split of the 12 words into
 * shares and back. A payload is
 * `21gifts-share:v1:<owner account id>:<owner username>:<20 share words>`; the
 * words stay a standard SLIP-39 share, so the shares can also be combined by
 * hand. A payload reaches the api only encrypted, in a holder's box
 * (`held-shares.ts`).
 */
import { entropyToMnemonic, mnemonicToEntropy } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english';
import {
  combineShares,
  isRecoveryShare,
  parseShare,
  Slip39Error,
  splitRecoverySecret,
} from '@/lib/slip39';

/** Start of every share payload: the format and its version. */
export const SHARE_CODE_PREFIX = '21gifts-share:v1:';

/** Longest payload text that is read at all. */
const SHARE_CODE_MAX_LENGTH = 400;

/** A payload: owner account id, owner username, and 20 lower-case words. */
const SHARE_CODE =
  /^21gifts-share:v1:([0-9A-Za-z_-]{1,64}):([a-z0-9][a-z0-9._-]{0,31}):([a-z]{4,8}(?: [a-z]{4,8}){19})$/;

/** Bytes behind 12 words. */
const PHRASE_ENTROPY_LENGTH = 16;

/** The pairs of shares that must each give the secret back. */
const SHARE_PAIRS: ReadonlyArray<readonly [0 | 1 | 2, 0 | 1 | 2]> = [
  [0, 1],
  [0, 2],
  [1, 2],
];

/** One share payload, read. */
export interface ShareCode {
  /** Account the share belongs to. */
  ownerAccountId: string;
  /** That account's username, to show whose share it is. */
  ownerUsername: string;
  /** The share's 20 words, separated by single spaces. */
  share: string;
  /** SLIP-39 identifier of the set the share belongs to. */
  identifier: number;
  /** 0 for person 1, 1 for person 2, 2 for 21.gifts. */
  memberIndex: number;
}

/**
 * Builds the QR payload of one share.
 *
 * @param ownerAccountId - Account the share belongs to.
 * @param ownerUsername - That account's username.
 * @param share - The share's 20 words.
 * @returns The payload text.
 * @throws Error `Invalid share code` when the result would not read back with
 *   {@link parseShareCode}, so no QR is shown that a holder's app refuses.
 */
export function encodeShareCode(
  ownerAccountId: string,
  ownerUsername: string,
  share: string,
): string {
  const code = `${SHARE_CODE_PREFIX}${ownerAccountId}:${ownerUsername}:${share}`;
  if (parseShareCode(code) === null) {
    throw new Error('Invalid share code');
  }
  return code;
}

/**
 * Reads a scanned or pasted share payload. The text is trimmed; it must have
 * the payload format, and its words must be a valid recovery share (checksum,
 * one group of threshold 1, member threshold 2, 16 bytes, member 0 to 2,
 * extendable, iteration exponent 1).
 *
 * @param text - Scanned or pasted text.
 * @returns The payload's fields, or `null` for anything else.
 */
export function parseShareCode(text: string): ShareCode | null {
  const trimmed = text.trim();
  if (trimmed.length > SHARE_CODE_MAX_LENGTH) {
    return null;
  }
  const match = SHARE_CODE.exec(trimmed);
  if (match === null) {
    return null;
  }
  const ownerAccountId = match[1]!;
  const ownerUsername = match[2]!;
  const share = match[3]!;
  try {
    const parsed = parseShare(share);
    if (!isRecoveryShare(parsed)) {
      return null;
    }
    return {
      ownerAccountId,
      ownerUsername,
      share,
      identifier: parsed.identifier,
      memberIndex: parsed.memberIndex,
    };
  } catch {
    return null;
  }
}

/**
 * Splits 12 words into the three shares of a new recovery set, and checks
 * that every pair of shares gives the same 16 bytes back before any share
 * leaves the phone.
 *
 * @param words - The 12-word recovery phrase.
 * @param random - Source of random bytes for {@link splitRecoverySecret}; the
 *   browser's cryptographic source by default. Tests and the Playwright
 *   screenshot fixture pass a fixed one.
 * @returns The set's identifier and shares 1, 2, and 3 (member index 0, 1, 2).
 * @throws Error from `mnemonicToEntropy` for words that are not a valid
 *   phrase; {@link Slip39Error} `length` for a phrase of more than 12 words;
 *   Error `Recovery split check failed` when a pair does not give the bytes back.
 */
export async function splitPhrase(
  words: string,
  random?: (length: number) => Uint8Array<ArrayBuffer>,
): Promise<{ identifier: number; shares: readonly [string, string, string] }> {
  const entropy = Uint8Array.from(mnemonicToEntropy(words, wordlist));
  const split = await splitRecoverySecret(entropy, random);
  for (const [first, second] of SHARE_PAIRS) {
    const secret = await combineShares([split.shares[first], split.shares[second]]);
    if (secret.length !== entropy.length || secret.some((byte, index) => byte !== entropy[index])) {
      throw new Error('Recovery split check failed');
    }
  }
  return split;
}

/**
 * Rebuilds the 12 words from two shares of one set. The 16 bytes go back
 * through BIP-39, never into the wallet as raw entropy, which would open a
 * different wallet.
 *
 * @param first - One share payload.
 * @param second - Another share payload of the same set.
 * @returns The 12 words.
 * @throws {@link Slip39Error} `set` for shares of another owner or set,
 *   `members` for the same share twice, `digest` when they do not fit
 *   together, or `length` when they do not give 16 bytes.
 */
export async function phraseFromShareCodes(first: ShareCode, second: ShareCode): Promise<string> {
  if (first.ownerAccountId !== second.ownerAccountId || first.identifier !== second.identifier) {
    throw new Slip39Error('set');
  }
  if (first.memberIndex === second.memberIndex) {
    throw new Slip39Error('members');
  }
  const entropy = await combineShares([first.share, second.share]);
  if (entropy.length !== PHRASE_ENTROPY_LENGTH) {
    throw new Slip39Error('length');
  }
  return entropyToMnemonic(entropy, wordlist);
}
