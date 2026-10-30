/**
 * The signed-out social recovery on `/recover`. The old 12 words (typed, or
 * rebuilt from two share codes) open the old wallet, which proves the account
 * through its signed address lookup. A new passkey then gets its own wallet,
 * and one **Transfer** press moves the account, the 21.gifts address, the
 * sign-in, and the balance to it, resuming at the first part not done.
 *
 * Everything secret stays in this module's memory: the old and new words, the
 * PRF bytes, and both wallet connections. The view lives in
 * `useRecoveryStore`. Every wallet, network, and passkey effect goes through
 * {@link RecoveryDeps}.
 */
import {
  AppOutdatedError,
  finishPasskeyAuthentication,
  finishPasskeyRecovery,
  isUnknownCredentialError,
  isWrongAccountError,
  LoginsClosedError,
  RecoveryError,
  RecoveryPendingError,
  startPasskeyAuthentication,
  startPasskeyRecovery,
} from '@/lib/api';
import type { RecoveryBegin } from '@/lib/api-types';
import { getBreezApiKey } from '@/lib/config';
import { relockHeldShares } from '@/lib/held-shares';
import { logInteraction } from '@/lib/interaction-log';
import { mergePrfExtension } from '@/lib/passkey-renew';
import { classifyWebAuthnError, mnemonicFromPrfFirst, obtainPrfFirst } from '@/lib/prf-mnemonic';
import { recoveryMessage } from '@/lib/recovery-lookup';
import { traceWallet } from '@/lib/sentry';
import { clearSessionPhrase } from '@/lib/tab-phrase';
import { reportPaymentFailure } from '@/lib/wallet/payment-failure';
import { rememberPhraseFromPrf } from '@/lib/wallet/wallet-phrase';
import { loadWalletSdk, type WalletConnection, type WalletSdk } from '@/lib/wallet/wallet-sdk';
import { appHost, sdkFailureReason, WALLET_CONNECT_TIMEOUT_MS } from '@/lib/wallet/wallet-service';
import {
  creationOptionsFromJSON,
  credentialToJSON,
  requestOptionsFromJSON,
} from '@/lib/webauthn-browser';
import { useAuthStore } from '@/stores/auth-store';
import { useRecoveryStore, type RecoveryDone, type RecoveryView } from '@/stores/recovery-store';

/** Every wallet, network, and passkey effect of a recovery, so tests can replace each one. */
export interface RecoveryDeps {
  /** Downloads and starts the wallet SDK (once per page). */
  loadSdk: () => Promise<WalletSdk>;
  /** The Breez API key of this build, or `null` when the wallet is off. */
  apiKey: () => string | null;
  /** Host every wallet connects and signs its address calls with (the app's host). */
  host: () => string;
  /** Current time in milliseconds. */
  now: () => number;
  /** Resolves after `ms` milliseconds. */
  sleep: (ms: number) => Promise<void>;
  /** A random UUID, for the idempotency key of a send. */
  randomUUID: () => string;
  /** Creates a passkey (`navigator.credentials.create`). */
  createCredential: (options: CredentialCreationOptions) => Promise<Credential | null>;
  /** Asks for a passkey (`navigator.credentials.get`). */
  getCredential: (options: CredentialRequestOptions) => Promise<Credential | null>;
}

/**
 * Pause before the account is looked up again: the api settles a forwarded
 * recovery only after twice the address service's 15 s timeout, so 31 s.
 */
export const RECOVERY_SETTLE_WAIT_MS = 31_000;

/** Begin calls in one go while the api answers that it cannot look the account up yet. */
export const RECOVERY_BEGIN_TRIES = 3;

/** Sends in one go while the sending wallet still holds a balance after a send. */
export const RECOVERY_SEND_TRIES = 3;

/** The old wallet once open: the SDK, the key it connected with, the connection, and its identity key. */
interface OldWallet {
  /** The started SDK. */
  sdk: WalletSdk;
  /** Breez API key the wallets connect with. */
  apiKey: string;
  /** Live connection of the old wallet. */
  connection: WalletConnection;
  /** The old wallet's identity public key. */
  key: string;
}

/** One new passkey and its wallet, and how far its move got. */
interface Attempt {
  /** Live connection of the new wallet, or `null` once closed before the sign-in. */
  connection: WalletConnection | null;
  /** The new wallet's 12 words, derived from the passkey's PRF output. */
  newWords: string;
  /** The new passkey's PRF output. */
  prfFirst: Uint8Array;
  /** The new passkey's attestation, as sent to the api. */
  credentialJson: Record<string, unknown>;
  /** The new passkey's credential id (base64url). */
  newCredentialId: string;
  /** The new wallet's identity public key. */
  newSparkPubkey: string;
  /** The new wallet's Spark address, where the balance goes. */
  newSparkAddress: string;
  /** When the address claim settled (resolved, threw, or was not needed), or `null` before. */
  claimSettledAt: number | null;
  /** Idempotency key of a send whose outcome is unknown, or `null`. */
  idempotencyKey: string | null;
  /** Which parts of the move are done. */
  done: RecoveryDone;
}

