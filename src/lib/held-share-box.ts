/**
 * The box a holder keeps another member's share in on the api
 * (`/me/held-shares`). The holder's browser encrypts the share code with a key
 * derived from the holder's own 12 words, so the api stores only bytes it
 * cannot read: the owner's id and name exist only inside the ciphertext. A
 * box is `0x01` (version) ‖ 12-byte random IV ‖ AES-256-GCM ciphertext and
 * tag, sent as base64url without padding. The additional data binds a box to
 * the holder's account and its box id. WebCrypto only.
 */
import { mnemonicToEntropy } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english';
import { base64UrlToBytes, bytesToBase64Url } from '@/lib/webauthn-browser';

/** First byte of every box: the format version. */
const BOX_VERSION = 0x01;

/** Bytes of the AES-GCM IV of a box. */
const IV_LENGTH = 12;

/** UTF-8 HKDF salt of the box key. */
const KEY_SALT = '21gifts-held-share-box';

/** UTF-8 HKDF info of the box key. */
const KEY_INFO = 'box-key-v1';

/** Start of the additional data of every box. */
const AD_PREFIX = '21gifts-held-share-v1';

/** UTF-8 encoder for salt, info, additional data, and the share code. */
const encoder = new TextEncoder();

/**
 * The box key of a holder: HKDF-SHA256 over the 16 bytes behind the holder's
 * 12 words, as a non-extractable AES-256-GCM key.
 *
 * @param words - The holder's 12 words.
 * @returns The key, which can encrypt and decrypt boxes only.
 * @throws Error from `mnemonicToEntropy` for words that are not a valid phrase.
 */
export async function heldShareBoxKey(words: string): Promise<CryptoKey> {
  const entropy = Uint8Array.from(mnemonicToEntropy(words.trim(), wordlist));
  const material = await crypto.subtle.importKey('raw', entropy, 'HKDF', false, ['deriveKey']);
  entropy.fill(0);
  return crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: encoder.encode(KEY_SALT),
      info: encoder.encode(KEY_INFO),
    },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

/**
 * A new box id: 16 random bytes as 32 lower-case hex digits.
 *
 * @returns The id.
 */
export function newHeldShareBoxId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * The additional data of one box.
 *
 * @param holderAccountId - Account that keeps the box.
 * @param boxId - The box id.
 * @returns The UTF-8 bytes.
 */
function additionalData(holderAccountId: string, boxId: string): Uint8Array<ArrayBuffer> {
  return encoder.encode(`${AD_PREFIX}\n${holderAccountId}\n${boxId}`);
}

/**
 * Encrypts a share code into a box.
 *
 * @param key - The holder's box key ({@link heldShareBoxKey}).
 * @param holderAccountId - Account that keeps the box.
 * @param boxId - The box id it is stored under.
 * @param code - The share code.
 * @returns The box, base64url without padding.
 */
export async function sealHeldShare(
  key: CryptoKey,
  holderAccountId: string,
  boxId: string,
  code: string,
): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const sealed = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv, additionalData: additionalData(holderAccountId, boxId) },
      key,
      encoder.encode(code),
    ),
  );
  const box = new Uint8Array(1 + IV_LENGTH + sealed.length);
  box[0] = BOX_VERSION;
  box.set(iv, 1);
  box.set(sealed, 1 + IV_LENGTH);
  return bytesToBase64Url(box);
}

/**
 * Decrypts a box. A box of another version, another key (the holder's
 * previous words), another account or id, or one that was changed does not
 * open.
 *
 * @param key - The holder's box key ({@link heldShareBoxKey}).
 * @param holderAccountId - Account that keeps the box.
 * @param boxId - The box id it is stored under.
 * @param ciphertext - The box, base64url.
 * @returns The share code, or `null` when the box does not open.
 */
export async function openHeldShare(
  key: CryptoKey,
  holderAccountId: string,
  boxId: string,
  ciphertext: string,
): Promise<string | null> {
  try {
    const box = base64UrlToBytes(ciphertext);
    if (box[0] !== BOX_VERSION) {
      return null;
    }
    const plain = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: box.slice(1, 1 + IV_LENGTH),
        additionalData: additionalData(holderAccountId, boxId),
      },
      key,
      box.slice(1 + IV_LENGTH),
    );
    return new TextDecoder('utf-8', { fatal: true }).decode(plain);
  } catch {
    return null;
  }
}
