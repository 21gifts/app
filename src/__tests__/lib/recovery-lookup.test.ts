import { createPublicKey, verify } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { derSignatureHex, lnurlRecoverMessage, recoveryMessage } from '@/lib/recovery-lookup';

/**
 * A recovery message signed once with the offline signer of Breez SDK 0.26.0
 * (`defaultExternalSigners(mnemonic, null, 'mainnet').sparkSigner`): the old
 * wallet is the public BIP-39 test phrase `abandon` ×11 `about`, the new one
 * the public test phrase `legal winner thank year` … `yellow`. The compact
 * signature is low S and deterministic.
 */
const OLD_KEY = '0281363910b0dc0015a4a25e758da30f0e28388ea5252c0e3713936f2d4ef7d3d5';
const NEW_KEY = '0319d6c5d64753556063000ab42725bfe774fe722f00fbc692142eade1fd1ea52f';
const MESSAGE = `21gifts-account-recovery-v1\n3f2b8c1e-9d4a-4e7b-8c6f-1a2b3c4d5e6f\nWm9wC1Vd3Q8b3n8ZxJ2qkHc7oYyQkq2vQ3d1uS0aT4E\nbmV3LXJlY292ZXJ5LXBhc3NrZXktMQ\n${NEW_KEY}`;
const COMPACT =
  'b02626c724efdd78042241a16fb1808118544d09f13d2d745847f5dbfc46f46167acd68bf9f5cf6cf844b000c555a228c811924a44473a516c7cce6a95cdaab4';
const DER =
  '3045022100b02626c724efdd78042241a16fb1808118544d09f13d2d745847f5dbfc46f461022067acd68bf9f5cf6cf844b000c555a228c811924a44473a516c7cce6a95cdaab4';

/**
 * Bytes of a hex string.
 *
 * @param text - Hex.
 * @returns The bytes.
 */
function bytes(text: string): Uint8Array {
  return Uint8Array.from(Buffer.from(text, 'hex'));
}

/**
 * Verifies a DER signature over SHA-256 of the message with Node's own
 * secp256k1, from the compressed public key wrapped as SPKI.
 *
 * @param message - Signed text.
 * @param pubkey - Compressed public key, hex.
 * @param der - DER signature, hex.
 * @returns Whether it verifies.
 */
function verifies(message: string, pubkey: string, der: string): boolean {
  const spki = Buffer.concat([
    Buffer.from('3036301006072a8648ce3d020106052b8104000a032200', 'hex'),
    Buffer.from(pubkey, 'hex'),
  ]);
  const key = createPublicKey({ key: spki, format: 'der', type: 'spki' });
  return verify('sha256', Buffer.from(message, 'utf8'), { key, dsaEncoding: 'der' }, bytes(der));
}

describe('derSignatureHex', () => {
  it('encodes the pinned compact signature as the pinned DER, which verifies', () => {
    expect(derSignatureHex(bytes(COMPACT))).toBe(DER);
    expect(verifies(MESSAGE, OLD_KEY, DER)).toBe(true);
    expect(verifies(`${MESSAGE}\n`, OLD_KEY, DER)).toBe(false);
  });

  it('prefixes a zero byte when the high bit of r or s is set, and only then', () => {
    const highR = new Uint8Array(64).fill(0x11);
    highR[0] = 0x80;
    expect(derSignatureHex(highR)).toBe(`304502210080${'11'.repeat(31)}0220${'11'.repeat(32)}`);
    const highS = new Uint8Array(64).fill(0x11);
    highS[32] = 0xff;
    expect(derSignatureHex(highS)).toBe(`30450220${'11'.repeat(32)}022100ff${'11'.repeat(31)}`);
  });

  it('drops leading zero bytes, keeps one byte for zero, and re-adds a sign byte', () => {
    const value = new Uint8Array(64);
    value[2] = 0x01;
    value[31] = 0x02;
    value[33] = 0x90;
    expect(derSignatureHex(value)).toBe(`3042021e01${'00'.repeat(28)}0202200090${'00'.repeat(30)}`);
    expect(derSignatureHex(new Uint8Array(64))).toBe('3006020100020100');
  });

  it('refuses a signature that is not 64 bytes', () => {
    expect(() => derSignatureHex(new Uint8Array(63))).toThrow('Expected a 64-byte signature');
  });
});

describe('lnurlRecoverMessage', () => {
  it('equals the SDK golden vector of the recover message', () => {
    expect(
      lnurlRecoverMessage(
        'lnurl.example.com',
        '02a1633cafcc01ebfb6d78e39f687a1f0995c62fc95f51ead10a02ee0be551b5dc',
        1_700_000_000,
      ),
    ).toBe(
      'breez-lnurl:v2\nrecover\nlnurl.example.com\n02a1633cafcc01ebfb6d78e39f687a1f0995c62fc95f51ead10a02ee0be551b5dc\n1700000000',
    );
  });
});

describe('recoveryMessage', () => {
  it('equals the pinned five-line message, without a final line feed', () => {
    expect(
      recoveryMessage({
        accountId: '3f2b8c1e-9d4a-4e7b-8c6f-1a2b3c4d5e6f',
        challenge: 'Wm9wC1Vd3Q8b3n8ZxJ2qkHc7oYyQkq2vQ3d1uS0aT4E',
        credentialId: 'bmV3LXJlY292ZXJ5LXBhc3NrZXktMQ',
        newSparkPubkey: NEW_KEY,
      }),
    ).toBe(MESSAGE);
  });
});