/** One recovery, from the old words to the done step. */
interface Flow {
  /** The effects this recovery uses. */
  deps: RecoveryDeps;
  /** The old 12 words. */
  oldWords: string;
  /** Owner named in the scanned codes, or `null` for typed words. */
  ownerAccountId: string | null;
  /** The old wallet, once open. */
  old: OldWallet | null;
  /** The api's begin: challenge, passkey options, and the account. */
  begin: RecoveryBegin | null;
  /** The new passkey of this begin, once made. */
  attempt: Attempt | null;
}

/** Whether a step lets the press go on to the next part or ended it. */
type Next = 'next' | 'end';

/** How a sign-in with the new passkey ended. */
type SignInOutcome =
  | { kind: 'ok' }
  | { kind: 'stale' }
  | { kind: 'pending' }
  | { kind: 'unknown' }
  | { kind: 'failed'; error: unknown };

/** The old wallet could not sign its address lookup. */
class LookupSignError extends Error {
  constructor() {
    super('recovery-lookup-sign');
    this.name = 'LookupSignError';
  }
}

/** The recovery in progress in this tab, or `null`. */
let flow: Flow | null = null;

/**
 * The effects of a real recovery: the wallet SDK, this build's API key, the
 * app's host, the clock, timers, `crypto.randomUUID`, and the browser's
 * passkey prompts.
 *
 * @returns The default {@link RecoveryDeps}.
 */
export function defaultRecoveryDeps(): RecoveryDeps {
  return {
    loadSdk: loadWalletSdk,
    apiKey: getBreezApiKey,
    host: appHost,
    now: () => Date.now(),
    sleep: (ms) =>
      new Promise((resolve) => {
        setTimeout(resolve, ms);
      }),
    randomUUID: () => crypto.randomUUID(),
    createCredential: (options) => navigator.credentials.create(options),
    getCredential: (options) => navigator.credentials.get(options),
  };
}

/**
 * Closes a connection and ignores a failure: closing is best effort.
 *
 * @param connection - The connection to close.
 */
async function closeQuietly(connection: WalletConnection): Promise<void> {
  try {
    await connection.disconnect();
  } catch {
    // Closing is best effort.
  }
}

/**
 * Opens a wallet from its words beside the member's own wallet (the SDK keeps
 * each wallet's state apart by its key) and reads its balance once synced.
 * Both share the member's own wallet deadline,
 * {@link WALLET_CONNECT_TIMEOUT_MS}. A connection that opens after the
 * deadline, or whose read fails, is closed again.
 *
 * @param sdk - The started SDK.
 * @param words - The wallet's 12 words.
 * @param apiKey - Breez API key.
 * @param deps - The host to connect with and the timer of the deadline.
 * @returns The live connection and its synced balance in sats.
 * @throws Error `wallet-connect-timeout` at the deadline; otherwise the SDK's error.
 */
export async function openWordsWallet(
  sdk: WalletSdk,
  words: string,
  apiKey: string,
  deps: Pick<RecoveryDeps, 'host' | 'sleep'>,
): Promise<{ connection: WalletConnection; balanceSats: number }> {
  const opening = (async () => {
    const connection = await sdk.connect(words, apiKey, deps.host());
    try {
      const info = await connection.getInfo({ ensureSynced: true });
      return { connection, balanceSats: info.balanceSats };
    } catch (error) {
      await closeQuietly(connection);
      throw error;
    }
  })();
  const timedOut = Symbol('timed out');
  const first = await Promise.race([
    opening,
    deps.sleep(WALLET_CONNECT_TIMEOUT_MS).then((): typeof timedOut => timedOut),
  ]);
  if (first === timedOut) {
    void opening.then(
      (opened) => closeQuietly(opened.connection),
      () => undefined,
    );
    throw new Error('wallet-connect-timeout');
  }
  return first;
}

/**
 * Whether this flow is still the recovery in progress.
 *
 * @param f - A flow.
 * @returns `true` while no reset or new recovery replaced it.
 */
function live(f: Flow): boolean {
  return flow === f;
}

/**
 * Whether this attempt is still the move in progress.
 *
 * @param f - A flow.
 * @param a - One of its attempts.
 * @returns `true` while the flow is live and no restart replaced the attempt.
 */
function current(f: Flow, a: Attempt): boolean {
  return flow === f && f.attempt === a;
}

