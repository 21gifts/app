import { captureMessage } from '@sentry/nextjs';
import { getBreezApiKey, getE2eNow } from '@/lib/config';
import { logInteraction } from '@/lib/interaction-log';
import { traceWallet, type WalletSpanAttributes } from '@/lib/sentry';
import { peekSessionPhrase, SESSION_PHRASE_EVENT } from '@/lib/tab-phrase';
import type { PaymentFailure, PayMethod, PayReason, PayStage } from '@/lib/wallet/payment-failure';
import {
  loadWalletSdk,
  type OnchainSpeed,
  type WalletConnection,
  type WalletPayment,
  type WalletPaymentPage,
  type WalletPayRequest,
  type WalletReportPayment,
  type WalletSdk,
  type WalletSdkEvent,
  type WalletTarget,
} from '@/lib/wallet/wallet-sdk';
import { useAuthStore } from '@/stores/auth-store';
import { useWalletStore } from '@/stores/wallet-store';

/**
 * Loads a {@link WalletSdk}. Injected in tests; defaults to {@link loadWalletSdk}.
 */
export type WalletSdkLoader = () => Promise<WalletSdk>;

/** Current SDK connection, or `null` when disconnected. */
let connection: WalletConnection | null = null;

/** Monotonic run counter; latest connect/disconnect wins. */
let runCounter = 0;

/** Monotonic balance-read counter; only the latest read may write the store. */
let balanceReadCounter = 0;

/**
 * Maximum wait for a connect attempt once the wallet code is loaded:
 * connecting and the first synchronized balance read. Downloading the wallet
 * code is not part of it.
 */
export const WALLET_CONNECT_TIMEOUT_MS = 30_000;

/**
 * Loaders that have loaded the wallet code in this page. A connect with one
 * of them does not show the download state, because the code is already there.
 */
const loadedLoaders = new WeakSet<WalletSdkLoader>();

/** Counter value of the read that last wrote the store balance. */
let writtenReadCounter = 0;

/** Nominal pause before the first automatic retry after a failed open. */
export const WALLET_RETRY_BASE_MS = 2_000;

/** Longest nominal pause between two automatic retries. */
export const WALLET_RETRY_CAP_MS = 60_000;

/**
 * Share of the nominal pause that jitter may take away: each pause is the
 * nominal one times a random factor between `1 - WALLET_RETRY_JITTER` and 1,
 * so tabs that failed together do not retry together and no pause exceeds
 * {@link WALLET_RETRY_CAP_MS}.
 */
export const WALLET_RETRY_JITTER = 0.2;

/**
 * Longest wait for the failed connection to finish disconnecting before the
 * pause of the next retry starts anyway, so a disconnect that never settles
 * cannot hold the retries back.
 */
export const WALLET_RETRY_DISCONNECT_WAIT_MS = 5_000;

/**
 * Automatic retries after the wallet failed, from the first failure until the
 * wallet is ready, the member presses **Try again**, or the wallet is
 * disconnected. There is no attempt limit.
 */
interface RetryCycle {
  /** Failures since the cycle started or since a trigger reset the backoff. */
  failures: number;
  /**
   * Timer of the next retry, or, while the failed connection is closing, of
   * the end of the wait for it; `null` while a retry runs or the cycle waits
   * for a trigger.
   */
  timer: ReturnType<typeof setTimeout> | null;
  /** True while a retry's connect attempt is running. */
  attempting: boolean;
  /**
   * The disconnect of the failed connection, from the failure until it has
   * finished or {@link WALLET_RETRY_DISCONNECT_WAIT_MS} have passed; `null`
   * otherwise. No retry is planned or started meanwhile.
   */
  closing: Promise<void> | null;
}

/** The retry cycle in progress, or `null`. */
let retryCycle: RetryCycle | null = null;

/** Loader of the last connect call, which the automatic retries use; `null` before the first call. */
let retryLoadSdk: WalletSdkLoader | null = null;

/**
 * True once a failed open was reported, until the wallet is ready again or is
 * disconnected. While it is set, later failures are not reported.
 */
let openFailureReported = false;

/**
 * Balance reads (`getInfo`) of the current connection still running, so an
 * announcement can wait for the newest balance. Cleared when the connection drops.
 */
const readsInFlight = new Set<Promise<unknown>>();

/**
 * Keeps a running balance read in {@link readsInFlight} until it settles.
 *
 * @param read - The `getInfo` promise.
 * @returns The same promise.
 */
function trackRead<T>(read: Promise<T>): Promise<T> {
  readsInFlight.add(read);
  const settled = (): void => {
    readsInFlight.delete(read);
  };
  read.then(settled, settled);
  return read;
}

/** How many of the newest payments count as known when a wallet connects. */
const KNOWN_PAYMENTS_LIMIT = 100;

/**
 * Ids of the received payments that were already completed when the current
 * connection opened, plus every payment announced since. `null` until that
 * first list was read: payment events before it are not announced.
 */
let knownPaymentIds: Set<string> | null = null;

/** Listeners told about each newly received payment. */
const incomingListeners = new Set<(payment: WalletPayment) => void>();

/** Listeners told about each newly received payment at once, before the balance is read again. */
const receivedListeners = new Set<(payment: WalletPayment) => void>();

/**
 * Received payments that completed while the known payments of the current
 * connection were still being read; announced once that list is in, unless
 * it holds them.
 */
let heldPayments: WalletPayment[] = [];

/**
 * The received payments the {@link onPaymentReceived} listeners heard, by id
 * in the order told, with the phrase they belong to: whichever way a payment
 * is reported or listed, and across reconnects, they hear it once, and a
 * listener that subscribes later hears them all first. Another phrase starts
 * it over. A sign-out forgets them only when it is still the latest run.
 */
let toldReceived: { mnemonic: string; payments: Map<string, WalletPayment> } | null = null;

/**
 * Tells every {@link onPaymentReceived} listener about `payment`, unless they
 * already heard it for this phrase.
 *
 * @param mnemonic - Phrase of the connection that reports it.
 * @param payment - The received, completed payment.
 */
function tellReceived(mnemonic: string, payment: WalletPayment): void {
  if (toldReceived === null || toldReceived.mnemonic !== mnemonic) {
    toldReceived = { mnemonic, payments: new Map() };
  }
  if (toldReceived.payments.has(payment.id)) {
    return;
  }
  toldReceived.payments.set(payment.id, payment);
  for (const listener of receivedListeners) {
    listener(payment);
  }
}

