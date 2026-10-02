import type { Account } from '@/lib/api-types';

/** The post-login path is name, username, rules, or welcome, and never `/wallet`. */
export type OnboardingPath = '/setup/name' | '/setup/username' | '/setup/rules' | '/welcome';

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
 * Whether the account has agreed to the living-room rules.
 *
 * @param account - Signed-in account.
 * @returns True when `rulesAgreedAt` is a non-null timestamp.
 */
export function hasAgreedToRules(account: Account): boolean {
  return account.rulesAgreedAt !== null;
}

/**
 * Next path after login from `account.setup`.
 *
 * `'wallet'` is not a route: the path comes from name, username, and rules.
 * There is no address step: a member receives on their own in-app wallet,
 * which the one-time wallet setup dialog sets up. The api's
 * `'lightning-address'` step is therefore resolved like `'wallet'`. Other
 * `setup` values stay a 1:1 map.
 *
 * @param account - Signed-in account.
 * @returns The screen the visitor should see.
 */
export function nextOnboardingPath(account: Account): OnboardingPath {
  switch (account.setup) {
    case 'wallet':
    case 'lightning-address':
      if (!hasDisplayName(account)) {
        return '/setup/name';
      }
      if ((account.username ?? '').trim() === '') {
        return '/setup/username';
      }
      if (!hasAgreedToRules(account)) {
        return '/setup/rules';
      }
      return '/welcome';
    case 'name':
      return '/setup/name';
    case 'username':
      return '/setup/username';
    case 'rules':
      return '/setup/rules';
    case null:
      return '/welcome';
  }
}