/**
 * Shows a view, unless the flow was replaced meanwhile.
 *
 * @param f - The flow the view belongs to.
 * @param view - The view.
 */
function show(f: Flow, view: RecoveryView): void {
  if (live(f)) {
    useRecoveryStore.getState().setView(view);
  }
}

/**
 * Shows the transfer view of an attempt with its done parts.
 *
 * @param f - The flow.
 * @param a - The attempt.
 * @param state - Busy, waiting, and error of the press.
 */
function showTransfer(
  f: Flow,
  a: Attempt,
  state: { busy: boolean; waiting: boolean; error: 'generic' | 'balance' | null },
): void {
  if (current(f, a)) {
    useRecoveryStore.getState().setView({ step: 'transfer', done: { ...a.done }, ...state });
  }
}

/**
 * Ends a press with an error on the transfer view.
 *
 * @param f - The flow.
 * @param a - The attempt.
 * @param error - `generic`, or `balance` when only the balance did not move.
 * @returns `end`.
 */
function stop(f: Flow, a: Attempt, error: 'generic' | 'balance'): Next {
  showTransfer(f, a, { busy: false, waiting: false, error });
  return 'end';
}

/**
 * The view of a refusal every api call of a recovery can answer: closed
 * logins, an outdated build, or a refused account.
 *
 * @param error - What the call threw.
 * @returns The `blocked` or `refused` view, or `null` for any other error.
 */
function blockedView(error: unknown): RecoveryView | null {
  if (error instanceof LoginsClosedError) {
    return { step: 'blocked', kind: 'closed' };
  }
  if (error instanceof AppOutdatedError) {
    return { step: 'blocked', kind: 'outdated' };
  }
  if (isWrongAccountError(error)) {
    return { step: 'refused', reason: 'operator' };
  }
  return null;
}

/**
 * Ends a press after an error: a refusal shows its own view, anything else
 * the `generic` error on the transfer view.
 *
 * @param f - The flow.
 * @param a - The attempt.
 * @param error - What failed.
 * @returns `end`.
 */
function stopWith(f: Flow, a: Attempt, error: unknown): Next {
  const view = blockedView(error);
  if (view === null) {
    return stop(f, a, 'generic');
  }
  show(f, view);
  return 'end';
}

/**
 * Begins the recovery with a fresh signed lookup of the old wallet's address.
 * While the api answers `unavailable` (it cannot look the account up yet), it
 * waits {@link RECOVERY_SETTLE_WAIT_MS} and asks again, up to
 * {@link RECOVERY_BEGIN_TRIES} calls; `onWait` runs before each pause.
 *
 * @param f - The flow.
 * @param old - Its open old wallet.
 * @param onWait - Shows that the recovery waits.
 * @param call - Which call this is, from 1.
 * @returns The begin, or `null` when the flow was replaced meanwhile.
 * @throws {@link LookupSignError} when the lookup cannot be signed; otherwise
 *   what {@link startPasskeyRecovery} threw last.
 */
async function beginWithRetries(
  f: Flow,
  old: OldWallet,
  onWait: () => void,
  call = 1,
): Promise<RecoveryBegin | null> {
  const { deps } = f;
  const timestamp = Math.floor(deps.now() / 1000);
  let signature: string;
  try {
    ({ signature } = await old.sdk.signAddressLookup(f.oldWords, deps.host(), timestamp));
  } catch {
    throw new LookupSignError();
  }
  if (!live(f)) {
    return null;
  }
  try {
    return await startPasskeyRecovery({ sparkPubkey: old.key, lookup: { signature, timestamp } });
  } catch (error) {
    const unavailable = error instanceof RecoveryError && error.kind === 'unavailable';
    if (!unavailable || call >= RECOVERY_BEGIN_TRIES) {
      throw error;
    }
  }
  onWait();
  await deps.sleep(RECOVERY_SETTLE_WAIT_MS);
  if (!live(f)) {
    return null;
  }
  return beginWithRetries(f, old, onWait, call + 1);
}

/**
 * The view of a begin that did not succeed on its first try.
 *
 * @param error - What the begin threw.
 * @returns `blocked`, `refused`, or `retry` (`wallet` when the lookup could
 *   not be signed, otherwise `unavailable`).
 */
function beginFailureView(error: unknown): RecoveryView {
  const blocked = blockedView(error);
  if (blocked !== null) {
    return blocked;
  }
  if (error instanceof LookupSignError) {
    return { step: 'retry', reason: 'wallet' };
  }
  if (
    error instanceof RecoveryError &&
    (error.kind === 'not_found' || error.kind === 'done' || error.kind === 'operator')
  ) {
    return { step: 'refused', reason: error.kind };
  }
  return { step: 'retry', reason: 'unavailable' };
}

