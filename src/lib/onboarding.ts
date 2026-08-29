import type { Account } from '@/lib/api-types';

/** Where a signed-in visitor belongs in the post-login flow. */
export type OnboardingPath = '/setup/name' | '/setup/address' | '/setup/rules' | '/welcome';

/**
 * Whether the account has a display name to show.
 *
 * @param account - Signed-in account.
 * @returns True when `name` is non-null and non-empty after trim.
 */
export function hasDisplayName(account: Account): boolean {
  return account.name !== null && account.name.trim() !== '';
}

/**
 * Whether the account has a Wallet of Satoshi address to receive gifts.
 *
 * @param account - Signed-in account.
 * @returns True when `lightningAddress` is non-null and non-empty after trim.
 */
export function hasLightningAddress(account: Account): boolean {
  return account.lightningAddress !== null && account.lightningAddress.trim() !== '';
}

/**
 * Whether the account has agreed to the living-room rules.
 *
 * @param account - Signed-in account.
 * @returns True when `rulesAgreedAt` is a non-null timestamp.
 */
export function hasAgreedToRules(account: Account): boolean {
  return account.rulesAgreedAt !== null;
}

/**
 * Next path after login: name, address, rules, or welcome.
 *
 * @param account - Signed-in account.
 * @returns The screen the visitor should see.
 */
export function nextOnboardingPath(account: Account): OnboardingPath {
  if (!hasDisplayName(account)) {
    return '/setup/name';
  }
  if (!hasLightningAddress(account)) {
    return '/setup/address';
  }
  if (!hasAgreedToRules(account)) {
    return '/setup/rules';
  }
  return '/welcome';
}
