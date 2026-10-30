import { mnemonicToEntropy } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english';
import { describe, expect, it, vi } from 'vitest';
import {
  heldShareBoxKey,
  newHeldShareBoxId,
  openHeldShare,
  sealHeldShare,
} from '@/lib/held-share-box';
import { base64UrlToBytes, bytesToBase64Url } from '@/lib/webauthn-browser';

/** Public BIP-39 test phrase of 16 zero bytes. */
const WORDS =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

/** Another valid phrase. */
const OTHER_WORDS = 'legal winner thank year wave sausage worth useful legal winner thank yellow';

const CODE =
  '21gifts-share:v1:acc_bob:bob:body lily academic acid acne violence volume package glen escape prospect wealthy gesture venture legal already activity raspy camera easel';

const BOX_ID = '0123456789abcdef0123456789abcdef';

describe('heldShareBoxKey', () => {
  it('derives a non-extractable AES-256-GCM key by HKDF-SHA256 from the 16 bytes of the words', async () => {
    const key = await heldShareBoxKey(` ${WORDS} `);
    expect(key.extractable).toBe(false);
    expect(key.algorithm).toMatchObject({ name: 'AES-GCM', length: 256 });
    expect(key.usages.sort()).toEqual(['decrypt', 'encrypt']);
    // The same derivation by hand opens what the key sealed.
    const material = await crypto.subtle.importKey(
      'raw',
      Uint8Array.from(mnemonicToEntropy(WORDS, wordlist)),
      'HKDF',
      false,
      ['deriveBits'],
    );
    const bits = await crypto.subtle.deriveBits(
      {
        name: 'HKDF',
        hash: 'SHA-256',
        salt: new TextEncoder().encode('21gifts-held-share-box'),
        info: new TextEncoder().encode('box-key-v1'),
      },
      material,
      256,
    );
    const manual = await crypto.subtle.importKey('raw', bits, 'AES-GCM', false, ['decrypt']);
    const box = base64UrlToBytes(await sealHeldShare(key, 'acc_hal', BOX_ID, CODE));
    const plain = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: box.slice(1, 13),
        additionalData: new TextEncoder().encode(`21gifts-held-share-v1\nacc_hal\n${BOX_ID}`),
      },
      manual,
      box.slice(13),
    );
    expect(new TextDecoder().decode(plain)).toBe(CODE);
  });

  it('throws for words that are not a phrase', async () => {
    await expect(heldShareBoxKey('not a phrase')).rejects.toThrow();
  });
});

describe('newHeldShareBoxId', () => {
  it('is 32 lower-case hex digits from 16 random bytes', () => {
    const spy = vi
      .spyOn(crypto, 'getRandomValues')
      .mockImplementationOnce(<T extends ArrayBufferView | null>(array: T): T => {
        (array as unknown as Uint8Array).set(Uint8Array.from({ length: 16 }, (_, i) => i * 17));
        return array;
      });
    expect(newHeldShareBoxId()).toBe('00112233445566778899aabbccddeeff');
    spy.mockRestore();
    expect(newHeldShareBoxId()).toMatch(/^[0-9a-f]{32}$/);
  });
});

describe('sealHeldShare and openHeldShare', () => {
  it('seals a version 1 box with a fresh IV that opens again', async () => {
    const key = await heldShareBoxKey(WORDS);
    const first = await sealHeldShare(key, 'acc_hal', BOX_ID, CODE);
    const second = await sealHeldShare(key, 'acc_hal', BOX_ID, CODE);
    expect(first).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(first).not.toBe(second);
    const bytes = base64UrlToBytes(first);
    expect(bytes[0]).toBe(1);
    expect(bytes.length).toBe(1 + 12 + new TextEncoder().encode(CODE).length + 16);
    expect(await openHeldShare(key, 'acc_hal', BOX_ID, first)).toBe(CODE);
  });

  it('does not open with other words, another holder, another id, another version, or changed bytes', async () => {
    const key = await heldShareBoxKey(WORDS);
    const box = await sealHeldShare(key, 'acc_hal', BOX_ID, CODE);
    expect(await openHeldShare(await heldShareBoxKey(OTHER_WORDS), 'acc_hal', BOX_ID, box)).toBe(
      null,
    );
    expect(await openHeldShare(key, 'acc_other', BOX_ID, box)).toBeNull();
    expect(await openHeldShare(key, 'acc_hal', 'f'.repeat(32), box)).toBeNull();
    const bytes = base64UrlToBytes(box);
    bytes[0] = 2;
    expect(await openHeldShare(key, 'acc_hal', BOX_ID, bytesToBase64Url(bytes))).toBeNull();
    bytes[0] = 1;
    bytes[20] = (bytes[20] ?? 0) ^ 1;
    expect(await openHeldShare(key, 'acc_hal', BOX_ID, bytesToBase64Url(bytes))).toBeNull();
    expect(await openHeldShare(key, 'acc_hal', BOX_ID, '%%%')).toBeNull();
  });
});