/**
 * Starts a recovery with the old 12 words, typed or rebuilt from two share
 * codes, and opens the old wallet ({@link openAndBegin}). A recovery already
 * in progress in this tab is dropped and its wallets are closed. The words
 * stay in this module's memory only, never in the tab phrase.
 *
 * @param words - The old 12 words.
 * @param ownerAccountId - Owner named in the scanned codes, or `null` for
 *   typed words; a begin for another account is refused.
 * @param deps - Effects of the recovery; the real ones by default.
 * @returns Resolves when the old wallet is open and the account found, or the
 *   view shows why not.
 */
export async function rememberOldWords(
  words: string,
  ownerAccountId: string | null,
  deps: RecoveryDeps = defaultRecoveryDeps(),
): Promise<void> {
  const previous = flow;
  flow = { deps, oldWords: words, ownerAccountId, old: null, begin: null, attempt: null };
  if (previous !== null) {
    void closeFlow(previous);
  }
  await openAndBegin();
}

/**
 * Opens the old wallet, unless it is open, and finds its account. Without a
 * wallet in this build the view is `refused` `noWallet`. The wallet connects
 * and reads its synced balance within {@link WALLET_CONNECT_TIMEOUT_MS},
 * which also lets the SDK look up the address it holds; a failure is `retry`
 * `wallet`. The account is begun with a fresh signed lookup; while the api
 * cannot look it up yet, the view waits (`opening` with `waiting`) and asks
 * again after {@link RECOVERY_SETTLE_WAIT_MS}, up to
 * {@link RECOVERY_BEGIN_TRIES} calls, then `retry` `unavailable`. An account
 * other than the one in the scanned codes is `refused` `otherAccount`; no
 * account, a recovered one, or one only an operator can recover is
 * `refused`; closed logins and an outdated build are `blocked`. Otherwise the
 * view is `found`. **Try again** on `retry` calls this again. No-op without a
 * recovery, or once its account was found.
 *
 * @returns Resolves when the view shows the result.
 */
export async function openAndBegin(): Promise<void> {
  const f = flow;
  if (f === null) {
    return;
  }
  if (f.begin !== null) {
    return;
  }
  const { deps } = f;
  const apiKey = deps.apiKey();
  if (apiKey === null) {
    show(f, { step: 'refused', reason: 'noWallet' });
    return;
  }
  show(f, { step: 'opening', waiting: false });
  let old = f.old;
  if (old === null) {
    try {
      const sdk = await deps.loadSdk();
      const key = await sdk.identityPubkey(f.oldWords);
      const { connection } = await openWordsWallet(sdk, f.oldWords, apiKey, deps);
      if (!live(f)) {
        await closeQuietly(connection);
        return;
      }
      old = { sdk, apiKey, connection, key };
      f.old = old;
    } catch {
      show(f, { step: 'retry', reason: 'wallet' });
      return;
    }
  }
  let begin: RecoveryBegin | null;
  try {
    begin = await beginWithRetries(f, old, () => {
      show(f, { step: 'opening', waiting: true });
    });
  } catch (error) {
    show(f, beginFailureView(error));
    return;
  }
  if (begin === null) {
    return;
  }
  if (f.ownerAccountId !== null && begin.accountId !== f.ownerAccountId) {
    show(f, { step: 'refused', reason: 'otherAccount' });
    return;
  }
  f.begin = begin;
  show(f, { step: 'found', username: begin.username, restart: false, error: null, busy: false });
}

/**
 * **Create new passkey** on `found` (a user gesture). Creates the passkey from
 * the begin's options with the PRF request, derives its 12 words from the PRF
 * output (never into the tab phrase), opens its wallet within
 * {@link WALLET_CONNECT_TIMEOUT_MS}, and reads the wallet's key and Spark
 * address. Only when all of that worked does it keep the new passkey and
 * wallet, with nothing of the move done, and show `transfer`. A dismissed or
 * failed prompt is `found` with `cancelled`, a prompt that timed out
 * `timeout`, a passkey without PRF output `prf`, and a wallet that does not
 * open `wallet` (a half-open wallet is closed again); pressing again makes
 * the passkey again. No-op unless `found` is shown and idle.
 *
 * @returns Resolves when the view shows the result.
 */
