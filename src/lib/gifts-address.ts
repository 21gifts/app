/**
 * Public `username@21.gifts` address shown on profiles.
 *
 * Settlement stays on the linked Wallet of Satoshi address; this string is
 * the LUD-16 handle wallets resolve at `/.well-known/lnurlp/:username`.
 */

/**
 * Build the public 21.gifts address from a stored username.
 *
 * Loopback and raw IPs fall back to `21.gifts` so tests and local boots
 * still show a payable-looking handle. Empty username returns `null`.
 *
 * @param username - Stored LUD-16 local-part, or null/blank.
 * @param hostname - Site host (`21.gifts`, `dev.21.gifts`, `localhost`).
 * @returns `local@domain`, or `null`.
 */
export function giftsLightningAddress(
  username: string | null | undefined,
  hostname: string = '21.gifts',
): string | null {
  const local = username?.trim().toLowerCase() ?? '';
  if (local === '') {
    return null;
  }
  const host = hostname.trim().toLowerCase();
  const domain =
    host === '' ||
    host === 'localhost' ||
    host === '::1' ||
    host === '[::1]' ||
    host.endsWith('.localhost') ||
    /^\d+\.\d+\.\d+\.\d+$/.test(host)
      ? '21.gifts'
      : host.replace(/^www\./, '');
  return `${local}@${domain}`;
}