/**
 * Host the app is served from. The wallet's address lives on this host, and
 * the app forwards the wallet's address calls to the api. It is the domain
 * every wallet of this app connects and signs with.
 *
 * @returns `window.location.host`.
 */
export function appHost(): string {
  return window.location.host;
}

/**
 * Advances the run counter so in-flight work from an older run is ignored.
 *
 * @returns The new run number.
 */
function bumpRun(): number {
  runCounter += 1;
  return runCounter;
}

/**
 * Pause before the retry that follows the given number of failures: the base
 * doubled per failure, capped, minus the jitter.
 *
 * @param failures - Failures so far in this backoff run.
 * @returns The pause in milliseconds.
 */
function retryDelayMs(failures: number): number {
  const nominal = Math.min(WALLET_RETRY_CAP_MS, WALLET_RETRY_BASE_MS * 2 ** failures);
  return Math.round(nominal * (1 - WALLET_RETRY_JITTER * Math.random()));
}

/**
 * Writes whether an automatic retry is on its way to the store: a cycle is in
 * progress.
 */
function syncRetrying(): void {
  const retrying = retryCycle !== null;
  if (useWalletStore.getState().retrying !== retrying) {
    useWalletStore.getState().setRetrying(retrying);
  }
}

/**
 * Ends the retry cycle: clears its timer and removes its listeners. A retry
 * attempt that is still running is not stopped here; the run counter does that.
 */
function endRetryCycle(): void {
  const cycle = retryCycle;
  if (cycle === null) {
    return;
  }
  if (cycle.timer !== null) {
    clearTimeout(cycle.timer);
  }
  retryCycle = null;
  window.removeEventListener('online', onRetryTrigger);
  document.removeEventListener('visibilitychange', onRetryTrigger);
  syncRetrying();
}

/**
 * Starts the timer of the next retry and counts the failure that led to it.
 *
 * @param cycle - The cycle in progress.
 */
function armRetry(cycle: RetryCycle): void {
  const delay = retryDelayMs(cycle.failures);
  cycle.failures += 1;
  cycle.attempting = false;
  cycle.timer = setTimeout(runRetry, delay);
  syncRetrying();
}

/**
 * Plans the next automatic retry after the wallet failed, starting a cycle
 * when none is in progress. The cycle exists at once (the store shows
 * `retrying`), but the pause before the retry only starts once the failed
 * connection has finished disconnecting, or after
 * {@link WALLET_RETRY_DISCONNECT_WAIT_MS} when it has not by then; until then
 * no trigger starts a retry either, so the next connection does not open
 * beside one that is still closing, and a disconnect that never settles
 * cannot hold the retries back. Without a key or a tab phrase there is
 * nothing to retry and a cycle in progress ends.
 *
 * @param dropped - Settles when the failed connection has finished disconnecting.
 */
function scheduleRetry(dropped: Promise<void>): void {
  if (getBreezApiKey() === null || peekSessionPhrase() === null) {
    endRetryCycle();
    return;
  }
  if (retryCycle === null) {
    retryCycle = { failures: 0, timer: null, attempting: false, closing: null };
    window.addEventListener('online', onRetryTrigger);
    document.addEventListener('visibilitychange', onRetryTrigger);
  }
  const cycle = retryCycle;
  cycle.attempting = false;
  cycle.closing = dropped;
  const startPause = (): void => {
    // Ended or replaced meanwhile (sign-out, Try again, a ready wallet), or
    // this wait is already over: nothing to plan.
    if (retryCycle !== cycle || cycle.closing !== dropped) {
      return;
    }
    clearTimeout(wait);
    cycle.closing = null;
    armRetry(cycle);
  };
  const wait = setTimeout(startPause, WALLET_RETRY_DISCONNECT_WAIT_MS);
  cycle.timer = wait;
  syncRetrying();
  void dropped.then(startPause);
}

/**
 * True while a retry must not start: the tab is hidden or the browser is
 * offline. The cycle then waits for `visibilitychange` or `online`.
 *
 * @returns Whether to wait for a trigger.
 */
function retryMustWait(): boolean {
  return document.visibilityState === 'hidden' || !navigator.onLine;
}

/**
 * Runs the retry whose pause is over: a quiet connect attempt that leaves the
 * store at `error` until it succeeds. Waits for a trigger while the tab is
 * hidden or offline.
 */
function runRetry(): void {
  const cycle = retryCycle;
  const loadSdk = retryLoadSdk;
  /* v8 ignore next 3 -- the timer is cleared whenever the cycle ends, and a cycle only follows a connect call */
  if (cycle === null || loadSdk === null) {
    return;
  }
  cycle.timer = null;
  if (getBreezApiKey() === null || peekSessionPhrase() === null) {
    endRetryCycle();
    return;
  }
  if (retryMustWait()) {
    return;
  }
  cycle.attempting = true;
  syncRetrying();
  void openWallet(loadSdk, true);
}

/**
 * Handles `online` and `visibilitychange` during a retry cycle: once the tab
 * is visible and online, the backoff starts again and the retry runs at once,
 * unless one is already running or the failed connection is still closing.
 */
function onRetryTrigger(): void {
  const cycle = retryCycle;
  /* v8 ignore next 3 -- the listeners are removed whenever the cycle ends */
  if (cycle === null) {
    return;
  }
  if (retryMustWait()) {
    return;
  }
  cycle.failures = 0;
  if (cycle.attempting || cycle.closing !== null) {
    return;
  }
  if (cycle.timer !== null) {
    clearTimeout(cycle.timer);
  }
  runRetry();
}

/**
 * Writes a read balance to the store as ready. A ready wallet ends the retry
 * cycle, and its next failed open is reported again.
 *
 * @param balanceSats - Confirmed balance in satoshis.
 * @param identityPubkey - Wallet identity public key.
 */
function markReady(balanceSats: number, identityPubkey: string): void {
  openFailureReported = false;
  useWalletStore.getState().setReady(balanceSats, identityPubkey);
  endRetryCycle();
}

/**
 * Drops the current connection handle and disconnects it. Errors are swallowed.
 * The handle is cleared and the disconnect is started before the first await.
 *
 * @returns Resolves after disconnect completes or fails.
 */
