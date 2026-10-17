import { getPlatformUsername } from '@/lib/config';
import { giftsLightningAddress } from '@/lib/gifts-address';

/**
 * Address for donations to the 21.gifts project: the platform account's own
 * in-app wallet address, `<platform username>@<app host>`.
 *
 * @param hostname - Host the page was requested on (`21.gifts`, `dev.21.gifts`, `localhost`).
 * @returns The address, or `null` when the build sets no platform username.
 */
export function projectDonateAddress(hostname: string): string | null {
  return giftsLightningAddress(getPlatformUsername(), hostname);
}