export async function createNewPasskey(): Promise<void> {
  const f = flow;
  const view = useRecoveryStore.getState().view;
  if (f === null || f.old === null || f.begin === null || view.step !== 'found' || view.busy) {
    return;
  }
  const { deps, old, begin } = f;
  const fail = (error: 'cancelled' | 'prf' | 'timeout' | 'wallet'): void => {
    show(f, { ...view, error, busy: false });
  };
  show(f, { ...view, error: null, busy: true });
  let credential: PublicKeyCredential;
  let prfFirst: Uint8Array | null;
  try {
    const publicKey = await mergePrfExtension(creationOptionsFromJSON(begin.options));
    const created = await traceWallet(
      'wallet.passkey',
      () => deps.createCredential({ publicKey }),
      { prompt: 'recovery' },
    );
    if (created === null || created.type !== 'public-key') {
      fail('cancelled');
      return;
    }
    credential = created as PublicKeyCredential;
    prfFirst = await obtainPrfFirst(credential);
  } catch (error) {
    fail(classifyWebAuthnError(error) === 'timeout' ? 'timeout' : 'cancelled');
    return;
  }
  if (prfFirst === null) {
    fail('prf');
    return;
  }
  let newWords: string;
  let connection: WalletConnection;
  try {
    newWords = await mnemonicFromPrfFirst(Uint8Array.from(prfFirst));
    ({ connection } = await openWordsWallet(old.sdk, newWords, old.apiKey, deps));
  } catch {
    fail('wallet');
    return;
  }
  let newSparkPubkey: string;
  let newSparkAddress: string;
  try {
    newSparkPubkey = await old.sdk.identityPubkey(newWords);
    newSparkAddress = await connection.receiveSparkAddress();
  } catch {
    await closeQuietly(connection);
    fail('wallet');
    return;
  }
  if (!live(f)) {
    await closeQuietly(connection);
    return;
  }
  const attempt: Attempt = {
    connection,
    newWords,
    prfFirst,
    credentialJson: credentialToJSON(credential),
    newCredentialId: credential.id,
    newSparkPubkey,
    newSparkAddress,
    claimSettledAt: null,
    idempotencyKey: null,
    done: { account: false, address: false, signedIn: false, balance: false },
  };
  f.attempt = attempt;
  showTransfer(f, attempt, { busy: false, waiting: false, error: null });
}

/**
 * The new wallet's connection, opened again from its words when the sign-in
 * closed it before.
 *
 * @param f - The flow.
 * @param old - Its old wallet (the SDK and API key).
 * @param a - The attempt.
 * @returns The connection.
 * @throws When the wallet does not open, or the attempt was replaced meanwhile.
 */
async function newConnection(f: Flow, old: OldWallet, a: Attempt): Promise<WalletConnection> {
  if (a.connection !== null) {
    return a.connection;
  }
  const { connection } = await openWordsWallet(old.sdk, a.newWords, old.apiKey, f.deps);
  if (!current(f, a)) {
    await closeQuietly(connection);
    throw new Error('recovery-replaced');
  }
  a.connection = connection;
  return connection;
}

/**
 * Starts the recovery over with a new begin: the new wallet is closed, the
 * new begin is kept, every part of the old attempt is dropped (so its
 * idempotency key is never used again), and `found` asks for the passkey
 * again.
 *
 * @param f - The flow.
 * @param a - The attempt that did not go through.
 * @param begin - The new begin.
 */
function restart(f: Flow, a: Attempt, begin: RecoveryBegin): void {
  f.begin = begin;
  f.attempt = null;
  if (a.connection !== null) {
    void closeQuietly(a.connection);
    a.connection = null;
  }
  show(f, { step: 'found', username: begin.username, restart: true, error: null, busy: false });
}

/**
 * Signs in with the new passkey, limited to its credential, without telling
 * the authenticator about an unknown passkey. The new wallet is closed first,
 * so the member's own wallet can open it. On success the tab phrase of any
 * earlier session is cleared, the new words are derived from the passkey's
 * PRF output into the tab phrase, the session is stored, `login` and
 * `recovery_done` are logged, and every part of the move but the balance is
 * done (the api lets the passkey sign in only once the account and address moved).
 * While the old words are still in memory, the shares the member keeps for
 * others move from the old words to the new ones ({@link relockHeldShares});
 * that runs on its own and never holds up or fails the recovery.
 *
 * @param f - The flow.
 * @param a - The attempt.
 * @returns How the sign-in ended.
 */
