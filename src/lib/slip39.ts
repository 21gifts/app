/**
 * SLIP-39 Shamir shares of the 16 bytes behind a 12-word recovery phrase,
 * built on WebCrypto only (SatoshiLabs SLIP-0039; reference implementation
 * trezor/python-shamir-mnemonic).
 *
 * Splitting makes the one shape social recovery uses: one group with group
 * threshold 1, and three member shares of which any two rebuild the secret,
 * with the extendable flag, iteration exponent 1, and an empty passphrase.
 * Combining reads every valid SLIP-39 set, so the official test vectors run
 * against it. An error carries a fixed code, never a share word or a byte.
 */
import { SLIP39_WORDLIST } from '@/lib/slip39-wordlist';

/**
 * Why a share or a set of shares was refused: `empty` (no share given),
 * `word` (a word is not in the list), `length` (fewer than 20 words, a word
 * count no secret fits, or a wrong secret length), `checksum`, `padding`
 * (non-zero padding bits), `params` (group threshold above group count),
 * `set` (shares of different sets), `groups` (not the number of groups the
 * set needs), `members` (not the members a group needs, or one member twice),
 * `digest` (shares that do not fit together), or `passphrase` (not printable
 * ASCII).
 */
export type Slip39ErrorCode =
  | 'empty'
  | 'word'
  | 'length'
  | 'checksum'
  | 'padding'
  | 'params'
  | 'set'
  | 'groups'
  | 'members'
  | 'digest'
  | 'passphrase';

/**
 * A refused share or set of shares. The message is `slip39_<code>`, so it
 * never holds a share word or a byte.
 */
export class Slip39Error extends Error {
  /** Why the share or the set was refused. */
  public readonly code: Slip39ErrorCode;

  /**
   * @param code - Why the share or the set was refused.
   */
  public constructor(code: Slip39ErrorCode) {
    super(`slip39_${code}`);
    this.name = 'Slip39Error';
    this.code = code;
  }
}

/** The fields one SLIP-39 share encodes in its words. */
export interface Slip39Share {
  /** Random 15-bit id that every share of one set carries. */
  identifier: number;
  /** Extendable backup flag: the identifier is then not part of the cipher salt. */
  extendable: boolean;
  /** Iteration exponent `e`: each cipher round runs `(10000 << e) / 4` PBKDF2 iterations. */
  iterationExponent: number;
  /** Group of this share, 0 to 15. */
  groupIndex: number;
  /** Groups needed to rebuild the secret, 1 to 16. */
  groupThreshold: number;
  /** Groups in the set, 1 to 16. */
  groupCount: number;
  /** Index of this share in its group (its x coordinate), 0 to 15. */
  memberIndex: number;
  /** Shares of its group needed to rebuild the group's secret, 1 to 16. */
  memberThreshold: number;
  /** The share value, as long as the secret. */
  value: Uint8Array<ArrayBuffer>;
}

/** Bytes this module creates itself. */
type Bytes = Uint8Array<ArrayBuffer>;

/** One point of a Shamir polynomial: x coordinate and value bytes. */
interface RawShare {
  /** x coordinate. */
  readonly x: number;
  /** Value at x, one byte per polynomial. */
  readonly data: Bytes;
}

/** Bits each word carries. */
const RADIX_BITS = 10;

/** Words of identifier, extendable flag, and iteration exponent. */
const ID_EXP_WORDS = 2;

/** Words of group index, thresholds, counts, and member index. */
const PARAMS_WORDS = 2;

/** Words of the RS1024 checksum. */
const CHECKSUM_WORDS = 3;

/** Words of a share that are not value words. */
const METADATA_WORDS = ID_EXP_WORDS + PARAMS_WORDS + CHECKSUM_WORDS;

/** Fewest words of a share: a 128-bit secret needs 13 value words. */
const MIN_WORDS = METADATA_WORDS + 13;

/** Bytes of the digest kept in the digest share. */
const DIGEST_LENGTH = 4;

