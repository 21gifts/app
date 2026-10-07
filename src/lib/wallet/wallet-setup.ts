import { fetchMe, putWallet } from '@/lib/api';
import type { Account } from '@/lib/api-types';
import { getBreezApiKey } from '@/lib/config';
import { peekSessionPhrase, SESSION_PHRASE_EVENT } from '@/lib/tab-phrase';
import { canUnlockWallet, settlePhraseDerivations } from '@/lib/wallet/wallet-phrase';
import { loadWalletSdk } from '@/lib/wallet/wallet-sdk';
import {
  ensureWalletConnected,
  registerWalletAddress,
  type WalletSdkLoader,
} from '@/lib/wallet/wallet-service';
import { useAuthStore } from '@/stores/auth-store';
import { useWalletStore } from '@/stores/wallet-store';

/**
 * How a setup run ended.
 * `done`: the account's wallet is verified. `locked`: the recovery phrase is
 * not in tab memory, so nothing ran; the next unlock or pay prompt starts it.
 * `failed`: every try failed. `superseded`: the session changed meanwhile.
 */
export type WalletSetupOutcome = 'done' | 'locked' | 'failed' | 'superseded';

/**
 * Pauses between the tries of one background setup run: the first try starts
 * at once, each later one after the next pause. After the last pause's try
 * fails, the run gives up and money screens show the setup note.
 */
export const WALLET_SETUP_RETRY_DELAYS_MS: readonly number[] = [2_000, 5_000, 15_000];

/**
 * True when the signed-in account must set up its in-app wallet before it can
 * pay from it or be paid to its address: the wallet is configured, the account requires a wallet and can
 * derive it from its passkey, has a username, and its wallet is not verified.
 * Older api bodies without `sparkWalletVerified` never qualify.
 *
 * @param account - Signed-in account, or `null` when logged out.
 * @returns Whether the background wallet setup applies.
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

/** The setup run in progress in this tab and the session it belongs to; `null` when idle. */
let running: { session: string | null; run: Promise<WalletSetupOutcome> } | null = null;

/**
 * Runs the one-time wallet setup in the background, without a dialog and
 * without a passkey prompt of its own: it needs the recovery phrase in tab
 * memory (the sign-up or login prompt, or the prompt of the first unlock or
 * payment, put it there) and otherwise ends `locked`. Each try connects,
 * sends `PUT /me/wallet` with the identity key, registers the account's
 * username as the wallet's address, and reloads the account. A 409 from the
 * claim means the wallet is already verified and skips straight to the
 * reload. A failed try is repeated quietly after each pause in
 * {@link WALLET_SETUP_RETRY_DELAYS_MS}; when the last one fails too, the
 * wallet store records this session in `setupFailedSession`. Never asks
 * whether a username is free, never sends or stores the phrase, and never
 * rejects. A call while a run for the same session is in progress joins that
 * run instead of starting another, across components and remounts. The
 * username registered is the one on the account the claim returns, so a
 * rename in another tab is picked up.
 *
 * @param loadSdk - SDK loader; defaults to {@link loadWalletSdk}.
 * @returns How the run ended.
 */
export function runWalletSetup(
  loadSdk: WalletSdkLoader = loadWalletSdk,
): Promise<WalletSetupOutcome> {
  const session = useAuthStore.getState().session;
  if (running !== null && running.session === session) {
    return running.run;
  }
  const entry = { session, run: setupWithRetries(session, loadSdk) };
  entry.run = entry.run.finally(() => {
    if (running === entry) {
      running = null;
    }
  });
  running = entry;
  return entry.run;
}

/**
 * Starts the background setup again after it gave up: clears
 * `setupFailedSession` and calls {@link runWalletSetup}. Never rejects.
 *
 * @param loadSdk - SDK loader; defaults to {@link loadWalletSdk}.
 * @returns How the new run ended.
 */
export function retryWalletSetup(
  loadSdk: WalletSdkLoader = loadWalletSdk,
): Promise<WalletSetupOutcome> {
  useWalletStore.getState().setSetupFailedSession(null);
  return runWalletSetup(loadSdk);
}

/**
 * Starts {@link runWalletSetup} whenever the signed-in account needs the
 * setup and the recovery phrase is in tab memory: when the phrase arrives,
 * when the account changes (a new member's username is saved), and once at
 * subscribe time. A session whose setup gave up is left alone until
 * {@link retryWalletSetup}. With no Breez API key, returns a no-op
 * unsubscribe and adds no listener.
 *
 * @param loadSdk - SDK loader forwarded to {@link runWalletSetup}.
 * @returns Unsubscribe function.
 */
export function listenForWalletSetup(loadSdk: WalletSdkLoader = loadWalletSdk): () => void {
  if (getBreezApiKey() === null) {
    return () => {
      // No-op when the wallet is disabled.
    };
  }
  const check = (): void => {
    const { session, account } = useAuthStore.getState();
    if (
      session !== null &&
      needsWalletSetup(account) &&
      peekSessionPhrase() !== null &&
      useWalletStore.getState().setupFailedSession !== session
    ) {
      void runWalletSetup(loadSdk);
    }
  };
  window.addEventListener(SESSION_PHRASE_EVENT, check);
  const unsubscribe = useAuthStore.subscribe(check);
  check();
  return () => {
    window.removeEventListener(SESSION_PHRASE_EVENT, check);
    unsubscribe();
  };
}

/**
 * Waits `ms` milliseconds.
 *
 * @param ms - Pause length.
 * @returns Resolves after the pause.
 */
function pause(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * One background run with its retries; see {@link runWalletSetup}.
 *
 * @param session - Session the run belongs to, or `null` when logged out.
 * @param loadSdk - SDK loader.
 * @returns How the run ended.
 */
async function setupWithRetries(
  session: string | null,
  loadSdk: WalletSdkLoader,
): Promise<WalletSetupOutcome> {
  if (session === null) {
    return 'superseded';
  }
  for (const delay of [...WALLET_SETUP_RETRY_DELAYS_MS, null]) {
    const outcome = await setupOnce(session, loadSdk);
    if (outcome !== 'failed') {
      return outcome;
    }
    if (delay === null) {
      break;
    }
    await pause(delay);
    if (useAuthStore.getState().session !== session) {
      return 'superseded';
    }
  }
  useWalletStore.getState().setSetupFailedSession(session);
  return 'failed';
}

/**
 * One try of the setup; see {@link runWalletSetup}.
 *
 * @param session - Session that must stay current.
 * @param loadSdk - SDK loader.
 * @returns How the try ended.
 */
async function setupOnce(session: string, loadSdk: WalletSdkLoader): Promise<WalletSetupOutcome> {
  const current = (): boolean => useAuthStore.getState().session === session;
  try {
    if (peekSessionPhrase() === null) {
      // The login may still be deriving the phrase from its own passkey prompt.
      await settlePhraseDerivations();
      if (!current()) {
        return 'superseded';
      }
      if (peekSessionPhrase() === null) {
        return 'locked';
      }
    }
    const { account } = useAuthStore.getState();
    if (!needsWalletSetup(account)) {
      return account?.sparkWalletVerified === true ? 'done' : 'failed';
    }
    let username = account.username;
    const identity = (await ensureWalletConnected(loadSdk)).toLowerCase();
    if (!current()) {
      return 'superseded';
    }
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
      await registerWalletAddress(username);
      if (!current()) {
        return 'superseded';
      }
    }
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