async function signIn(f: Flow, a: Attempt): Promise<SignInOutcome> {
  if (a.connection !== null) {
    const connection = a.connection;
    a.connection = null;
    await closeQuietly(connection);
  }
  if (!current(f, a)) {
    return { kind: 'stale' };
  }
  try {
    const begin = await startPasskeyAuthentication();
    const publicKey = requestOptionsFromJSON({
      ...begin.options,
      allowCredentials: [{ type: 'public-key', id: a.newCredentialId }],
    });
    const credential = await traceWallet(
      'wallet.passkey',
      () => f.deps.getCredential({ publicKey }),
      { prompt: 'recovery' },
    );
    if (credential === null || credential.type !== 'public-key') {
      throw new DOMException('No passkey answered', 'NotAllowedError');
    }
    const session = await finishPasskeyAuthentication(
      begin.challengeId,
      credentialToJSON(credential as PublicKeyCredential),
    );
    if (!current(f, a)) {
      return { kind: 'stale' };
    }
    clearSessionPhrase();
    void rememberPhraseFromPrf({
      prfFirst: a.prfFirst,
      credentialId: a.newCredentialId,
      account: session.account,
      sessionToken: session.token,
    });
    void relockHeldShares(session.token, session.account.id, f.oldWords, a.newWords);
    useAuthStore.getState().setAuth(session.token, session.account);
    logInteraction('login');
    logInteraction('recovery_done');
    a.done = { ...a.done, account: true, address: true, signedIn: true };
    showTransfer(f, a, { busy: true, waiting: false, error: null });
    return { kind: 'ok' };
  } catch (error) {
    if (!current(f, a)) {
      return { kind: 'stale' };
    }
    if (error instanceof RecoveryPendingError) {
      return { kind: 'pending' };
    }
    if (isUnknownCredentialError(error)) {
      return { kind: 'unknown' };
    }
    return { kind: 'failed', error };
  }
}

/**
 * Begins the recovery again after a move that did not finish. With
 * `settledAt` it first waits until {@link RECOVERY_SETTLE_WAIT_MS} after the
 * address claim settled, so the api can settle a forwarded recovery. Then:
 * a new begin restarts the attempt; an account that is already recovered
 * signs in with the new passkey once (a passkey the api does not know means
 * another recovery won: `refused` `done`); `operator` and `not_found` are
 * refused; anything else ends the press with the `generic` error.
 *
 * @param f - The flow.
 * @param old - Its old wallet.
 * @param a - The attempt.
 * @param settledAt - When the address claim settled, to wait for the settle
 *   window after it first; `null` begins at once.
 * @returns `next` when the passkey signed in, otherwise `end`.
 */
async function beginAgain(
  f: Flow,
  old: OldWallet,
  a: Attempt,
  settledAt: number | null,
): Promise<Next> {
  const { deps } = f;
  const wait = (): void => {
    showTransfer(f, a, { busy: true, waiting: true, error: null });
  };
  if (settledAt !== null) {
    wait();
    await deps.sleep(Math.max(0, settledAt + RECOVERY_SETTLE_WAIT_MS - deps.now()));
    if (!current(f, a)) {
      return 'end';
    }
  }
  let begin: RecoveryBegin | null;
  try {
    begin = await beginWithRetries(f, old, wait);
  } catch (error) {
    if (!current(f, a)) {
      return 'end';
    }
    if (error instanceof RecoveryError && error.kind === 'done') {
      return signInAfterDone(f, a);
    }
    if (
      error instanceof RecoveryError &&
      (error.kind === 'operator' || error.kind === 'not_found')
    ) {
      show(f, { step: 'refused', reason: error.kind });
      return 'end';
    }
    return stopWith(f, a, error);
  }
  if (begin !== null && current(f, a)) {
    restart(f, a, begin);
  }
  return 'end';
}

/**
 * The sign-in once the api says the account was recovered: a passkey it does
 * not know shows `refused` `done`; any other failure ends the press, and the
 * next press tries the sign-in again.
 *
 * @param f - The flow.
 * @param a - The attempt.
 * @returns `next` when the passkey signed in, otherwise `end`.
 */
async function signInAfterDone(f: Flow, a: Attempt): Promise<Next> {
  const outcome = await signIn(f, a);
  switch (outcome.kind) {
    case 'ok':
      return 'next';
    case 'stale':
      return 'end';
    case 'unknown':
      show(f, { step: 'refused', reason: 'done' });
      return 'end';
    case 'pending':
      return stop(f, a, 'generic');
    case 'failed':
      return stopWith(f, a, outcome.error);
  }
}

/**
 * Part 1, the account: the old wallet signs the recovery message for the new
 * passkey and wallet, and the api stores them. A challenge the api no longer
 * knows means nothing moved: the recovery begins again at once.
 *
 * @param f - The flow.
 * @param old - Its old wallet.
 * @param begin - The begin of this attempt.
 * @param a - The attempt.
 * @returns `next` once stored (or signed in), otherwise `end`.
 */