/** x coordinate of the digest share. */
const DIGEST_INDEX = 254;

/** x coordinate of the shared secret. */
const SECRET_INDEX = 255;

/** PBKDF2 iterations of all four cipher rounds together at exponent 0. */
const BASE_ITERATIONS = 10_000;

/** Rounds of the Feistel cipher, in encryption order. */
const ENCRYPT_ROUNDS: readonly number[] = [0, 1, 2, 3];

/** Rounds of the Feistel cipher, in decryption order. */
const DECRYPT_ROUNDS: readonly number[] = [3, 2, 1, 0];

/** Bytes of the secret a recovery split takes: the entropy of 12 words. */
const RECOVERY_SECRET_LENGTH = 16;

/** Iteration exponent of a recovery split (the reference's default). */
const RECOVERY_ITERATION_EXPONENT = 1;

/** Shares of a recovery set that rebuild the secret. */
const RECOVERY_THRESHOLD = 2;

/** Member indices of a recovery set: person 1, person 2, and 21.gifts. */
const RECOVERY_MEMBERS: readonly number[] = [0, 1, 2];

/** Generator of the RS1024 checksum over GF(1024). */
const RS1024_GENERATOR: readonly number[] = [
  0xe0e040, 0x1c1c080, 0x3838100, 0x7070200, 0xe0e0009, 0x1c0c2412, 0x38086c24, 0x3090fc48,
  0x21b1f890, 0x3f3f120,
];

/**
 * The ASCII codes of a text.
 *
 * @param text - ASCII text.
 * @returns One code per character.
 */
function ascii(text: string): number[] {
  return Array.from(text, (character) => character.charCodeAt(0));
}

/** Checksum customization of a set without the extendable flag. */
const CUSTOMIZATION_ORIGINAL = ascii('shamir');

/** Checksum customization of an extendable set. */
const CUSTOMIZATION_EXTENDABLE = ascii('shamir_extendable');

/** Word to its index in the list. A `Map`, so `constructor` and friends are not words. */
const WORD_INDEX = new Map(SLIP39_WORDLIST.map((word, index) => [word, index]));

/**
 * Exponent and logarithm tables of GF(256) under the polynomial
 * x^8 + x^4 + x^3 + x + 1, with generator x + 1.
 *
 * @returns `[exp, log]`; `log[0]` stays 0, as in the reference.
 */
function fieldTables(): readonly [Uint8Array, Uint8Array] {
  const exp = new Uint8Array(255);
  const log = new Uint8Array(256);
  let poly = 1;
  for (let power = 0; power < 255; power += 1) {
    exp[power] = poly;
    log[poly] = power;
    poly = (poly << 1) ^ poly;
    if ((poly & 0x100) !== 0) {
      poly ^= 0x11b;
    }
  }
  return [exp, log];
}

const [GF_EXP, GF_LOG] = fieldTables();

/**
 * The checksum customization a share uses.
 *
 * @param extendable - The share's extendable flag.
 * @returns ASCII codes of `shamir_extendable` or `shamir`.
 */
function customization(extendable: boolean): readonly number[] {
  return extendable ? CUSTOMIZATION_EXTENDABLE : CUSTOMIZATION_ORIGINAL;
}

/**
 * RS1024 polynomial modulus of 10-bit values.
 *
 * @param values - Customization codes followed by word indices.
 * @returns The remainder; 1 for a valid checksum.
 */
function polymod(values: readonly number[]): number {
  let checksum = 1;
  for (const value of values) {
    const top = checksum >>> 20;
    checksum = ((checksum & 0xfffff) << 10) ^ value;
    for (let bit = 0; bit < 10; bit += 1) {
      if (((top >>> bit) & 1) === 1) {
        checksum ^= RS1024_GENERATOR[bit]!;
      }
    }
  }
  return checksum;
}

/**
 * Joins byte arrays.
 *
 * @param parts - Arrays in order.
 * @returns One new array.
 */
