import { describe, expect, it, vi } from 'vitest';
import {
  encodeShareCode,
  parseShareCode,
  phraseFromShareCodes,
  SHARE_CODE_PREFIX,
  splitPhrase,
  type ShareCode,
} from '@/lib/recovery-share-code';
import { combineShares, parseShare, Slip39Error, type Slip39ErrorCode } from '@/lib/slip39';

vi.mock('@/lib/slip39', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/slip39')>();
  return { ...actual, combineShares: vi.fn(actual.combineShares) };
});

/** Public BIP-39 test phrase; its entropy is sixteen 0x7f bytes. */
const PHRASE = 'legal winner thank year wave sausage worth useful legal winner thank yellow';

/** Public BIP-39 test phrase of 24 words (32 bytes of 0x7f). */
const LONG_PHRASE =
  'legal winner thank year wave sausage worth useful legal winner thank year wave sausage worth useful legal winner thank year wave sausage worth title';

/** The recovery set of {@link PHRASE} that a fixed random source gives (identifier 2864). */
const SHARES = [
  'body lily academic acid acne violence volume package glen escape prospect wealthy gesture venture legal already activity raspy camera easel',
  'body lily academic agency domain sugar learn owner kitchen exhaust aircraft sled fused dragon froth argue traveler reunion library geology',
  'body lily academic always demand practice cage cultural frequent elegant style metric frozen jacket fawn advance fitness coding elephant frozen',
] as const;

/** A 2-of-3 share of a 32-byte secret (official SLIP-39 vector 23). */
const LONG_SHARES = [
  'humidity disease academic always aluminum jewelry energy woman receiver strategy amuse duckling lying evidence network walnut tactics forget hairy rebound impulse brother survive clothes stadium mailman rival ocean reward venture always armed unwrap',
  'humidity disease academic agency actress jacket gross physics cylinder solution fake mortgage benefit public busy prepare sharp friar change work slow purchase ruler again tricycle involve viral wireless mixture anatomy desert cargo upgrade',
] as const;

/** A share without sharing (official SLIP-39 vector 1): member threshold 1. */
const SINGLE_SHARE =
  'duckling enlarge academic academic agency result length solution fridge kidney coal piece deal husband erode duke ajar critical decision keyboard';

/**
 * The payload of one share of {@link SHARES}.
 *
 * @param index - Share 0, 1, or 2.
 * @param owner - Owner account id.
 * @returns The payload text.
 */
function code(index: 0 | 1 | 2, owner = 'acc_owner-1'): string {
  return `${SHARE_CODE_PREFIX}${owner}:ada.b:${SHARES[index]}`;
}

/**
 * The read payload of one share of {@link SHARES}.
 *
 * @param index - Share 0, 1, or 2.
 * @param owner - Owner account id.
 * @returns The payload fields.
 */
function read(index: 0 | 1 | 2, owner = 'acc_owner-1'): ShareCode {
  const parsed = parseShareCode(code(index, owner));
  if (parsed === null) {
    throw new Error('expected a share code');
  }
  return parsed;
}

/**
 * A payload object built by hand from any share's words.
 *
 * @param share - Share words.
 * @returns Fields as `parseShareCode` would give them.
 */
function byHand(share: string): ShareCode {
  const parsed = parseShare(share);
  return {
    ownerAccountId: 'acc_owner-1',
    ownerUsername: 'ada.b',
    share,
    identifier: parsed.identifier,
    memberIndex: parsed.memberIndex,
  };
}

/**
 * The code a rejection carries.
 *
 * @param work - Work that must reject with a {@link Slip39Error}.
 * @returns The error's code.
 */
async function codeOf(work: () => Promise<unknown>): Promise<Slip39ErrorCode> {
  const error: unknown = await work().then(
    () => null,
    (rejection: unknown) => rejection,
  );
  expect(error).toBeInstanceOf(Slip39Error);
  return (error as Slip39Error).code;
}