async function moveAccount(
  f: Flow,
  old: OldWallet,
  begin: RecoveryBegin,
  a: Attempt,
): Promise<Next> {
  let signature: { pubkey: string; signature: string };
  try {
    signature = await old.connection.signMessage(
      recoveryMessage({
        accountId: begin.accountId,
        challenge: String(begin.options['challenge']),
        credentialId: a.newCredentialId,
        newSparkPubkey: a.newSparkPubkey,
      }),
    );
  } catch {
    return stop(f, a, 'generic');
  }
  if (!current(f, a)) {
    return 'end';
  }
  if (signature.pubkey !== old.key) {
    return stop(f, a, 'generic');
  }
  try {
    await finishPasskeyRecovery({
      challengeId: begin.challengeId,
      credential: a.credentialJson,
      newSparkPubkey: a.newSparkPubkey,
      signature,
    });
  } catch (error) {
    if (!current(f, a)) {
      return 'end';
    }
    if (error instanceof RecoveryError && error.kind === 'challenge') {
      return beginAgain(f, old, a, null);
    }
    return stopWith(f, a, error);
  }
  if (!current(f, a)) {
    return 'end';
  }
  a.done = { ...a.done, account: true };
  showTransfer(f, a, { busy: true, waiting: false, error: null });
  return 'next';
}

/**
 * Part 2, the address: when the old wallet holds an address, it authorizes the
 * move and the new wallet claims it. Whatever happens, the moment the claim
 * settled is kept: the api's settle window starts before it. A failure leaves
 * the address to move and goes on.
 *
 * @param f - The flow.
 * @param old - Its old wallet.
 * @param a - The attempt.
 */
async function moveAddress(f: Flow, old: OldWallet, a: Attempt): Promise<void> {
  try {
    if (await old.connection.hasAddress()) {
      const transfer = await old.connection.authorizeAddressTransfer(a.newSparkPubkey);
      const connection = await newConnection(f, old, a);
      await traceWallet('wallet.address.transfer', () => connection.claimAddressTransfer(transfer));
    }
    a.done = { ...a.done, address: true };
  } catch {
    // The address stays to move; the sign-in shows whether it moved anyway.
  }
  a.claimSettledAt = f.deps.now();
  showTransfer(f, a, { busy: true, waiting: false, error: null });
}

/**
 * Part 3, the sign-in with the new passkey. A recovery the api has not
 * committed yet begins again after the settle window; a passkey the api no
 * longer knows (the pending recovery ended) begins again at once.
 *
 * @param f - The flow.
 * @param old - Its old wallet.
 * @param a - The attempt.
 * @returns `next` once signed in, otherwise `end`.
 */
async function signInNew(f: Flow, old: OldWallet, a: Attempt): Promise<Next> {
  const outcome = await signIn(f, a);
  switch (outcome.kind) {
    case 'ok':
      return 'next';
    case 'stale':
      return 'end';
    case 'pending':
      return beginAgain(f, old, a, a.claimSettledAt);
    case 'unknown':
      return beginAgain(f, old, a, null);
    case 'failed':
      return stopWith(f, a, outcome.error);
  }
}

/**
 * Ends the recovery on `done`: closes the old wallet and drops every word
 * and connection from memory.
 *
 * @param f - The flow.
 * @param old - Its old wallet.
 * @param balanceMissing - Whether some balance stayed in the old wallet.
 */
async function finish(f: Flow, old: OldWallet, balanceMissing: boolean): Promise<void> {
  await closeQuietly(old.connection);
  if (!live(f)) {
    return;
  }
  show(f, { step: 'done', balanceMissing });
  flow = null;
}

/**
 * Part 4, the balance: reads the old wallet's synced balance and sends all of
 * it to the new wallet's Spark address. A send whose outcome is unknown (it
 * threw) keeps its idempotency key, so the next press repeats that send, and
 * the SDK answers it instead of paying twice. After a send that went out the
 * balance is read again; funds that arrived meanwhile get a send with a new
 * key, up to {@link RECOVERY_SEND_TRIES} sends per press. Only a synced read
 * of 0 ends the recovery; any failure is the `balance` error. A send that
 * throws is also reported as a payment that did not go out
 * ({@link reportPaymentFailure}: stage `send`, method `spark`, flow
 * `recovery`, the reason from {@link sdkFailureReason}) under the session the
 * new passkey signed in with.
 *
 * @param f - The flow.
 * @param old - Its old wallet.
 * @param a - The attempt.
 */