function concat(...parts: readonly Uint8Array[]): Bytes {
  const out = new Uint8Array(parts.reduce((length, part) => length + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

/**
 * Byte-wise XOR of two arrays of the same length.
 *
 * @param left - First array.
 * @param right - Second array.
 * @returns A new array.
 */
function xor(left: Bytes, right: Uint8Array): Bytes {
  return left.map((byte, index) => byte ^ right[index]!);
}

/**
 * Whether two arrays hold the same bytes.
 *
 * @param left - First array.
 * @param right - Second array.
 * @returns `true` for equal length and bytes.
 */
function sameBytes(left: Uint8Array, right: Uint8Array): boolean {
  return left.length === right.length && left.every((byte, index) => byte === right[index]);
}

/**
 * `((value % 255) + 255) % 255`: JavaScript's `%` keeps the sign of a
 * negative value, Python's does not.
 *
 * @param value - Any integer.
 * @returns The value modulo 255, from 0 to 254.
 */
function mod255(value: number): number {
  return ((value % 255) + 255) % 255;
}

/**
 * Evaluates the polynomial through the given points at `x` (Lagrange
 * interpolation in GF(256), one polynomial per byte).
 *
 * @param shares - Points with distinct x coordinates and values of one length.
 * @param x - Where to evaluate; never one of the share coordinates here.
 * @returns The value bytes at `x`.
 * @throws {@link Slip39Error} `members` when two points share an x coordinate.
 */
function interpolate(shares: readonly RawShare[], x: number): Bytes {
  if (new Set(shares.map((share) => share.x)).size !== shares.length) {
    throw new Slip39Error('members');
  }
  let logProduct = 0;
  for (const share of shares) {
    logProduct += GF_LOG[share.x ^ x]!;
  }
  const out = new Uint8Array(shares[0]!.data.length);
  for (const share of shares) {
    let logOthers = 0;
    for (const other of shares) {
      logOthers += GF_LOG[share.x ^ other.x]!;
    }
    const logBasis = mod255(logProduct - GF_LOG[share.x ^ x]! - logOthers);
    share.data.forEach((byte, index) => {
      if (byte !== 0) {
        out[index] = out[index]! ^ GF_EXP[(GF_LOG[byte]! + logBasis) % 255]!;
      }
    });
  }
  return out;
}

/**
 * The first four bytes of HMAC-SHA-256 keyed with the random part over the
 * secret: the digest that tells whether shares fit together.
 *
 * @param randomPart - HMAC key.
 * @param secret - HMAC message.
 * @returns Four digest bytes.
 */
async function digestOf(randomPart: Bytes, secret: Bytes): Promise<Bytes> {
  const key = await crypto.subtle.importKey(
    'raw',
    randomPart,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, secret)).slice(0, DIGEST_LENGTH);
}

/**
 * Rebuilds a secret from as many points as its threshold. With threshold 1
 * the one point is the secret; otherwise the digest share must match.
 *
 * @param threshold - Points the secret needs.
 * @param shares - Exactly `threshold` points.
 * @returns The secret.
 * @throws {@link Slip39Error} `members` for a repeated x coordinate, `digest`
 *   when the points do not fit together.
 */
async function recoverSecret(threshold: number, shares: readonly RawShare[]): Promise<Bytes> {
  if (threshold === 1) {
    return shares[0]!.data;
  }
  const secret = interpolate(shares, SECRET_INDEX);
  const digestShare = interpolate(shares, DIGEST_INDEX);
  const expected = await digestOf(digestShare.slice(DIGEST_LENGTH), secret);
  if (!sameBytes(digestShare.slice(0, DIGEST_LENGTH), expected)) {
    throw new Slip39Error('digest');
  }
  return secret;
}

/**
 * The passphrase as bytes.
 *
 * @param passphrase - Printable ASCII text.
 * @returns Its ASCII bytes.
 * @throws {@link Slip39Error} `passphrase` for any other character.
 */
function passphraseBytes(passphrase: string): Bytes {
  if (!/^[\x20-\x7e]*$/.test(passphrase)) {
    throw new Slip39Error('passphrase');
  }
  return Uint8Array.from(ascii(passphrase));
}

/**
 * The four-round Feistel cipher between master secret and encrypted master
 * secret; each round function is PBKDF2-HMAC-SHA-256.
 *
 * @param input - Secret of even length.
 * @param passphrase - Passphrase bytes.
 * @param iterationExponent - The set's iteration exponent.
 * @param identifier - The set's identifier (part of the salt without the extendable flag).
 * @param extendable - The set's extendable flag.
 * @param rounds - {@link ENCRYPT_ROUNDS} or {@link DECRYPT_ROUNDS}.
 * @returns The other side of the cipher.
 */
async function feistel(
  input: Bytes,
  passphrase: Bytes,
  iterationExponent: number,
  identifier: number,
  extendable: boolean,
  rounds: readonly number[],
): Promise<Bytes> {
  const half = input.length / 2;
  let left = input.slice(0, half);
  let right = input.slice(half);
  const salt = extendable
    ? new Uint8Array(0)
    : concat(
        Uint8Array.from(CUSTOMIZATION_ORIGINAL),
        Uint8Array.of(identifier >> 8, identifier & 0xff),
      );
  for (const round of rounds) {
    const key = await crypto.subtle.importKey(
      'raw',
      concat(Uint8Array.of(round), passphrase),
      'PBKDF2',
      false,
      ['deriveBits'],
    );
    const mask = await crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        hash: 'SHA-256',
        salt: concat(salt, right),
        iterations: (BASE_ITERATIONS << iterationExponent) / ENCRYPT_ROUNDS.length,
      },
      key,
      half * 8,
    );
    [left, right] = [right, xor(left, new Uint8Array(mask))];
  }
  return concat(right, left);
}

