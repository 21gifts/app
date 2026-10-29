import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { entropyToMnemonic, mnemonicToEntropy } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english';
import { describe, expect, it } from 'vitest';
import {
  combineShares,
  isRecoveryShare,
  parseShare,
  Slip39Error,
  splitRecoverySecret,
  type Slip39ErrorCode,
  type Slip39Share,
} from '@/lib/slip39';
import { SLIP39_WORDLIST } from '@/lib/slip39-wordlist';

/**
 * The official SLIP-39 test vectors, copied unchanged from
 * https://raw.githubusercontent.com/trezor/python-shamir-mnemonic/da7a084b81524bf5049ddf1ce5f396e264bec8a6/vectors.json
 * (MIT licence). Each entry holds a description, the mnemonics, the master
 * secret as hex, and an xprv; an empty secret means combining must fail.
 * Every valid set uses the passphrase `TREZOR`.
 */
const VECTORS_FILE = readFileSync('src/__tests__/lib/slip39-vectors.json');
const VECTORS_SHA256 = '13ebecebdd869dd2bc2cdf69e7ce3a158cf106cac76c39d17682b1c6cdabbdc4';
const VECTORS = JSON.parse(VECTORS_FILE.toString('utf8')) as Array<
  [string, string[], string, string]
>;

/** The code each failing vector is refused with, by vector number. */
const VECTOR_ERRORS: Record<number, Slip39ErrorCode> = {
  2: 'checksum',
  3: 'padding',
  5: 'members',
  6: 'set',
  7: 'set',
  8: 'set',
  9: 'set',
  10: 'params',
  11: 'members',
  12: 'members',
  13: 'digest',
  14: 'groups',
  15: 'groups',
  16: 'members',
  21: 'checksum',
  22: 'padding',
  24: 'members',
  25: 'set',
  26: 'set',
  27: 'set',
  28: 'set',
  29: 'params',
  30: 'members',
  31: 'members',
  32: 'digest',
  33: 'groups',
  34: 'groups',
  35: 'members',
  39: 'length',
  40: 'length',
};

/** SHA-256 of the pinned word list file (`wordlist.txt`, one word per line). */
const WORDLIST_SHA256 = 'bcc4555340332d169718aed8bf31dd9d5248cb7da6e5d355140ef4f1e601eec3';

/** Public BIP-39 test phrase; its entropy is sixteen 0x7f bytes. */
const PHRASE = 'legal winner thank year wave sausage worth useful legal winner thank yellow';
const SECRET = new Uint8Array(16).fill(0x7f);

/**
 * Hex of bytes.
 *
 * @param bytes - Any bytes.
 * @returns Lower-case hex.
 */
function hex(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('hex');
}

/**
 * A deterministic random source: byte `n` of the stream is `(37n + 11) mod 256`.
 *
 * @returns A source for `splitRecoverySecret`.
 */
function fixedRandom(): (length: number) => Uint8Array<ArrayBuffer> {
  let next = 0;
  return (length) => {
    const bytes = new Uint8Array(length);
    for (let index = 0; index < length; index += 1) {
      bytes[index] = (next * 37 + 11) & 0xff;
      next += 1;
    }
    return bytes;
  };
}

/**
 * A random source that answers the given byte arrays in turn.
 *
 * @param answers - One array per call.
 * @returns A source for `splitRecoverySecret`.
 */
function answers(...answers: number[][]): (length: number) => Uint8Array<ArrayBuffer> {
  return (length) => {
    const next = answers.shift() ?? [];
    expect(next).toHaveLength(length);
    return Uint8Array.from(next);
  };
}

/**
 * RS1024 checksum remainder, written apart from the module (reference
 * `rs1024.py`).
 *
 * @param values - Customization codes and word indices.
 * @returns The remainder.
 */
function referencePolymod(values: number[]): number {
  const generator = [
    0xe0e040, 0x1c1c080, 0x3838100, 0x7070200, 0xe0e0009, 0x1c0c2412, 0x38086c24, 0x3090fc48,
    0x21b1f890, 0x3f3f120,
  ];
  let checksum = 1;
  for (const value of values) {
    const top = checksum >> 20;
    checksum = ((checksum & 0xfffff) << 10) ^ value;
    generator.forEach((gen, bit) => {
      if ((top >> bit) & 1) {
        checksum ^= gen;
      }
    });
  }
  return checksum;
}

/**
 * Writes any share as words, written apart from the module with big integers
 * (reference `share.py` `words`), to check that parsing loses nothing.
 *
 * @param share - Share fields.
 * @returns The words, separated by single spaces.
 */