async function dropConnection(): Promise<void> {
  const current = connection;
  connection = null;
  knownPaymentIds = null;
  heldPayments = [];
  // A read of the dropped connection may never answer; announcements of the next one do not wait for it.
  readsInFlight.clear();
  if (current === null) {
    return;
  }
  try {
    await current.disconnect();
  } catch {
    // Dropped either way.
  }
}

/**
 * Reads balance from a connection when the captured run is still current and
 * this read is still the latest. A stale read returns without writing. A
 * rejection of a stale read is swallowed; a rejection of the latest read under
 * the current run propagates to the caller.
 *
 * @param run - Run number captured by the caller.
 * @param conn - Connection to query.
 * @param options - Set `ensureSynced` for the first read after connecting.
 * @returns Resolves after `setReady` or when the run or read is stale.
 */
async function readBalance(
  run: number,
  conn: WalletConnection,
  options?: { ensureSynced?: boolean },
): Promise<void> {
  balanceReadCounter += 1;
  const read = balanceReadCounter;
  try {
    const info = await trackRead(
      options?.ensureSynced === true ? conn.getInfo({ ensureSynced: true }) : conn.getInfo(),
    );
    if (run !== runCounter || read !== balanceReadCounter) {
      return;
    }
    writtenReadCounter = read;
    markReady(info.balanceSats, info.identityPubkey);
  } catch (err: unknown) {
    if (run !== runCounter || read !== balanceReadCounter) {
      return;
    }
    throw err;
  }
}

/**
 * Marks the store as error, starts closing the connection, and plans the
 * next automatic retry when `run` is still current. The store write, the
 * start of the disconnect, and the retry plan are synchronous so a concurrent
 * logout or reconnect cannot be overwritten after disconnect awaits; the
 * retry itself waits until the disconnect has finished.
 *
 * @param run - Run number that owns this failure.
 * @returns Resolves after disconnect completes or fails.
 */
async function failRun(run: number): Promise<void> {
  if (run !== runCounter) {
    return;
  }
  bumpRun();
  useWalletStore.getState().setError();
  // The disconnect starts first, so the retry plan waits for it.
  const dropped = dropConnection();
  scheduleRetry(dropped);
  await dropped;
}

/**
 * Reports a wallet that did not open: `Wallet did not open` to error reporting
 * (a no-op while it is off; one issue per reason) and the member event
 * `wallet_open_failed` (dropped without a session). Only the first failure is
 * reported: nothing more goes out until the wallet has been ready again or
 * was disconnected, so the automatic retries and **Try again** stay silent.
 *
 * @param reason - `timeout` after the connect deadline, `error` when loading,
 *   connecting, or the first read failed.
 */
function reportWalletOpenFailure(reason: 'timeout' | 'error'): void {
  if (openFailureReported) {
    return;
  }
  openFailureReported = true;
  captureMessage('Wallet did not open', {
    level: 'error',
    fingerprint: ['wallet-open-failed', reason],
    tags: { wallet_open_reason: reason },
  });
  logInteraction('wallet_open_failed', { reason });
}

/**
 * Reads the payments a fresh connection already holds, so that only a payment
 * that completes later is announced. A payment that completed while this list
 * was read is announced once it is in, unless the list holds it. A failed
 * read counts as none known and drops the payments held meanwhile for the
 * {@link onIncomingPayment} listeners: the SDK announces only payments that
 * change, so nothing old is announced then. The {@link onPaymentReceived}
 * listeners heard each of them when it was reported. Every listed payment
 * is told to the {@link onPaymentReceived} listeners too, oldest first and
 * once per phrase: one that completed while no connection was open (before
 * the first, or while the wallet reconnected) reaches a till only this way.
 *
 * @param run - Run number that owns the connection.
 * @param conn - The fresh connection.
 * @param mnemonic - Phrase the connection was opened with.
 * @returns Resolves once the known ids are set, or when the run is stale.
 */
async function rememberKnownPayments(
  run: number,
  conn: WalletConnection,
  mnemonic: string,
): Promise<void> {
  let listed: WalletPayment[] = [];
  let read = false;
  try {
    const payments = await conn.listPayments({ offset: 0, limit: KNOWN_PAYMENTS_LIMIT });
    listed = payments.filter(
      (payment) => payment.direction === 'received' && payment.status === 'completed',
    );
    read = true;
  } catch {
    // None known; see above.
  }
  if (run !== runCounter || connection !== conn) {
    return;
  }
  const known = new Set(listed.map((payment) => payment.id));
  knownPaymentIds = known;
  const held = heldPayments;
  heldPayments = [];
  // No event reports a payment that completed while no connection was open: a till waiting for it
  // hears it from the list (it takes none made before its charge, so an old one does no harm).
  for (const payment of [...listed].reverse()) {
    tellReceived(mnemonic, payment);
  }
  if (read) {
    for (const payment of held) {
      if (known.has(payment.id)) {
        // The list holds it: not announced as new. The onPaymentReceived listeners heard it when it
        // was reported.
        continue;
      }
      void announcePayment(known, mnemonic, payment);
    }
  }
}

/**
 * Announces a newly received payment once per id: adds it to the known ids,
 * tells every {@link onPaymentReceived} listener at once, reads the balance again, and once that read and any newer one are done
 * (a newer read makes this one stale, and only the newest writes) tells every
 * {@link onIncomingPayment} listener, so a listener that shows the balance
 * never shows the one from before the payment. Those listeners are not told
 * when the connection ended meanwhile (sign-out, or a failed read that drops
 * it); the {@link onPaymentReceived} listeners were told before the read.
 *
 * @param known - The known payment ids of the current connection.
 * @param mnemonic - Phrase of that connection.
 * @param payment - The received, completed payment.
 * @returns Resolves after the listeners were told, or when the connection ended.
 */
async function announcePayment(
  known: Set<string>,
  mnemonic: string,
  payment: WalletPayment,
): Promise<void> {
  if (known.has(payment.id)) {
    return;
  }
  known.add(payment.id);
  tellReceived(mnemonic, payment);
  await refreshWallet();
  while (readsInFlight.size > 0) {
    await Promise.allSettled(readsInFlight);
  }
  if (knownPaymentIds !== known) {
    return;
  }
  for (const listener of incomingListeners) {
    listener(payment);
  }
}

/**
 * Handles one SDK event of the current connection: a sync reads the balance
 * again, and a received payment that just completed is announced to the
 * {@link onIncomingPayment} listeners and read into the balance, once per
 * payment id; one that completes before the payments known at connect were
 * read is held until that list is in.
 *
 * @param event - The SDK event.
 * @param mnemonic - Phrase of the connection that sent it.
 */