/**
 * Reads the value bytes of a share from its value words.
 *
 * @param words - Value word indices.
 * @param padding - Leading padding bits, already checked to be zero.
 * @returns The value.
 */
function unpackValue(words: readonly number[], padding: number): Bytes {
  const value = new Uint8Array((RADIX_BITS * words.length - padding) / 8);
  let accumulator = 0;
  let bits = -padding;
  let offset = 0;
  for (const word of words) {
    accumulator = (accumulator << RADIX_BITS) | word;
    bits += RADIX_BITS;
    while (bits >= 8) {
      bits -= 8;
      value[offset] = (accumulator >> bits) & 0xff;
      offset += 1;
      accumulator &= (1 << bits) - 1;
    }
  }
  return value;
}

/**
 * Writes a share of a recovery set as words: extendable, iteration exponent
 * 1, one group (index 0, threshold 1, count 1), member threshold 2.
 *
 * @param identifier - The set's identifier.
 * @param memberIndex - 0, 1, or 2.
 * @param value - The share value.
 * @returns The 20 words, separated by single spaces.
 */
function encodeRecoveryShare(identifier: number, memberIndex: number, value: Bytes): string {
  const idExp = (identifier << 5) | (1 << 4) | RECOVERY_ITERATION_EXPONENT;
  const params = (memberIndex << 4) | (RECOVERY_THRESHOLD - 1);
  const data = [idExp >> RADIX_BITS, idExp & 0x3ff, params >> RADIX_BITS, params & 0x3ff];
  const valueWords = Math.ceil((value.length * 8) / RADIX_BITS);
  let accumulator = 0;
  let bits = valueWords * RADIX_BITS - value.length * 8;
  for (const byte of value) {
    accumulator = (accumulator << 8) | byte;
    bits += 8;
    while (bits >= RADIX_BITS) {
      bits -= RADIX_BITS;
      data.push((accumulator >> bits) & 0x3ff);
      accumulator &= (1 << bits) - 1;
    }
  }
  const checksum = polymod([...CUSTOMIZATION_EXTENDABLE, ...data, 0, 0, 0]) ^ 1;
  data.push((checksum >> 20) & 0x3ff, (checksum >> 10) & 0x3ff, checksum & 0x3ff);
  return data.map((index) => SLIP39_WORDLIST[index]!).join(' ');
}