describe('encodeShareCode and parseShareCode', () => {
  it('round-trip a share with its owner, set identifier, and member index', () => {
    const text = encodeShareCode('acc_owner-1', 'ada.b', SHARES[2]);
    expect(text).toBe(`21gifts-share:v1:acc_owner-1:ada.b:${SHARES[2]}`);
    expect(parseShareCode(text)).toEqual({
      ownerAccountId: 'acc_owner-1',
      ownerUsername: 'ada.b',
      share: SHARES[2],
      identifier: 2864,
      memberIndex: 2,
    });
    expect(parseShareCode(`\n  ${text}  \n`)).toEqual(parseShareCode(text));
  });

  it('never builds a payload that would not read back', () => {
    expect(() => encodeShareCode('acc:1', 'ada', SHARES[0])).toThrow('Invalid share code');
    expect(() => encodeShareCode('acc_1', 'Ada', SHARES[0])).toThrow('Invalid share code');
    expect(() => encodeShareCode('acc_1', 'ada', SINGLE_SHARE)).toThrow('Invalid share code');
  });

  it('reads nothing but the payload format', () => {
    const words = SHARES[0].split(' ');
    for (const text of [
      '',
      SHARES[0],
      `21gifts-shares:v1:acc_1:ada:${SHARES[0]}`,
      `21gifts-share:v2:acc_1:ada:${SHARES[0]}`,
      `21gifts-share:v1::ada:${SHARES[0]}`,
      `21gifts-share:v1:${'a'.repeat(65)}:ada:${SHARES[0]}`,
      `21gifts-share:v1:acc_1:.ada:${SHARES[0]}`,
      `21gifts-share:v1:acc_1:${'a'.repeat(33)}:${SHARES[0]}`,
      `21gifts-share:v1:acc_1:ada:${words.slice(0, 19).join(' ')}`,
      `21gifts-share:v1:acc_1:ada:${[...words, 'acid'].join(' ')}`,
      `21gifts-share:v1:acc_1:ada:${SHARES[0].toUpperCase()}`,
      `21gifts-share:v1:acc_1:ada:${words.join('  ')}`,
      `${code(0)} ${'x'.repeat(400)}`,
    ]) {
      expect(parseShareCode(text)).toBeNull();
    }
  });

  it('reads no unknown word, wrong checksum, or share of another shape', () => {
    const words = SHARES[0].split(' ');
    const unknown = [...words.slice(0, 19), 'bitcoin'].join(' ');
    const checksum = [...words.slice(0, 19), words[18]].join(' ');
    expect(parseShareCode(`21gifts-share:v1:acc_1:ada:${unknown}`)).toBeNull();
    expect(parseShareCode(`21gifts-share:v1:acc_1:ada:${checksum}`)).toBeNull();
    expect(parseShareCode(`21gifts-share:v1:acc_1:ada:${SINGLE_SHARE}`)).toBeNull();
  });
});

describe('splitPhrase', () => {
  it('splits the 12 words into one recovery set whose pairs give the words back', async () => {
    const { identifier, shares } = await splitPhrase(PHRASE);
    const codes = shares.map((share, memberIndex) => {
      const parsed = parseShareCode(encodeShareCode('acc_owner-1', 'ada.b', share));
      expect(parsed).toMatchObject({ identifier, memberIndex });
      return parsed as ShareCode;
    });
    await expect(phraseFromShareCodes(codes[0]!, codes[1]!)).resolves.toBe(PHRASE);
    await expect(phraseFromShareCodes(codes[2]!, codes[0]!)).resolves.toBe(PHRASE);
    await expect(phraseFromShareCodes(codes[1]!, codes[2]!)).resolves.toBe(PHRASE);
  });

  it('splits with a given random source', async () => {
    let next = 0;
    const fixed = (length: number): Uint8Array<ArrayBuffer> =>
      Uint8Array.from({ length }, () => {
        const byte = (next * 37 + 11) & 0xff;
        next += 1;
        return byte;
      });
    await expect(splitPhrase(PHRASE, fixed)).resolves.toEqual({
      identifier: 2864,
      shares: SHARES,
    });
  });

  it('refuses the split when a pair does not give the same bytes back', async () => {
    vi.mocked(combineShares).mockResolvedValueOnce(new Uint8Array(16));
    await expect(splitPhrase(PHRASE)).rejects.toThrow('Recovery split check failed');
  });

  it('refuses words that are not a 12-word phrase', async () => {
    await expect(splitPhrase('legal winner thank')).rejects.toThrow();
    expect(await codeOf(() => splitPhrase(LONG_PHRASE))).toBe('length');
  });
});

describe('phraseFromShareCodes', () => {
  it('rebuilds the exact 12 words from any two shares', async () => {
    await expect(phraseFromShareCodes(read(0), read(1))).resolves.toBe(PHRASE);
    await expect(phraseFromShareCodes(read(1), read(2))).resolves.toBe(PHRASE);
    await expect(phraseFromShareCodes(read(2), read(0))).resolves.toBe(PHRASE);
  });

  it('refuses shares of another owner or set, and one share twice', async () => {
    expect(await codeOf(() => phraseFromShareCodes(read(0), read(1, 'acc_other')))).toBe('set');
    expect(await codeOf(() => phraseFromShareCodes(read(0), { ...read(1), identifier: 1 }))).toBe(
      'set',
    );
    expect(await codeOf(() => phraseFromShareCodes(read(1), read(1)))).toBe('members');
  });

  it('refuses shares that do not give 16 bytes', async () => {
    expect(
      await codeOf(() => phraseFromShareCodes(byHand(LONG_SHARES[0]), byHand(LONG_SHARES[1]))),
    ).toBe('length');
  });
});
