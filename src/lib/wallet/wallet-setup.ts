import { fetchMe, putWallet } from '@/lib/api';
import type { Account } from '@/lib/api-types';
import { getBreezApiKey } from '@/lib/config';
import { classifyWebAuthnError, obtainPrfFirstFromGet } from '@/lib/prf-mnemonic';
import { peekSessionPhrase } from '@/lib/tab-phrase';
import { canUnlockWallet, rememberPhraseFromPrf } from '@/lib/wallet/wallet-phrase';
import { loadWalletSdk } from '@/lib/wallet/wallet-sdk';
import {
  ensureWalletConnected,
  registerWalletAddress,
  type WalletSdkLoader,
} from '@/lib/wallet/wallet-service';
import { base64UrlToBytes } from '@/lib/webauthn-browser';
import { useAuthStore } from '@/stores/auth-store';

/**
 * Step of the one-time wallet setup that is running.
 * `passkey` waits for the device prompt, `connecting` opens the wallet,
 * `claiming` stores its identity key on the account, `registering` registers
 * the account's address, and `refreshing` reloads the account.
 */
export type WalletSetupStep = 'passkey' | 'connecting' | 'claiming' | 'registering' | 'refreshing';

/**
 * How a setup run ended.
 * `done`: the account's wallet is verified. `cancelled`: the member dismissed
 * the passkey prompt. `noPrf`: the passkey cannot produce the wallet's key.
 * `failed`: any other failure. `superseded`: the session changed meanwhile.
 */
export type WalletSetupOutcome = 'done' | 'cancelled' | 'noPrf' | 'failed' | 'superseded';

/**
 * True when the signed-in account must set up its in-app wallet before using
 * the app: the wallet is configured, the account requires a wallet and can
 * derive it from its passkey, has a username, and its wallet is not verified.
 * Older api bodies without `sparkWalletVerified` never qualify.
 *
 * @param account - Signed-in account, or `null` when logged out.
 * @returns Whether the blocking setup step applies.
 */
export function needsWalletSetup(
  account: Account | null,
): account is Account & { passkeyCredentialId: string; username: string } {
  return (
    getBreezApiKey() !== null &&
    canUnlockWallet(account) &&
    account.sparkWalletVerified === false &&
    typeof account.username === 'string' &&
    account.username !== ''
  );
}

/**
 * Derives the tab phrase with one passkey prompt.
 *
 * @param account - Account whose seed passkey is asked for.
 * @param session - Session that must stay current.
 * @returns `null` when the phrase is in tab memory, otherwise the outcome that ends the run.
 */
async function unlockForSetup(
  account: Account & { passkeyCredentialId: string },
  session: string,
): Promise<WalletSetupOutcome | null> {
  let prfFirst: Uint8Array | null;
  try {
    prfFirst = await obtainPrfFirstFromGet(
      Uint8Array.from(base64UrlToBytes(account.passkeyCredentialId)),
    );
  } catch (err: unknown) {
    return classifyWebAuthnError(err) === 'cancel' ? 'cancelled' : 'failed';
  }
  if (prfFirst === null) {
    return 'noPrf';
  }
  const remembered = await rememberPhraseFromPrf({
    prfFirst,
    credentialId: account.passkeyCredentialId,
    account,
    sessionToken: session,
  });
  return remembered ? null : 'failed';
}

/** The setup run in progress in this tab and the session it belongs to; `null` when idle. */
let running: { session: string | null; run: Promise<WalletSetupOutcome> } | null = null;

/**
 * The run in progress for the current session, if any.
 *
 * @returns That run's promise, or `null`.
 */
function currentRun(): Promise<WalletSetupOutcome> | null {
  return running !== null && running.session === useAuthStore.getState().session
    ? running.run
    : null;
}

/**
 * True while a setup run for the current session is in progress in this
 * tab, so a remounted dialog shows progress and joins it instead of starting
 * a second run. A run left over from an earlier session does not count.
 *
 * @returns Whether {@link runWalletSetup} has a run in flight for this session.
 */
export function walletSetupInFlight(): boolean {
  return currentRun() !== null;
}

/**
 * Runs the one-time wallet setup: one passkey prompt when the phrase is not
 * in tab memory, then connect, `PUT /me/wallet` with the identity key,
 * register the account's username as the wallet's address, and reload the
 * account. A 409 from the claim means the wallet is already verified and
 * skips straight to the reload. Never asks whether a username is free and
 * never sends the phrase. Never rejects. A call while a run for the same
 * session is in progress joins that run (its `onStep` is not called) instead
 * of starting another. The username registered is the one on the account the
 * claim returns, so a rename in another tab is picked up.
 *
 * @param onStep - Called as each step starts.
 * @param loadSdk - SDK loader; defaults to {@link loadWalletSdk}.
 * @returns How the run ended.
 */
export function runWalletSetup(
  onStep: (step: WalletSetupStep) => void,
  loadSdk: WalletSdkLoader = loadWalletSdk,
): Promise<WalletSetupOutcome> {
  const joined = currentRun();
  if (joined !== null) {
    return joined;
  }
  const entry = { session: useAuthStore.getState().session, run: setupOnce(onStep, loadSdk) };
  entry.run = entry.run.finally(() => {
    if (running === entry) {
      running = null;
    }
  });
  running = entry;
  return entry.run;
}

/**
 * One setup run; see {@link runWalletSetup}.
 *
 * @param onStep - Called as each step starts.
 * @param loadSdk - SDK loader.
 * @returns How the run ended.
 */
async function setupOnce(
  onStep: (step: WalletSetupStep) => void,
  loadSdk: WalletSdkLoader,
): Promise<WalletSetupOutcome> {
  const { session, account } = useAuthStore.getState();
  if (session === null || !needsWalletSetup(account)) {
    return 'failed';
  }
  let username = account.username;
  const current = (): boolean => useAuthStore.getState().session === session;
  try {
    if (peekSessionPhrase() === null) {
      onStep('passkey');
      const unlocked = await unlockForSetup(account, session);
      if (!current()) {
        return 'superseded';
      }
      if (unlocked !== null) {
        return unlocked;
      }
    }
    onStep('connecting');
    const identity = (await ensureWalletConnected(loadSdk)).toLowerCase();
    if (!current()) {
      return 'superseded';
    }
    onStep('claiming');
    let alreadyVerified = false;
    try {
      const claimed = await putWallet(session, identity);
      if (!current()) {
        return 'superseded';
      }
      if (typeof claimed.username !== 'string' || claimed.username === '') {
        return 'failed';
      }
      useAuthStore.getState().setAccount(claimed);
      username = claimed.username;
    } catch (err: unknown) {
      if (!(err instanceof Error) || err.message !== 'wallet-verified') {
        throw err;
      }
      alreadyVerified = true;
    }
    if (!current()) {
      return 'superseded';
    }
    if (!alreadyVerified) {
      onStep('registering');
      await registerWalletAddress(username);
      if (!current()) {
        return 'superseded';
      }
    }
    onStep('refreshing');
    const next = await fetchMe(session);
    if (!current()) {
      return 'superseded';
    }
    if (next === null) {
      return 'failed';
    }
    useAuthStore.getState().setAccount(next);
    return next.sparkWalletVerified === true ? 'done' : 'failed';
  } catch {
    return current() ? 'failed' : 'superseded';
  }
}
