import type { Account } from '@/lib/api-types';
import { getBreezApiKey, getE2eNow } from '@/lib/config';
import { peekSessionPhrase } from '@/lib/tab-phrase';
import { visualPin } from '@/lib/visual-pin';
import {
  canUnlockWallet,
  settlePhraseDerivations,
  unlockWalletPhrase,
} from '@/lib/wallet/wallet-phrase';

/**
 * Whether signed-in screens of `account` need its wallet open in this tab. In
 * a real build: the wallet is configured and the account can derive it from
 * its passkey. An account that cannot hold a wallet (no Breez key in this
 * build, or a passkey the wallet cannot come from) is never held back. In a
 * Playwright build only the `?visual=balance-locked…` pins apply it, so the
 * fixture sessions still see the signed-in screens.
 *
 * @param account - Signed-in account.
 * @returns Whether the wallet must be open for the account to count as signed in.
 */
export function walletGateApplies(account: Account): boolean {
  if (getE2eNow() !== null) {
    return visualPin()?.startsWith('balance-locked') === true;
  }
  return getBreezApiKey() !== null && canUnlockWallet(account);
}

/**
 * Whether `account` counts as signed in in this tab: its recovery phrase is in
 * tab memory, or the wallet does not apply (see {@link walletGateApplies}). The
 * one-time wallet setup is not part of it; that runs in the background.
 *
 * @param account - Signed-in account.
 * @param hasPhrase - Whether the tab holds the recovery phrase.
 * @returns Whether the wallet is open.
 */
export function isWalletOpen(account: Account, hasPhrase: boolean): boolean {
  return hasPhrase || !walletGateApplies(account);
}

/**
 * Whether a stored session found at hydration (reload, new tab, reopened app)
 * is held back: it counts as signed in only once a login opens the wallet,
 * because the phrase is not in this tab. In a Playwright build the
 * `?visual=held-session` pin also holds it back, while a login in this tab
 * then counts as open (that build has no wallet to open), so the whole
 * reload-and-log-in path can run there.
 *
 * @param account - Account the stored token belongs to.
 * @returns Whether the session is held back.
 */
export function hydratesLocked(account: Account): boolean {
  const held = walletGateApplies(account) || visualPin() === 'held-session';
  return held && peekSessionPhrase() === null;
}

/** How {@link finishWalletOpen} ended. */
export type WalletOpenOutcome = 'open' | 'cancelled' | 'noPrf' | 'failed';

/**
 * After a login, opens the wallet of the signed-in account: waits for the
 * phrase the login is deriving from its own passkey prompt, and asks for the
 * seed passkey only when that gave no phrase (another passkey signed in). The
 * one-time wallet setup then starts in the background on its own. Never
 * rejects; the phrase stays in tab memory only.
 *
 * @returns `open`, or why the wallet could not be opened.
 */
export async function finishWalletOpen(): Promise<WalletOpenOutcome> {
  await settlePhraseDerivations();
  if (peekSessionPhrase() !== null) {
    return 'open';
  }
  const unlocked = await unlockWalletPhrase();
  return unlocked === 'unlocked' ? 'open' : unlocked;
}