/**
 * Random bytes from the browser's cryptographic source.
 *
 * @param length - Byte count.
 * @returns New random bytes.
 */
function randomBytes(length: number): Bytes {
  return crypto.getRandomValues(new Uint8Array(length));
}

/**
 * Reads one share from its words. Needs no cryptography: it checks the words,
 * the length, the checksum, the group parameters, and the padding, in the
 * reference's order.
 *
 * @param mnemonic - The share's words, separated by whitespace, in any letter case.
 * @returns The share's fields.
 * @throws {@link Slip39Error} `word`, `length`, `checksum`, `params`, or `padding`.
 */
export function parseShare(mnemonic: string): Slip39Share {
  const indices = mnemonic
    .toLowerCase()
    .split(/\s+/)
    .filter((word) => word !== '')
    .map((word) => {
      const index = WORD_INDEX.get(word);
      if (index === undefined) {
        throw new Slip39Error('word');
      }
      return index;
    });
  if (indices.length < MIN_WORDS) {
    throw new Slip39Error('length');
  }
  const padding = (RADIX_BITS * (indices.length - METADATA_WORDS)) % 16;
  if (padding > 8) {
    throw new Slip39Error('length');
  }
  const idExp = (indices[0]! << RADIX_BITS) | indices[1]!;
  const extendable = ((idExp >> 4) & 1) === 1;
  if (polymod([...customization(extendable), ...indices]) !== 1) {
    throw new Slip39Error('checksum');
  }
  const params = (indices[2]! << RADIX_BITS) | indices[3]!;
  const groupThreshold = ((params >> 12) & 0xf) + 1;
  const groupCount = ((params >> 8) & 0xf) + 1;
  if (groupCount < groupThreshold) {
    throw new Slip39Error('params');
  }
  const valueWords = indices.slice(ID_EXP_WORDS + PARAMS_WORDS, -CHECKSUM_WORDS);
  if (valueWords[0]! >> (RADIX_BITS - padding) !== 0) {
    throw new Slip39Error('padding');
  }
  return {
    identifier: idExp >> 5,
    extendable,
    iterationExponent: idExp & 0xf,
    groupIndex: params >> 16,
    groupThreshold,
    groupCount,
    memberIndex: (params >> 4) & 0xf,
    memberThreshold: (params & 0xf) + 1,
    value: unpackValue(valueWords, padding),
  };
}

/**
 * Whether a share has the shape of a social recovery share: one group of
 * threshold 1, member threshold 2, a 16-byte value, and member index 0, 1, or 2.
 *
 * @param share - Fields from {@link parseShare}.
 * @returns `true` for a recovery share.
 */
export function isRecoveryShare(share: Slip39Share): boolean {
  return (
    share.groupThreshold === 1 &&
    share.groupCount === 1 &&
    share.memberThreshold === RECOVERY_THRESHOLD &&
    share.value.length === RECOVERY_SECRET_LENGTH &&
    share.memberIndex < RECOVERY_MEMBERS.length
  );
}

/**
 * Splits 16 bytes into a recovery set: one group of threshold 1 whose three
 * member shares (index 0 for person 1, 1 for person 2, 2 for 21.gifts) rebuild
 * the bytes two at a time. Extendable, iteration exponent 1, empty passphrase.
 *
 * @param masterSecret - The 16 bytes behind the 12 words.
 * @param random - Source of random bytes; the browser's cryptographic source
 *   by default. Tests inject a fixed one.
 * @returns The set's identifier and its three shares as 20 words each.
 * @throws {@link Slip39Error} `length` unless the secret is 16 bytes.
 */