async function moveBalance(f: Flow, old: OldWallet, a: Attempt): Promise<void> {
  const { deps } = f;
  const session = useAuthStore.getState().session;
  try {
    let balance = (await old.connection.getInfo({ ensureSynced: true })).balanceSats;
    let sends = 0;
    while (balance > 0) {
      if (sends === RECOVERY_SEND_TRIES || !current(f, a)) {
        stop(f, a, 'balance');
        return;
      }
      const key = a.idempotencyKey ?? deps.randomUUID();
      a.idempotencyKey = key;
      const amount = balance;
      try {
        await traceWallet(
          'wallet.send',
          () => old.connection.sendToSparkAddress(a.newSparkAddress, amount, key),
          { route: 'spark' },
        );
      } catch (error) {
        reportPaymentFailure(
          {
            stage: 'send',
            reason: sdkFailureReason(error),
            method: 'spark',
            amountSats: amount,
            feeSats: null,
            error,
          },
          'recovery',
          { session },
        );
        throw error;
      }
      sends += 1;
      a.idempotencyKey = null;
      balance = (await old.connection.getInfo({ ensureSynced: true })).balanceSats;
    }
  } catch {
    stop(f, a, 'balance');
    return;
  }
  if (!current(f, a)) {
    return;
  }
  a.done = { ...a.done, balance: true };
  await finish(f, old, false);
}

/**
 * **Transfer** on `transfer`: one press moves, in order and from the first
 * part not done, the account (the old wallet signs the recovery for the new
 * passkey and wallet), the 21.gifts address (claimed by the new wallet), the
 * sign-in with the new passkey, and the whole balance of the old wallet. A
 * failed address claim does not stop the press. While the api has not
 * committed the recovery, the press waits for its settle window and begins
 * again, which may ask for the new passkey once more (`found` with
 * `restart`). A failure ends the press with `generic` (**Start over** is
 * offered) or, for the balance, `balance` (**Move the balance later**);
 * refusals show their own view. No-op unless `transfer` is shown and idle.
 *
 * @returns Resolves when the press ended.
 */
export async function transfer(): Promise<void> {
  const f = flow;
  const view = useRecoveryStore.getState().view;
  if (
    f === null ||
    f.old === null ||
    f.begin === null ||
    f.attempt === null ||
    view.step !== 'transfer' ||
    view.busy
  ) {
    return;
  }
  const { old, begin, attempt: a } = f;
  showTransfer(f, a, { busy: true, waiting: false, error: null });
  if (!a.done.account && (await moveAccount(f, old, begin, a)) === 'end') {
    return;
  }
  if (!a.done.address) {
    await moveAddress(f, old, a);
  }
  if (!a.done.signedIn && (await signInNew(f, old, a)) === 'end') {
    return;
  }
  await moveBalance(f, old, a);
}

/**
 * **Move the balance later** after the `balance` error: the account has
 * moved and is signed in, so the recovery ends on `done` with the note that
 * some balance stayed in the previous wallet (it can be moved from the
 * settings). Closes the old wallet. No-op on any other view.
 *
 * @returns Resolves on `done`.
 */
export async function finishWithoutBalance(): Promise<void> {
  const f = flow;
  const view = useRecoveryStore.getState().view;
  if (
    f === null ||
    f.old === null ||
    view.step !== 'transfer' ||
    view.error !== 'balance' ||
    view.busy
  ) {
    return;
  }
  await finish(f, f.old, true);
}

/**
 * **Try again** on `blocked` `closed`: picks the recovery up where closed
 * logins stopped it. Before the account was found it opens and begins again
 * ({@link openAndBegin}, which reuses an open old wallet). During the move it
 * shows the transfer view with its done parts and the `generic` error, so the
 * next **Transfer** press resumes at the first part not done. With a begin
 * but no new passkey yet it shows `found`. No-op without a recovery or on any
 * other view.
 *
 * @returns Resolves when the view shows the result.
 */
export async function resumeRecovery(): Promise<void> {
  const f = flow;
  const view = useRecoveryStore.getState().view;
  if (f === null || view.step !== 'blocked' || view.kind !== 'closed') {
    return;
  }
  if (f.begin === null) {
    await openAndBegin();
    return;
  }
  if (f.attempt === null) {
    show(f, {
      step: 'found',
      username: f.begin.username,
      restart: false,
      error: null,
      busy: false,
    });
    return;
  }
  showTransfer(f, f.attempt, { busy: false, waiting: false, error: 'generic' });
}

/**
 * Closes the wallets of a recovery (best effort).
 *
 * @param f - The recovery.
 */
async function closeFlow(f: Flow): Promise<void> {
  const connections = [f.old?.connection, f.attempt?.connection].filter(
    (connection): connection is WalletConnection => connection !== undefined && connection !== null,
  );
  await Promise.all(connections.map(closeQuietly));
}

/**
 * **Start over**, and leaving the done step: drops the recovery in progress
 * (words, PRF bytes, begin, attempt), closes both wallets (best effort), and
 * shows `start`. An answer of the dropped recovery that arrives later changes
 * nothing.
 *
 * @returns Resolves once both wallets are closed.
 */
export async function resetRecovery(): Promise<void> {
  const f = flow;
  flow = null;
  useRecoveryStore.getState().setView({ step: 'start' });
  if (f !== null) {
    await closeFlow(f);
  }
}