function onWalletEvent(event: WalletSdkEvent, mnemonic: string): void {
  if (event.type === 'synced') {
    void refreshWallet();
    return;
  }
  const payment = event.payment;
  if (
    event.type !== 'paymentSucceeded' ||
    payment === undefined ||
    payment.direction !== 'received' ||
    payment.status !== 'completed'
  ) {
    return;
  }
  if (knownPaymentIds === null) {
    heldPayments.push(payment);
    // A till waiting for it hears it now, not only once the known payments are read; it takes no
    // payment made before its charge, so one the wallet already held does no harm.
    tellReceived(mnemonic, payment);
    return;
  }
  void announcePayment(knownPaymentIds, mnemonic, payment);
}

/**
 * Subscribes to received payments that complete while the wallet is open in
 * this tab: never one the wallet already held when it connected, and each
 * payment id once.
 *
 * @param listener - Called with each newly received payment.
 * @returns Unsubscribe function.
 */
export function onIncomingPayment(listener: (payment: WalletPayment) => void): () => void {
  incomingListeners.add(listener);
  return () => {
    incomingListeners.delete(listener);
  };
}

/**
 * Subscribes to every received, completed payment of the signed-in wallet,
 * each id once: the moment the SDK reports it, before the balance is read
 * again (also while the known payments of the connection are still read),
 * and each payment a connection lists when it opens, oldest first, so one
 * that completed while no connection was open is heard too. A new listener
 * first hears the payments told so far. Unlike {@link onIncomingPayment},
 * old payments are included: the listener judges which one it waits for. For
 * a screen that must react to the money arriving without waiting for the
 * balance read.
 *
 * @param listener - Called with each received payment.
 * @returns Unsubscribe function.
 */
export function onPaymentReceived(listener: (payment: WalletPayment) => void): () => void {
  // Only the payments of the wallet signed in now.
  if (toldReceived !== null && toldReceived.mnemonic === peekSessionPhrase()) {
    for (const payment of toldReceived.payments.values()) {
      listener(payment);
    }
  }
  receivedListeners.add(listener);
  return () => {
    receivedListeners.delete(listener);
  };
}

/**
 * In a Playwright build only (`getE2eNow()`), tells every
 * {@link onPaymentReceived} listener about `payment` as if the wallet had just
 * reported it, so e2e drives a screen that waits for the money through the
 * same listener without a wallet. Does nothing in any other build.
 *
 * @param payment - The received, completed payment to report.
 */
export function announceReceivedForE2e(payment: WalletPayment): void {
  if (getE2eNow() === null) {
    return;
  }
  for (const listener of receivedListeners) {
    listener(payment);
  }
}

/**
 * One connect attempt; see {@link connectWallet}. A quiet attempt is an
 * automatic retry: the store stays at `error` while it runs and only a
 * success changes it.
 *
 * @param loadSdk - SDK loader.
 * @param quiet - Whether this is an automatic retry.
 * @returns Resolves when the attempt succeeded or failed, is superseded, or reaches its deadline.
 */
async function openWallet(loadSdk: WalletSdkLoader, quiet: boolean): Promise<void> {
  const apiKey = getBreezApiKey();
  const mnemonic = peekSessionPhrase();
  /* v8 ignore next 3 -- both callers checked the key and the phrase */
  if (apiKey === null || mnemonic === null) {
    return;
  }
  const run = bumpRun();
  const waiting = quiet ? 'error' : 'connecting';
  if (!quiet) {
    useWalletStore.getState().setConnecting();
  }
  void dropConnection();
  const store = useWalletStore.getState();
  if (!quiet && !loadedLoaders.has(loadSdk)) {
    store.setDownloading(true);
  }
  let sdk: WalletSdk;
  try {
    // No deadline here: a slow download keeps going and is shared with every retry.
    sdk = await traceWallet('wallet.sdk.load', loadSdk);
  } catch {
    if (run === runCounter) {
      reportWalletOpenFailure('error');
    }
    await failRun(run);
    return;
  }
  loadedLoaders.add(loadSdk);
  if (run !== runCounter) {
    return;
  }
  store.setDownloading(false);
  const timeoutSentinel = Symbol('connect timeout');
  let timeout!: ReturnType<typeof setTimeout>;
  const deadline = new Promise<typeof timeoutSentinel>((resolve) => {
    timeout = setTimeout(() => {
      resolve(timeoutSentinel);
    }, WALLET_CONNECT_TIMEOUT_MS);
  });
  const attempt = (async (): Promise<void> => {
    try {
      const next = await traceWallet('wallet.connect', () =>
        sdk.connect(mnemonic, apiKey, appHost()),
      );
      if (run !== runCounter) {
        try {
          await next.disconnect();
        } catch {
          // Superseded connection is closed best-effort.
        }
        return;
      }
      connection = next;
      await next.addEventListener((event) => {
        if (run === runCounter && connection === next) {
          onWalletEvent(event, mnemonic);
        }
      });
      if (run !== runCounter) {
        return;
      }
      await traceWallet('wallet.sync.first', () => readBalance(run, next, { ensureSynced: true }));
      void rememberKnownPayments(run, next, mnemonic);
    } catch {
      if (run === runCounter) {
        reportWalletOpenFailure('error');
      }
      await failRun(run);
    }
  })();
  const result: void | typeof timeoutSentinel = await Promise.race([attempt, deadline]);
  if (result !== timeoutSentinel) {
    if (run !== runCounter || useWalletStore.getState().status !== waiting) {
      clearTimeout(timeout);
      return;
    }
    await deadline;
  }
  if (run === runCounter && useWalletStore.getState().status === waiting) {
    reportWalletOpenFailure('timeout');
    void failRun(run);
  }
}