function referenceEncode(share: Slip39Share): string {
  const idExp =
    (share.identifier << 5) | ((share.extendable ? 1 : 0) << 4) | share.iterationExponent;
  const params =
    (share.groupIndex << 16) |
    ((share.groupThreshold - 1) << 12) |
    ((share.groupCount - 1) << 8) |
    (share.memberIndex << 4) |
    (share.memberThreshold - 1);
  const valueWordCount = Math.ceil((share.value.length * 8) / 10);
  const value = BigInt(`0x${hex(share.value) || '0'}`);
  const valueWords = Array.from({ length: valueWordCount }, (_, index) =>
    Number((value >> BigInt(10 * (valueWordCount - 1 - index))) & 1023n),
  );
  const data = [idExp >> 10, idExp & 1023, params >> 10, params & 1023, ...valueWords];
  const custom = Array.from(share.extendable ? 'shamir_extendable' : 'shamir', (c) =>
    c.charCodeAt(0),
  );
  const checksum = referencePolymod([...custom, ...data, 0, 0, 0]) ^ 1;
  data.push((checksum >> 20) & 1023, (checksum >> 10) & 1023, checksum & 1023);
  return data.map((index) => SLIP39_WORDLIST[index]).join(' ');
}

/**
 * The code a rejection carries.
 *
 * @param work - Work that must reject with a {@link Slip39Error}.
 * @returns The error's code.
 */
async function codeOf(work: () => unknown): Promise<Slip39ErrorCode> {
  try {
    await work();
  } catch (error) {
    expect(error).toBeInstanceOf(Slip39Error);
    return (error as Slip39Error).code;
  }
  throw new Error('expected a Slip39Error');
}

describe('official vectors', () => {
  it('reads the pinned, unchanged fixture of 45 vectors', () => {
    expect(createHash('sha256').update(VECTORS_FILE).digest('hex')).toBe(VECTORS_SHA256);
    expect(VECTORS).toHaveLength(45);
    expect(VECTORS.filter(([, , secret]) => secret !== '')).toHaveLength(15);
  });

  it.each(VECTORS)('%s', async (description, mnemonics, secret) => {
    if (secret !== '') {
      expect(hex(await combineShares(mnemonics, 'TREZOR'))).toBe(secret);
      return;
    }
    const number = Number(description.split('.')[0]);
    expect(await codeOf(() => combineShares(mnemonics, 'TREZOR'))).toBe(VECTOR_ERRORS[number]);
  });

  it('parses every share it accepts losslessly: the words re-encode bit for bit', () => {
    let parsed = 0;
    for (const [, mnemonics] of VECTORS) {
      for (const mnemonic of mnemonics) {
        let share: Slip39Share;
        try {
          share = parseShare(mnemonic);
        } catch {
          continue;
        }
        parsed += 1;
        expect(referenceEncode(share)).toBe(mnemonic);
      }
    }
    expect(parsed).toBe(77);
  });
});

describe('word list', () => {
  it('is the pinned list: 1024 sorted, unique words of 4 to 8 letters with unique prefixes', () => {
    expect(SLIP39_WORDLIST).toHaveLength(1024);
    expect(SLIP39_WORDLIST[0]).toBe('academic');
    expect(SLIP39_WORDLIST[1023]).toBe('zero');
    expect([...SLIP39_WORDLIST].sort()).toEqual(SLIP39_WORDLIST);
    expect(new Set(SLIP39_WORDLIST).size).toBe(1024);
    expect(new Set(SLIP39_WORDLIST.map((word) => word.slice(0, 4))).size).toBe(1024);
    expect(SLIP39_WORDLIST.every((word) => /^[a-z]{4,8}$/.test(word))).toBe(true);
    expect(
      createHash('sha256')
        .update(`${SLIP39_WORDLIST.join('\n')}\n`)
        .digest('hex'),
    ).toBe(WORDLIST_SHA256);
  });
});

describe('Slip39Error', () => {
  it('carries its code and a fixed message without words', () => {
    const error = new Slip39Error('digest');
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('Slip39Error');
    expect(error.code).toBe('digest');
    expect(error.message).toBe('slip39_digest');
  });
});

describe('parseShare', () => {
  it('reads every field of a share', () => {
    const share = parseShare(VECTORS[42]![1][0]!);
    expect({ ...share, value: hex(share.value) }).toEqual({
      identifier: 9066,
      extendable: true,
      iterationExponent: 0,
      groupIndex: 0,
      groupThreshold: 1,
      groupCount: 1,
      memberIndex: 0,
      memberThreshold: 2,
      value: 'a5a69aa82af0f8068a01d8e8c095ddf3',
    });
  });

  it('takes any letter case and runs of whitespace', () => {
    const words = VECTORS[42]![1][0]!;
    const loose = `  ${words.toUpperCase().split(' ').join(' \n\t')}  `;
    expect(parseShare(loose)).toEqual(parseShare(words));
  });

  it('refuses a word that is not in the list, also a name of Object.prototype', async () => {
    const words = VECTORS[42]![1][0]!.split(' ');
    expect(await codeOf(() => parseShare([...words.slice(0, 19), 'bitcoin'].join(' ')))).toBe(
      'word',
    );
    expect(await codeOf(() => parseShare([...words.slice(0, 19), 'constructor'].join(' ')))).toBe(
      'word',
    );
  });

  it('refuses no words and too few words', async () => {
    expect(await codeOf(() => parseShare(''))).toBe('length');
    expect(await codeOf(() => parseShare('   '))).toBe('length');
    const words = VECTORS[42]![1][0]!.split(' ');
    expect(await codeOf(() => parseShare(words.slice(0, 19).join(' ')))).toBe('length');
  });
});