export async function splitRecoverySecret(
  masterSecret: Uint8Array,
  random: (length: number) => Uint8Array<ArrayBuffer> = randomBytes,
): Promise<{ identifier: number; shares: readonly [string, string, string] }> {
  if (masterSecret.length !== RECOVERY_SECRET_LENGTH) {
    throw new Slip39Error('length');
  }
  const idBytes = random(2);
  const identifier = ((idBytes[0]! << 8) | idBytes[1]!) & 0x7fff;
  const encrypted = await feistel(
    Uint8Array.from(masterSecret),
    new Uint8Array(0),
    RECOVERY_ITERATION_EXPONENT,
    identifier,
    true,
    ENCRYPT_ROUNDS,
  );
  // The group level is one group of threshold 1: its only share is the
  // encrypted secret itself. The member level is 2-of-3: a line through the
  // digest share and the secret, read at x = 0, 1, and 2.
  const randomPart = random(encrypted.length - DIGEST_LENGTH);
  const base: RawShare[] = [
    { x: DIGEST_INDEX, data: concat(await digestOf(randomPart, encrypted), randomPart) },
    { x: SECRET_INDEX, data: encrypted },
  ];
  const [first, second, third] = RECOVERY_MEMBERS.map((memberIndex) =>
    encodeRecoveryShare(identifier, memberIndex, interpolate(base, memberIndex)),
  );
  return { identifier, shares: [first!, second!, third!] };
}

/**
 * Rebuilds the master secret from the shares of one set (any SLIP-39 set:
 * every group shape, both cipher salts). Identical shares count once.
 *
 * @param mnemonics - The shares' words.
 * @param passphrase - Printable ASCII passphrase; empty by default, as social
 *   recovery uses it.
 * @returns The master secret.
 * @throws {@link Slip39Error} `empty`, `passphrase`, any code of
 *   {@link parseShare}, `set` for shares of different sets, `length` for values
 *   of different lengths, `members` or `groups` for the wrong number of
 *   shares, or `digest` when the shares do not fit together.
 */
export async function combineShares(
  mnemonics: readonly string[],
  passphrase = '',
): Promise<Uint8Array<ArrayBuffer>> {
  if (mnemonics.length === 0) {
    throw new Slip39Error('empty');
  }
  const password = passphraseBytes(passphrase);
  const shares = mnemonics.map(parseShare);
  const first = shares[0]!;
  for (const share of shares) {
    if (
      share.identifier !== first.identifier ||
      share.extendable !== first.extendable ||
      share.iterationExponent !== first.iterationExponent ||
      share.groupThreshold !== first.groupThreshold ||
      share.groupCount !== first.groupCount
    ) {
      throw new Slip39Error('set');
    }
    if (share.value.length !== first.value.length) {
      throw new Slip39Error('length');
    }
  }
  const groups = new Map<number, Slip39Share[]>();
  for (const share of shares) {
    const members = groups.get(share.groupIndex);
    if (members === undefined) {
      groups.set(share.groupIndex, [share]);
    } else if (members[0]!.memberThreshold !== share.memberThreshold) {
      throw new Slip39Error('members');
    } else if (
      !members.some(
        (member) =>
          member.memberIndex === share.memberIndex && sameBytes(member.value, share.value),
      )
    ) {
      members.push(share);
    }
  }
  if (groups.size !== first.groupThreshold) {
    throw new Slip39Error('groups');
  }
  for (const members of groups.values()) {
    if (members.length !== members[0]!.memberThreshold) {
      throw new Slip39Error('members');
    }
  }
  const groupSecrets: RawShare[] = [];
  for (const [groupIndex, members] of groups) {
    const points = members.map((member) => ({ x: member.memberIndex, data: member.value }));
    groupSecrets.push({
      x: groupIndex,
      data: await recoverSecret(members[0]!.memberThreshold, points),
    });
  }
  const encrypted = await recoverSecret(first.groupThreshold, groupSecrets);
  return feistel(
    encrypted,
    password,
    first.iterationExponent,
    first.identifier,
    first.extendable,
    DECRYPT_ROUNDS,
  );
}
