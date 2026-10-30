import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { heldShareBoxKey, openHeldShare, sealHeldShare } from '@/lib/held-share-box';
import { keepHeldShare, loadHeldShares, relockHeldShares, type HeldShare } from '@/lib/held-shares';

const api = vi.hoisted(() => ({
  fetchHeldShareBoxes: vi.fn(),
  putHeldShareBox: vi.fn(),
}));

vi.mock('@/lib/api', () => api);

/** The holder's current words (16 zero bytes). */
const WORDS =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

/** The holder's previous words. */
const OLD_WORDS = 'legal winner thank year wave sausage worth useful legal winner thank yellow';

const HOLDER = 'acc_hal';

/** Two shares of one recovery set (identifier 2864). */
const SHARES = [
  'body lily academic acid acne violence volume package glen escape prospect wealthy gesture venture legal already activity raspy camera easel',
  'body lily academic agency domain sugar learn owner kitchen exhaust aircraft sled fused dragon froth argue traveler reunion library geology',
] as const;

/** A share of another recovery set (identifier 7506). */
const OTHER_SET =
  'domain morning academic acid disease humidity peasant cleanup trend describe romp terminal should knit often alarm visitor tension universe peanut';

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
 * One box as the api lists it.
 *
 * @param words - Words whose key seals it.
 * @param id - Box id.
 * @param text - Plaintext.
 * @returns The box.
 */
async function box(
  words: string,
  id: string,
  text: string,
): Promise<{ id: string; ciphertext: string; updatedAt: string }> {
  const key = await heldShareBoxKey(words);
  return {
    id,
    ciphertext: await sealHeldShare(key, HOLDER, id, text),
    updatedAt: '2026-10-30T12:00:00.000Z',
  };
}