describe('isRecoveryShare', () => {
  const base = parseShare(VECTORS[42]![1][0]!);

  it('accepts one group of threshold 1, member threshold 2, 16 bytes, member 0 to 2', () => {
    expect(isRecoveryShare(base)).toBe(true);
    expect(isRecoveryShare({ ...base, memberIndex: 2 })).toBe(true);
  });

  it('refuses every other shape', () => {
    expect(isRecoveryShare({ ...base, groupThreshold: 2 })).toBe(false);
    expect(isRecoveryShare({ ...base, groupCount: 2 })).toBe(false);
    expect(isRecoveryShare({ ...base, memberThreshold: 3 })).toBe(false);
    expect(isRecoveryShare({ ...base, value: new Uint8Array(32) })).toBe(false);
    expect(isRecoveryShare({ ...base, memberIndex: 3 })).toBe(false);
  });
});

describe('splitRecoverySecret', () => {
  it('makes three 20-word shares of one recovery set', async () => {
    const { identifier, shares } = await splitRecoverySecret(SECRET);
    expect(shares).toHaveLength(3);
    shares.forEach((share, memberIndex) => {
      const words = share.split(' ');
      expect(words).toHaveLength(20);
      expect(words[2]).toBe('academic');
      expect(words[3]).toBe(['acid', 'agency', 'always'][memberIndex]);
      const parsed = parseShare(share);
      expect(parsed).toMatchObject({
        identifier,
        extendable: true,
        iterationExponent: 1,
        groupIndex: 0,
        groupThreshold: 1,
        groupCount: 1,
        memberIndex,
        memberThreshold: 2,
      });
      expect(isRecoveryShare(parsed)).toBe(true);
      expect(referenceEncode(parsed)).toBe(share);
    });
    expect(identifier).toBeGreaterThanOrEqual(0);
    expect(identifier).toBeLessThan(2 ** 15);
  });

  it('splits deterministically with an injected random source', async () => {
    await expect(splitRecoverySecret(SECRET, fixedRandom())).resolves.toEqual({
      identifier: 2864,
      shares: [
        'body lily academic acid acne violence volume package glen escape prospect wealthy gesture venture legal already activity raspy camera easel',
        'body lily academic agency domain sugar learn owner kitchen exhaust aircraft sled fused dragon froth argue traveler reunion library geology',
        'body lily academic always demand practice cage cultural frequent elegant style metric frozen jacket fawn advance fitness coding elephant frozen',
      ],
    });
  });

  it('refuses a secret that is not 16 bytes', async () => {
    expect(await codeOf(() => splitRecoverySecret(new Uint8Array(15)))).toBe('length');
    expect(await codeOf(() => splitRecoverySecret(new Uint8Array(32)))).toBe('length');
  });
});

describe('combineShares', () => {
  it('rebuilds the secret from every pair, and BIP-39 gives the 12 words back', async () => {
    const entropy = mnemonicToEntropy(PHRASE, wordlist);
    const { shares } = await splitRecoverySecret(entropy);
    for (const [a, b] of [
      [0, 1],
      [0, 2],
      [1, 2],
      [2, 0],
    ] as const) {
      const secret = await combineShares([shares[a], shares[b]]);
      expect(hex(secret)).toBe(hex(entropy));
      expect(entropyToMnemonic(secret, wordlist)).toBe(PHRASE);
    }
  });

  it('refuses one share, and the same share twice, as too few members', async () => {
    const { shares } = await splitRecoverySecret(SECRET);
    expect(await codeOf(() => combineShares([shares[0]]))).toBe('members');
    expect(await codeOf(() => combineShares([shares[1], shares[1]]))).toBe('members');
  });

  it('refuses shares of two sets, and of two sets with the same identifier', async () => {
    const one = await splitRecoverySecret(SECRET, answers([0, 1], new Array(12).fill(1)));
    const two = await splitRecoverySecret(SECRET, answers([0, 2], new Array(12).fill(2)));
    const twin = await splitRecoverySecret(SECRET, answers([0, 1], new Array(12).fill(3)));
    expect(await codeOf(() => combineShares([one.shares[0], two.shares[1]]))).toBe('set');
    expect(await codeOf(() => combineShares([one.shares[0], twin.shares[1]]))).toBe('digest');
  });

  it('refuses no shares and a passphrase that is not printable ASCII', async () => {
    const { shares } = await splitRecoverySecret(SECRET);
    expect(await codeOf(() => combineShares([]))).toBe('empty');
    expect(await codeOf(() => combineShares([shares[0], shares[1]], 'ü'))).toBe('passphrase');
    expect(await codeOf(() => combineShares([shares[0], shares[1]], 'a\nb'))).toBe('passphrase');
  });

  it('refuses shares of one set whose values differ in length', async () => {
    const short = parseShare(VECTORS[42]![1][0]!);
    const long = referenceEncode({ ...short, memberIndex: 1, value: new Uint8Array(32).fill(9) });
    expect(await codeOf(() => combineShares([referenceEncode(short), long]))).toBe('length');
  });
});