/**
 * Connects the in-app wallet from the tab phrase and Breez API key. The wallet
 * code is downloaded first, without a deadline: while it downloads for the
 * first time in this page the store is `connecting` with `downloading` set,
 * and a retry or a second call waits on the same download instead of starting
 * another. Connecting and the first synchronized balance read then share the
 * {@link WALLET_CONNECT_TIMEOUT_MS} deadline. A timeout moves a
 * still-connecting wallet to `error`, but leaves a wallet made ready by a
 * synchronized refresh unchanged. A failed download is a failed open like any
 * other; the next attempt downloads again in the same page. No-ops when either
 * input is missing. Never rejects; failures end in the store.
 *
 * After a failure the wallet is opened again automatically, without an
 * attempt limit, for as long as the tab holds the phrase and the key: the
 * first retry about {@link WALLET_RETRY_BASE_MS} later, each pause twice the
 * one before up to {@link WALLET_RETRY_CAP_MS}, each shortened by up to
 * {@link WALLET_RETRY_JITTER} of itself. A pause starts once the failed
 * connection has finished disconnecting, at the latest
 * {@link WALLET_RETRY_DISCONNECT_WAIT_MS} after the failure. Between and during those retries
 * the store stays at `error` with `retrying` set, so screens keep the
 * could-not-be-opened state with **Try again**, and a retry that succeeds
 * makes the store `ready`. While the tab is hidden or the browser is offline
 * no retry starts; `visibilitychange` and `online` start one at once and
 * begin the backoff again. Calling this function (also from **Try again**)
 * ends the retries in progress and starts over; {@link disconnectWallet} and
 * a ready wallet end them.
 *
 * The first failure is reported as `wallet_open_failed` (`error`, or
 * `timeout` at the deadline) and `Wallet did not open`; later failures are
 * not reported until the wallet has been ready again or was disconnected.
 *
 * @param loadSdk - SDK loader; defaults to {@link loadWalletSdk}.
 * @returns Resolves when the attempt leaves `connecting`, is superseded, or reaches its deadline.
 */
export async function connectWallet(loadSdk: WalletSdkLoader = loadWalletSdk): Promise<void> {
  if (getBreezApiKey() === null || peekSessionPhrase() === null) {
    return;
  }
  retryLoadSdk = loadSdk;
  endRetryCycle();
  await openWallet(loadSdk, false);
}

/**
 * Refreshes the balance on the current connection with a plain read, or a
 * read after the wallet has synced. No-ops without a connection. When reads
 * overlap only the latest one writes. Never rejects; a failure while current
 * ends in the store and starts the automatic retries of {@link connectWallet},
 * unless `ignoreFailure` is set: then a failed read changes nothing and the
 * wallet stays as it is.
 *
 * @param options - Set `ensureSynced` to read after the wallet has synced, so
 *   a payment that arrived without a wallet event is counted. Set
 *   `ignoreFailure` for a repeated read whose next try follows on its own.
 * @returns Resolves when the refresh finishes or is skipped.
 */
export async function refreshWallet(options?: {
  ensureSynced?: boolean;
  ignoreFailure?: boolean;
}): Promise<void> {
  const run = runCounter;
  const conn = connection;
  if (conn === null) {
    return;
  }
  try {
    await traceWallet('wallet.balance', () => readBalance(run, conn, options));
  } catch {
    if (options?.ignoreFailure !== true) {
      await failRun(run);
    }
  }
}

/**
 * Disconnects the wallet, resets the store to its resting status, and invalidates
 * in-flight work, including the automatic retries after a failed open: their
 * timer and listeners are removed. When this sign-out is still the latest run
 * after the handle drops, it forgets the payments told to the
 * {@link onPaymentReceived} listeners, so the next sign-in starts over. A
 * sign-in that already replaced this run keeps the payments it told. Never
 * rejects.
 *
 * @returns Resolves after the handle is dropped.
 */
export async function disconnectWallet(): Promise<void> {
  const run = bumpRun();
  endRetryCycle();
  openFailureReported = false;
  useWalletStore.getState().reset();
  await dropConnection();
  // A sign-in that overlapped this sign-out already told its payments.
  if (run === runCounter) {
    toldReceived = null;
  }
}

/**
 * Subscribes to tab-phrase changes and connects or disconnects the wallet.
 * With no Breez API key, returns a no-op unsubscribe and adds no listener.
 *
 * @param loadSdk - SDK loader forwarded to {@link connectWallet}.
 * @returns Unsubscribe function.
 */
export function listenForWalletPhrase(loadSdk: WalletSdkLoader = loadWalletSdk): () => void {
  if (getBreezApiKey() === null) {
    return () => {
      // No-op when the wallet is disabled.
    };
  }
  const onPhrase = (): void => {
    if (peekSessionPhrase() === null) {
      void disconnectWallet();
    } else {
      void connectWallet(loadSdk);
    }
  };
  window.addEventListener(SESSION_PHRASE_EVENT, onPhrase);
  if (peekSessionPhrase() !== null) {
    void connectWallet(loadSdk);
  }
  return () => {
    window.removeEventListener(SESSION_PHRASE_EVENT, onPhrase);
  };
}

/**
 * Waits until the wallet store leaves `connecting`.
 *
 * @returns The identity public key when the wallet is ready, otherwise `null`.
 */
function settledIdentity(): Promise<string | null> {
  return new Promise((resolve) => {
    const settle = (state: ReturnType<typeof useWalletStore.getState>): boolean => {
      if (state.status === 'connecting') {
        return false;
      }
      resolve(state.status === 'ready' ? state.identityPubkey : null);
      return true;
    };
    if (settle(useWalletStore.getState())) {
      return;
    }
    const unsubscribe = useWalletStore.subscribe((state) => {
      if (settle(state)) {
        unsubscribe();
      }
    });
  });
}

/**
 * Makes sure the wallet is connected from the tab phrase, reusing a ready or
 * in-flight connection, and returns its identity public key.
 *
 * @param loadSdk - SDK loader forwarded to {@link connectWallet}.
 * @returns The wallet identity public key.
 * @throws Error `wallet-connect` when the wallet could not be opened (no key,
 * no tab phrase, or a failed connection).
 */
export async function ensureWalletConnected(
  loadSdk: WalletSdkLoader = loadWalletSdk,
): Promise<string> {
  const status = useWalletStore.getState().status;
  if (status !== 'ready' && status !== 'connecting') {
    await connectWallet(loadSdk);
  }
  const identity = await settledIdentity();
  if (identity === null || connection === null) {
    throw new Error('wallet-connect');
  }
  return identity;
}

/**
 * Reads the Spark address of the signed-in member's wallet, opening the
 * wallet from the tab phrase first when it is not open yet.
 *
 * @param loadSdk - SDK loader forwarded to {@link ensureWalletConnected}.
 * @returns The wallet's Spark address.
 * @throws Error `wallet-connect` when the wallet could not be opened or closed
 *   meanwhile; otherwise the SDK's error.
 */
