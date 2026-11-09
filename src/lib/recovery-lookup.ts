/**
 * The two signed messages of a social recovery: the address lookup the
 * address server reads for the old wallet, and the recovery message the old
 * wallet signs to hand the account to the new passkey and wallet.
 */

/** First line of the recovery message (the api builds the same text). */
const RECOVERY_MESSAGE_PREFIX = '21gifts-account-recovery-v1';

/** First line of every message the wallet's address server reads. */
const LNURL_MESSAGE_VERSION = 'breez-lnurl:v2';

/**
 * One DER integer: leading zero bytes dropped (one is kept for zero), and a
 * zero byte in front when the high bit is set, so the integer stays positive.
 *
 * @param bytes - Big-endian unsigned integer.
 * @returns Tag, length, and value bytes.
 */
function derInteger(bytes: Uint8Array): number[] {
  let start = 0;
  while (start < bytes.length - 1 && bytes[start] === 0) {
    start += 1;
  }
  const value = Array.from(bytes.subarray(start));
  if (value[0]! >= 0x80) {
    value.unshift(0);
  }
  return [0x02, value.length, ...value];
}

/**
 * Encodes a compact ECDSA signature (r and s, 32 bytes each) as strict
 * minimal DER, the form the address server reads.
 *
 * @param compact - 64 bytes: r then s.
 * @returns The DER signature as lower-case hex.
 * @throws Error when the signature is not 64 bytes.
 */
export function derSignatureHex(compact: Uint8Array): string {
  if (compact.length !== 64) {
    throw new Error('Expected a 64-byte signature');
  }
  const body = [...derInteger(compact.subarray(0, 32)), ...derInteger(compact.subarray(32))];
  return [0x30, body.length, ...body].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * The address lookup message a wallet signs to read back the address it holds
 * (`recover` of the address server's version 2 format): lines joined by line
 * feeds, timestamp in decimal seconds.
 *
 * @param domain - Host the address lives on, as the wallet's connection names it.
 * @param pubkey - The wallet's identity public key, lower-case hex.
 * @param timestampSecs - Unix time in seconds.
 * @returns The message text.
 */
export function lnurlRecoverMessage(domain: string, pubkey: string, timestampSecs: number): string {
  return [LNURL_MESSAGE_VERSION, 'recover', domain, pubkey, String(timestampSecs)].join('\n');
}

/**
 * The recovery message the old wallet signs: five lines joined by line feeds,
 * no line feed at the end. The api checks the signature over this exact text.
 *
 * @param input - Account id, the recovery challenge as issued (base64url), the
 *   new passkey's credential id (base64url), and the new wallet's identity
 *   public key (lower-case hex).
 * @returns The message text.
 */
export function recoveryMessage(input: {
  accountId: string;
  challenge: string;
  credentialId: string;
  newSparkPubkey: string;
}): string {
  return [
    RECOVERY_MESSAGE_PREFIX,
    input.accountId,
    input.challenge,
    input.credentialId,
    input.newSparkPubkey,
  ].join('\n');
}
