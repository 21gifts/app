/** Lowercase bech32 data characters (BIP-173). */
const BECH32_CHARS = '[02-9ac-hj-np-z]';

/**
 * Mainnet address shapes: P2WPKH (`bc1q`, 42 characters), P2WSH and P2TR
 * (`bc1q` / `bc1p`, 62 characters), and base58 P2PKH / P2SH (`1` / `3`, 26 to
 * 34 characters).
 */
const MAINNET_ADDRESS = new RegExp(
  `^(?:bc1q${BECH32_CHARS}{38}|bc1[qp]${BECH32_CHARS}{58}|[13][1-9A-HJ-NP-Za-km-z]{25,33})$`,
);

/**
 * Whether `value` has the shape of a Bitcoin mainnet address.
 *
 * A shape check only (no checksum): it keeps a malformed upstream value, a
 * testnet address, or free text out of a deposit QR.
 *
 * @param value - Candidate address.
 * @returns `true` for a plausible mainnet address string.
 */
export function isMainnetBitcoinAddress(value: string): boolean {
  return MAINNET_ADDRESS.test(value);
}