export async function receiveWalletSparkAddress(
  loadSdk: WalletSdkLoader = loadWalletSdk,
): Promise<string> {
  await ensureWalletConnected(loadSdk);
  const conn = connection;
  if (conn === null) {
    throw new Error('wallet-connect');
  }
  return conn.receiveSparkAddress();
}

/**
 * Registers the account's username as the address of the connected wallet.
 * Never asks whether a name is free: only the account's own username is sent.
 *
 * @param username - The account's username.
 * @returns Resolves once the registration was accepted.
 * @throws Error `wallet-connect` without a connection; otherwise the SDK's error.
 */
export async function registerWalletAddress(username: string): Promise<void> {
  const conn = connection;
  if (conn === null) {
    throw new Error('wallet-connect');
  }
  await traceWallet('wallet.address.register', () => conn.registerAddress(username));
}

/**
 * Lists the connected wallet's Bitcoin payments, newest first.
 *
 * @param page - Offset and limit.
 * @returns The payments on that page.
 * @throws Error `wallet-connect` without a connection; otherwise the SDK's error.
 */
export async function listWalletPayments(page: WalletPaymentPage): Promise<WalletPayment[]> {
  const conn = connection;
  if (conn === null) {
    throw new Error('wallet-connect');
  }
  return conn.listPayments(page);
}

/**
 * Reads one payment of the connected wallet.
 *
 * @param id - SDK payment id.
 * @returns The payment.
 * @throws Error `wallet-connect` while no wallet is connected; the SDK's error for an unknown id.
 */
export async function getWalletPayment(id: string): Promise<WalletPayment> {
  const conn = connection;
  if (conn === null) {
    throw new Error('wallet-connect');
  }
  return conn.getPayment(id);
}

/**
 * Lists the connected wallet's Bitcoin payments, newest first, in the shape
 * the wallet data report sends.
 *
 * @param page - Offset and limit.
 * @returns The payments on that page.
 * @throws Error `wallet-connect` without a connection; otherwise the SDK's error.
 */
export async function listWalletReportPayments(
  page: WalletPaymentPage,
): Promise<WalletReportPayment[]> {
  const conn = connection;
  if (conn === null) {
    throw new Error('wallet-connect');
  }
  return conn.listReportPayments(page);
}

/** How long a send may take before the app stops waiting for the SDK. */
export const WALLET_SEND_TIMEOUT_MS = 30_000;

/**
 * Outcome of sending a prepared payment.
 *
 * - `paid`: the SDK reported the payment sent.
 * - `insufficient`: the wallet balance does not cover amount and fee.
 * - `failed`: the send failed, timed out, or the wallet changed since prepare.
 *   The payment may still arrive; callers do not retry on their own. After a
 *   timeout, `sentLate` resolves `true` once the SDK still reports the send
 *   (the payment went out), or `false` when it fails.
 * - `expired`: the fee quote of a payment to a base-chain address expired;
 *   nothing was sent, and only a new prepare gives a quote to send.
 *
 * Every outcome but `paid` carries `failure`: stage, reason, method, amount,
 * and fee for {@link reportPaymentFailure}. The caller reports it once it
 * knows the payment did not go out (it may prepare again instead).
 */
export type WalletSendResult =
  | { kind: 'paid' }
  | { kind: 'insufficient'; failure: PaymentFailure }
  | { kind: 'failed'; failure: PaymentFailure; sentLate?: Promise<boolean> }
  | { kind: 'expired'; failure: PaymentFailure };

/**
 * Fee choice of a prepared payment to a base-chain address: the fee of each
 * speed, and the largest fee the balance still covers on top of the amount.
 */
export interface WalletOnchainFees {
  /** Whole sats of fee for each speed. */
  fees: Record<OnchainSpeed, number>;
  /** Balance minus amount, in whole sats: a speed whose fee is higher cannot be sent. */
  spendableFeeSats: number;
}

/**
 * Outcome of preparing a payment from the in-app wallet.
 *
 * - `confirm`: amount and fee to show; `send` pays it once. A payment to a
 *   base-chain address also carries `onchain`, and `feeSats` is its medium
 *   speed; `send` then takes the chosen speed. `method` is how it moves.
 * - `insufficient`: the balance does not cover amount and fee (for a
 *   base-chain address: amount and the lowest fee); `feeSats` is that fee
 *   when the prepare succeeded and only the balance fell short.
 * - `belowMinimum`: the SDK refused the amount as below the smallest it sends
 *   to this address; `minSats` is that smallest amount.
 * - `failed`: prepare or the balance read failed, or the connection changed
 *   during prepare or that read.
 * - `unlock`: no wallet connection yet (the phrase is not in tab memory).
 *
 * Every outcome but `confirm` carries `failure` (stage `prepare`) for
 * {@link reportPaymentFailure}.
 */
export type WalletPayResult =
  | {
      kind: 'confirm';
      amountSats: number;
      feeSats: number;
      method: PayMethod;
      onchain?: WalletOnchainFees;
      send: (speed?: OnchainSpeed) => Promise<WalletSendResult>;
    }
  | { kind: 'insufficient'; feeSats?: number; failure: PaymentFailure }
  | { kind: 'belowMinimum'; minSats: number; failure: PaymentFailure }
  | { kind: 'failed'; failure: PaymentFailure }
  | { kind: 'unlock'; failure: PaymentFailure };

/**
 * Outcome of reading a pasted text with {@link parseWalletInput}.
 *
 * - `target`: what the text pays (which may be `onchain` or `unsupported`).
 * - `unreachable`: the text names a receiver whose server did not answer
 *   this browser.
 * - `invalid`: not a payment request or address.
 * - `unlock`: no wallet connection, or it changed while the text was read.
 */
export type WalletParseResult =
  | { kind: 'target'; target: WalletTarget }
  | { kind: 'unreachable' }
  | { kind: 'invalid' }
  | { kind: 'unlock' };

/**
 * Text of an SDK rejection, read only to classify it and never reported: the
 * message of an `Error`, or a thrown string. Anything else, and a rejection
 * whose `message` cannot be read (a throwing getter), is the empty text, which
 * classifies as `sdk_error`. Nothing is converted with `String()`, so a
 * throwing `toString` cannot escape either.
 *
 * @param err - Rejection from the SDK.
 * @returns The text, or `''`.
 */