beforeEach(() => {
  api.fetchHeldShareBoxes.mockReset();
  api.putHeldShareBox.mockReset().mockResolvedValue(undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('loadHeldShares', () => {
  it('lists the boxes that open by owner username and counts the rest as locked', async () => {
    api.fetchHeldShareBoxes.mockResolvedValue([
      await box(WORDS, 'a'.repeat(32), code(OTHER_SET, 'acc_cara', 'cara')),
      await box(OLD_WORDS, 'b'.repeat(32), code(SHARES[1])),
      await box(WORDS, 'c'.repeat(32), code(SHARES[0])),
      await box(WORDS, 'd'.repeat(32), 'not a share code'),
    ]);
    const held = await loadHeldShares('sess', HOLDER, await heldShareBoxKey(WORDS));
    expect(api.fetchHeldShareBoxes).toHaveBeenCalledWith('sess');
    expect(held.shares).toEqual([
      {
        boxId: 'c'.repeat(32),
        code: code(SHARES[0]),
        ownerAccountId: 'acc_bob',
        ownerUsername: 'bob',
        identifier: 2864,
        memberIndex: 0,
      },
      expect.objectContaining({ boxId: 'a'.repeat(32), ownerUsername: 'cara', identifier: 7506 }),
    ]);
    expect(held.lockedIds).toEqual(['b'.repeat(32), 'd'.repeat(32)]);
  });

  it('throws when the boxes cannot be read', async () => {
    api.fetchHeldShareBoxes.mockRejectedValue(new Error('Held shares are unavailable'));
    await expect(loadHeldShares('sess', HOLDER, await heldShareBoxKey(WORDS))).rejects.toThrow(
      'Held shares are unavailable',
    );
  });
});

describe('keepHeldShare', () => {
  const kept: HeldShare[] = [
    {
      boxId: 'a'.repeat(32),
      code: code(SHARES[0]),
      ownerAccountId: 'acc_bob',
      ownerUsername: 'bob',
      identifier: 2864,
      memberIndex: 0,
    },
  ];

  it('refuses text that is not a share, a share of the own account, and a second share of a set', async () => {
    const key = await heldShareBoxKey(WORDS);
    expect(await keepHeldShare('sess', HOLDER, key, [], 'hello')).toEqual({
      ok: false,
      reason: 'invalid',
    });
    expect(await keepHeldShare('sess', HOLDER, key, [], code(SHARES[0], HOLDER, 'hal'))).toEqual({
      ok: false,
      reason: 'own',
    });
    expect(await keepHeldShare('sess', HOLDER, key, kept, code(SHARES[1]))).toEqual({
      ok: false,
      reason: 'duplicate',
    });
    expect(api.putHeldShareBox).not.toHaveBeenCalled();
  });

  it('seals the trimmed share in a new box and puts it under a random id', async () => {
    const key = await heldShareBoxKey(WORDS);
    const result = await keepHeldShare(
      'sess',
      HOLDER,
      key,
      kept,
      `  ${code(OTHER_SET, 'acc_bob', 'bob')}\n`,
    );
    expect(result).toEqual({
      ok: true,
      share: {
        boxId: expect.stringMatching(/^[0-9a-f]{32}$/),
        code: code(OTHER_SET),
        ownerAccountId: 'acc_bob',
        ownerUsername: 'bob',
        identifier: 7506,
        memberIndex: 0,
      },
    });
    expect(result.ok && result.share.boxId).not.toBe(kept[0]?.boxId);
    const [session, id, ciphertext] = api.putHeldShareBox.mock.calls[0] as [string, string, string];
    expect(session).toBe('sess');
    expect(result.ok && id === result.share.boxId).toBe(true);
    expect(await openHeldShare(key, HOLDER, id, ciphertext)).toBe(code(OTHER_SET));
  });

  it('keeps a share of another owner whose set has the same identifier', async () => {
    const key = await heldShareBoxKey(WORDS);
    const result = await keepHeldShare(
      'sess',
      HOLDER,
      key,
      kept,
      code(SHARES[1], 'acc_cara', 'cara'),
    );
    expect(result).toMatchObject({
      ok: true,
      share: { ownerAccountId: 'acc_cara', identifier: 2864 },
    });
    expect(api.putHeldShareBox).toHaveBeenCalledTimes(1);
  });

  it('answers save when the api does not store the box', async () => {
    api.putHeldShareBox.mockRejectedValue(new Error('Could not keep the share'));
    const key = await heldShareBoxKey(WORDS);
    expect(await keepHeldShare('sess', HOLDER, key, [], code(SHARES[0]))).toEqual({
      ok: false,
      reason: 'save',
    });
  });
});

describe('relockHeldShares', () => {
  it('seals every box of the old words again with the new words under the same id', async () => {
    const boxes = [
      await box(OLD_WORDS, 'a'.repeat(32), code(SHARES[0])),
      await box(WORDS, 'b'.repeat(32), code(OTHER_SET, 'acc_cara', 'cara')),
      await box(OLD_WORDS, 'c'.repeat(32), code(OTHER_SET)),
    ];
    api.fetchHeldShareBoxes.mockResolvedValue(boxes);
    api.putHeldShareBox.mockRejectedValueOnce(new Error('Could not keep the share'));
    expect(await relockHeldShares('sess', HOLDER, OLD_WORDS, WORDS)).toBe(1);
    expect(api.putHeldShareBox.mock.calls.map((call) => call[1])).toEqual([
      'a'.repeat(32),
      'c'.repeat(32),
    ]);
    const [, id, ciphertext] = api.putHeldShareBox.mock.calls[1] as [string, string, string];
    expect(await openHeldShare(await heldShareBoxKey(WORDS), HOLDER, id, ciphertext)).toBe(
      code(OTHER_SET),
    );
  });

  it('derives no key and moves nothing without boxes, without current words, for the same words, or for words that are not a phrase', async () => {
    api.fetchHeldShareBoxes.mockResolvedValue([]);
    const keySpy = vi.spyOn(crypto.subtle, 'deriveKey');
    expect(await relockHeldShares('sess', HOLDER, OLD_WORDS, WORDS)).toBe(0);
    expect(keySpy).not.toHaveBeenCalled();
    api.fetchHeldShareBoxes.mockResolvedValue([
      await box(OLD_WORDS, 'a'.repeat(32), code(SHARES[0])),
    ]);
    keySpy.mockClear();
    expect(await relockHeldShares('sess', HOLDER, OLD_WORDS, null)).toBe(0);
    expect(await relockHeldShares('sess', HOLDER, ` ${WORDS} `, WORDS)).toBe(0);
    expect(await relockHeldShares('sess', HOLDER, WORDS.toUpperCase(), WORDS)).toBe(0);
    expect(keySpy).not.toHaveBeenCalled();
    expect(api.fetchHeldShareBoxes).toHaveBeenCalledTimes(4);
    expect(await relockHeldShares('sess', HOLDER, 'not a phrase', WORDS)).toBe(0);
    expect(api.putHeldShareBox).not.toHaveBeenCalled();
  });

  it('moves nothing when the boxes cannot be read', async () => {
    api.fetchHeldShareBoxes.mockRejectedValue(new Error('Held shares are unavailable'));
    expect(await relockHeldShares('sess', HOLDER, OLD_WORDS, WORDS)).toBe(0);
    expect(api.putHeldShareBox).not.toHaveBeenCalled();
  });
});
