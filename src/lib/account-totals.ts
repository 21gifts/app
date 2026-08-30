import type { GiftStats } from '@/lib/api-types';

/** Given/received sat totals for a profile address. */
export interface AccountTotals {
  donatedSats: number;
  receivedSats: number;
}

/**
 * Local-part of a Lightning Address (before the first `@`).
 *
 * @param address - Full address or bare handle.
 * @returns The handle before `@` when `indexOf('@') > 0`, otherwise the whole string.
 */
export function recipientHandleFromAddress(address: string): string {
  const at = address.indexOf('@');
  if (at > 0) {
    return address.slice(0, at);
  }
  return address;
}

/**
 * Derives given/received sat totals for a profile address from public gift stats.
 *
 * Given is always `0` in v1 (payments are not attributed to the signed-in account). Received
 * is the first `byRecipient` row whose `recipient` matches the address handle
 * case-insensitively.
 *
 * @param stats - Public `GET /gifts/stats` payload.
 * @param lightningAddress - Current account Lightning Address, or null.
 * @returns Sat totals (`donatedSats` always 0).
 */
export function accountTotals(stats: GiftStats, lightningAddress: string | null): AccountTotals {
  if (lightningAddress === null || lightningAddress.trim() === '') {
    return { donatedSats: 0, receivedSats: 0 };
  }
  const handle = recipientHandleFromAddress(lightningAddress.trim()).toLowerCase();
  const row = stats.byRecipient.find((entry) => entry.recipient.toLowerCase() === handle);
  return {
    donatedSats: 0,
    receivedSats: row === undefined ? 0 : row.sats,
  };
}