function errorText(err: unknown): string {
  if (typeof err === 'string') {
    return err;
  }
  try {
    return err instanceof Error && typeof err.message === 'string' ? err.message : '';
  } catch {
    return '';
  }
}

/**
 * True when an SDK error says the balance is too low.
 *
 * @param err - Rejection from the SDK.
 * @returns Whether the error names insufficient funds.
 */
function isInsufficientFunds(err: unknown): boolean {
  return /insufficient/i.test(errorText(err));
}

/**
 * Smallest amount an SDK error names, when it refuses an amount as below the
 * minimum for a base-chain address (`… below the minimum of 294 sats …`).
 *
 * @param err - Rejection from the SDK.
 * @returns Whole sats, or `null` when the error is not that refusal.
 */
function minimumOf(err: unknown): number | null {
  const match = /below the minimum of (\d+) sats/i.exec(errorText(err));
  return match === null ? null : Number(match[1]);
}

/**
 * True when an SDK error says a fee quote expired.
 *
 * @param err - Rejection from the SDK.
 * @returns Whether the error names an expired quote.
 */
function isQuoteExpired(err: unknown): boolean {
  return /quote[^.]*expired|expired[^.]*quote/i.test(errorText(err));
}

/**
 * Reason code of an SDK rejection, from the shape of its message. Never
 * returns the text itself. A refused minimum is read by `payFromWallet`
 * itself, since it carries the minimum. The balance moves of a social
 * recovery and of a previous wallet report their failed sends with it too.
 *
 * @param err - Rejection from the SDK.
 * @returns The reason.
 */
export function sdkFailureReason(err: unknown): PayReason {
  const text = errorText(err);
  if (isInsufficientFunds(err)) {
    return 'insufficient';
  }
  if (/expired/i.test(text)) {
    return 'expired';
  }
  if (/no route|route not found|unable to (?:find|route)|failed to (?:find|route)/i.test(text)) {
    return 'no_route';
  }
  if (/timeout|timed out/i.test(text)) {
    return 'timeout';
  }
  if (/^(?:network|connection|connect) error|failed to fetch|networkerror/i.test(text)) {
    return 'network';
  }
  if (/^lnurl error/i.test(text)) {
    return 'lnurl_error';
  }
  return 'sdk_error';
}

/**
 * How a payment request moves, read from the request before the SDK prepares
 * it: an LNURL receiver, a Spark invoice or address, a Lightning request
 * (also a BIP21 URI that offers one), or a base-chain address.
 *
 * @param request - Payment to prepare.
 * @returns The method, or `unknown`.
 */
function methodOf(request: WalletPayRequest): PayMethod {
  if (request.type === 'lnurl') {
    return 'lnurl';
  }
  const text = request.input.trim().toLowerCase();
  const bare = text.replace(/^(?:lightning|bitcoin):/, '');
  if (bare.startsWith('spark')) {
    return 'spark';
  }
  if (bare.startsWith('ln')) {
    return 'lightning';
  }
  if (text.startsWith('bitcoin:')) {
    return /[?&]lightning=/.test(text) ? 'lightning' : 'onchain';
  }
  return /^(?:bc1|tb1|bcrt1|[13mn2])[0-9a-z]{20,}$/.test(bare) ? 'onchain' : 'unknown';
}

/**
 * How long before its expiry a fee quote counts as expired, so a send never
 * reaches the SDK with a quote that runs out on the way.
 */
export const WALLET_QUOTE_MARGIN_MS = 15_000;

/**
 * Resolves with `null` after `ms`, or with the promise's value when it settles first.
 *
 * @param promise - Work to wait for.
 * @param ms - Time limit in milliseconds.
 * @returns The value, or `null` on timeout. Rejects when `promise` rejects first.
 */
async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<null>((resolve) => {
    timer = setTimeout(() => {
      resolve(null);
    }, ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * How a payment travels, for its trace spans, from its {@link methodOf}
 * method: an LNURL receiver is paid over Lightning, and a request the method
 * does not know is a short Spark address (`sp1…`) or else counts as base chain.
 *
 * @param request - Payment to prepare.
 * @param method - Its method.
 * @returns `spark`, `lightning`, or `onchain`.
 */
function payRoute(
  request: WalletPayRequest,
  method: PayMethod,
): NonNullable<WalletSpanAttributes['route']> {
  if (request.type === 'lnurl') {
    return 'lightning';
  }
  if (method === 'spark' || method === 'lightning' || method === 'onchain') {
    return method;
  }
  return /^sp(?:rt|t)?1/i.test(request.input.trim()) ? 'spark' : 'onchain';
}

/**
 * Prepares a payment from the in-app wallet and returns its amount and fee for
 * confirmation, checked against a balance read after the wallet has synced.
 * That read also updates the store while it is the latest read; when a newer
 * read already wrote the store, the check uses that newer balance, so the
 * check matches the balance shown. While a newer read is still pending, the
 * check uses this read. The returned `send` pays it once and then refreshes
 * the balance while its connection is still the current one. For a
 * base-chain address the balance must cover the amount and the lowest fee,
 * and `send` takes a speed: it refuses a speed the balance does not cover
 * (`insufficient`) and a quote within {@link WALLET_QUOTE_MARGIN_MS} of its
 * expiry (`expired`) without calling the SDK. Never rejects.
 *
 * @param request - Request text to pay, or a receiver that takes an amount.
 * @returns Confirmation with `send`, or why the payment cannot be made.
 */
export async function payFromWallet(request: WalletPayRequest): Promise<WalletPayResult> {
  const requestMethod = methodOf(request);
  const requestSats = request.amountSats ?? null;
  const prepareFailure = (
    reason: PayReason,
    error?: unknown,
    feeSats: number | null = null,
  ): PaymentFailure => ({
    stage: 'prepare',
    reason,
    method: requestMethod,
    amountSats: requestSats,
    feeSats,
    ...(error === undefined ? {} : { error }),
  });
  const conn = connection;
  if (conn === null) {
    return { kind: 'unlock', failure: prepareFailure('unlock') };
  }
  const route = payRoute(request, requestMethod);
  let prepared;
  try {
    prepared = await traceWallet('wallet.prepare', () => conn.prepare(request), { route });
  } catch (err: unknown) {
    if (connection !== conn) {
      return { kind: 'failed', failure: prepareFailure('disconnected', err) };
    }
    const minSats = minimumOf(err);
    if (minSats !== null) {
      return { kind: 'belowMinimum', minSats, failure: prepareFailure('below_minimum', err) };
    }
    const reason = sdkFailureReason(err);
    return reason === 'insufficient'
      ? { kind: 'insufficient', failure: prepareFailure('insufficient', err) }
      : { kind: 'failed', failure: prepareFailure(reason, err) };
  }
  const { amountSats, feeSats } = prepared;
  const quote = prepared.onchain;
  const method: PayMethod = quote === undefined ? requestMethod : 'onchain';
  const lowestFeeSats = quote === undefined ? feeSats : Math.min(...Object.values(quote.fees));
  const failureOf = (
    stage: PayStage,
    reason: PayReason,
    chosenFeeSats: number,
    error?: unknown,
  ): PaymentFailure => ({
    stage,
    reason,
    method,
    amountSats,
    feeSats: chosenFeeSats,
    ...(quote === undefined ? {} : { onchainFees: quote.fees }),
    ...(error === undefined ? {} : { error }),
  });
  let spendableFeeSats = 0;
  if (connection !== conn) {
    return { kind: 'failed', failure: failureOf('prepare', 'disconnected', feeSats) };
  }
  try {
    balanceReadCounter += 1;
    const read = balanceReadCounter;
    const info = await trackRead(conn.getInfo({ ensureSynced: true }));
    if (connection !== conn) {
      return { kind: 'failed', failure: failureOf('prepare', 'disconnected', feeSats) };
    }
    let balanceSats = info.balanceSats;
    if (read === balanceReadCounter) {
      writtenReadCounter = read;
      markReady(info.balanceSats, info.identityPubkey);
    } else if (writtenReadCounter > read) {
      /* v8 ignore next -- a newer read of this connection wrote a balance */
      balanceSats = useWalletStore.getState().balanceSats ?? info.balanceSats;
    }
    if (balanceSats < amountSats + lowestFeeSats) {
      return {
        kind: 'insufficient',
        feeSats: lowestFeeSats,
        failure: failureOf('prepare', 'insufficient', lowestFeeSats),
      };
    }
    spendableFeeSats = balanceSats - amountSats;
  } catch (err: unknown) {
    const reason = connection === conn ? 'balance_read' : 'disconnected';
    return { kind: 'failed', failure: failureOf('prepare', reason, feeSats, err) };
  }
  // The prepared method settles a guess from the text, such as a BIP21 URI paid over Lightning.
  const sendRoute = quote !== undefined ? 'onchain' : route === 'onchain' ? 'lightning' : route;
  let sent = false;
  const send = async (speed: OnchainSpeed = 'medium'): Promise<WalletSendResult> => {
    const chosenFeeSats = quote === undefined ? feeSats : quote.fees[speed];
    if (sent) {
      return { kind: 'failed', failure: failureOf('confirm', 'already_sent', chosenFeeSats) };
    }
    if (connection !== conn) {
      return { kind: 'failed', failure: failureOf('confirm', 'disconnected', chosenFeeSats) };
    }
    if (quote !== undefined) {
      if (chosenFeeSats > spendableFeeSats) {
        return {
          kind: 'insufficient',
          failure: failureOf('confirm', 'insufficient', chosenFeeSats),
        };
      }
      if (Date.now() >= quote.expiresAtMs - WALLET_QUOTE_MARGIN_MS) {
        return { kind: 'expired', failure: failureOf('confirm', 'expired', chosenFeeSats) };
      }
    }
    sent = true;
    const session = useAuthStore.getState().session;
    let result: WalletSendResult;
    const recordSent = (): void => {
      logInteraction(
        'payment_sent',
        { amountSats, feeSats: chosenFeeSats, onchain: quote !== undefined },
        session,
      );
    };
    try {
      const sending = traceWallet('wallet.send', () => prepared.send(speed), {
        route: sendRoute,
      });
      const done = await withTimeout(
        sending.then(() => true),
        WALLET_SEND_TIMEOUT_MS,
      );
      if (done === null) {
        // The app stopped waiting, but the SDK may still send it.
        const sentLate = sending.then(
          () => {
            recordSent();
            return true;
          },
          () => false,
        );
        result = {
          kind: 'failed',
          failure: failureOf('send', 'timeout', chosenFeeSats),
          sentLate,
        };
      } else {
        recordSent();
        result = { kind: 'paid' };
      }
    } catch (err: unknown) {
      if (quote !== undefined && isQuoteExpired(err)) {
        result = { kind: 'expired', failure: failureOf('send', 'expired', chosenFeeSats, err) };
      } else {
        const reason = sdkFailureReason(err);
        const failure = failureOf('send', reason, chosenFeeSats, err);
        result =
          reason === 'insufficient'
            ? { kind: 'insufficient', failure }
            : { kind: 'failed', failure };
      }
    }
    if (connection === conn) {
      void refreshWallet();
    }
    return result;
  };
  return quote === undefined
    ? { kind: 'confirm', amountSats, feeSats, method, send }
    : {
        kind: 'confirm',
        amountSats,
        feeSats,
        method,
        onchain: { fees: quote.fees, spendableFeeSats },
        send,
      };
}

/**
 * True when a text names a receiver by address or LNURL, so a parse failure
 * means its server was not reachable from this browser.
 *
 * @param text - Trimmed input.
 * @returns Whether the text looks like `name@domain` or an LNURL.
 */
function isReceiverServerName(text: string): boolean {
  const bare = text.replace(/^lightning:/i, '');
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(bare) || /^lnurl/i.test(bare);
}

/**
 * Reads a pasted payment request or address with the SDK's `parse`. Never rejects.
 *
 * @param text - Text as pasted.
 * @returns What the text pays, or why it cannot be read.
 */
export async function parseWalletInput(text: string): Promise<WalletParseResult> {
  const trimmed = text.trim();
  if (trimmed === '') {
    return { kind: 'invalid' };
  }
  const conn = connection;
  if (conn === null) {
    return { kind: 'unlock' };
  }
  let target: WalletTarget;
  try {
    target = await conn.parse(trimmed);
  } catch {
    if (connection !== conn) {
      return { kind: 'unlock' };
    }
    return isReceiverServerName(trimmed) ? { kind: 'unreachable' } : { kind: 'invalid' };
  }
  if (connection !== conn) {
    return { kind: 'unlock' };
  }
  return { kind: 'target', target };
}
