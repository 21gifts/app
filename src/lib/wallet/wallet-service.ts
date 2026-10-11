import { captureMessage } from '@sentry/nextjs';
import { getBreezApiKey } from '@/lib/config';
import { logInteraction } from '@/lib/interaction-log';
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

/** Maximum wait for a connect attempt. */
const CONNECT_TIMEOUT_MS = 30_000;

/** Counter value of the read that last wrote the store balance. */
let writtenReadCounter = 0;

/**
 * Host the app is served from. The wallet's address lives on this host, and
 * the app forwards the wallet's address calls to the api.
 *
 * @returns `window.location.host`.
 */
function appHost(): string {
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
 * Drops the current connection handle and disconnects it. Errors are swallowed.
 *
 * @returns Resolves after disconnect completes or fails.
 */
async function dropConnection(): Promise<void> {
  const current = connection;
  connection = null;
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
    const info =
      options?.ensureSynced === true
        ? await conn.getInfo({ ensureSynced: true })
        : await conn.getInfo();
    if (run !== runCounter || read !== balanceReadCounter) {
      return;
    }
    writtenReadCounter = read;
    useWalletStore.getState().setReady(info.balanceSats, info.identityPubkey);
  } catch (err: unknown) {
    if (run !== runCounter || read !== balanceReadCounter) {
      return;
    }
    throw err;
  }
}

/**
 * Marks the store as error and closes the connection when `run` is still current.
 * The store write is synchronous so a concurrent logout or reconnect cannot be
 * overwritten after disconnect awaits.
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
  await dropConnection();
}

/**
 * Reports a wallet that did not open: `Wallet did not open` to error reporting
 * (a no-op while it is off; one issue per reason) and the member event
 * `wallet_open_failed` (dropped without a session).
 *
 * @param reason - `timeout` after the connect deadline, `error` when loading,
 *   connecting, or the first read failed.
 */
function reportWalletOpenFailure(reason: 'timeout' | 'error'): void {
  captureMessage('Wallet did not open', {
    level: 'error',
    fingerprint: ['wallet-open-failed', reason],
    tags: { wallet_open_reason: reason },
  });
  logInteraction('wallet_open_failed', { reason });
}

/**
 * Connects the in-app wallet from the tab phrase and Breez API key. Loading the
 * SDK, connecting, and the first synchronized balance read share a 30-second
 * deadline. A timeout moves a still-connecting wallet to `error`, but leaves a
 * wallet made ready by a synchronized refresh unchanged. No-ops when either
 * input is missing. Never rejects; failures end in the store. A failure of
 * the attempt that is still current is reported as `wallet_open_failed`
 * (`error`, or `timeout` at the deadline) and `Wallet did not open`.
 *
 * @param loadSdk - SDK loader; defaults to {@link loadWalletSdk}.
 * @returns Resolves when the attempt leaves `connecting`, is superseded, or reaches its deadline.
 */
export async function connectWallet(loadSdk: WalletSdkLoader = loadWalletSdk): Promise<void> {
  const apiKey = getBreezApiKey();
  const mnemonic = peekSessionPhrase();
  if (apiKey === null || mnemonic === null) {
    return;
  }
  const run = bumpRun();
  useWalletStore.getState().setConnecting();
  void dropConnection();
  const timeoutSentinel = Symbol('connect timeout');
  let timeout!: ReturnType<typeof setTimeout>;
  const deadline = new Promise<typeof timeoutSentinel>((resolve) => {
    timeout = setTimeout(() => {
      resolve(timeoutSentinel);
    }, CONNECT_TIMEOUT_MS);
  });
  const attempt = (async (): Promise<void> => {
    try {
      const sdk = await loadSdk();
      if (run !== runCounter) {
        return;
      }
      const next = await sdk.connect(mnemonic, apiKey, appHost());
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
        if (event.type === 'synced' && run === runCounter && connection === next) {
          void refreshWallet();
        }
      });
      if (run !== runCounter) {
        return;
      }
      await readBalance(run, next, { ensureSynced: true });
    } catch {
      if (run === runCounter) {
        reportWalletOpenFailure('error');
      }
      await failRun(run);
    }
  })();
  const result: void | typeof timeoutSentinel = await Promise.race([attempt, deadline]);
  if (result !== timeoutSentinel) {
    if (run !== runCounter || useWalletStore.getState().status !== 'connecting') {
      clearTimeout(timeout);
      return;
    }
    await deadline;
  }
  if (run === runCounter && useWalletStore.getState().status === 'connecting') {
    reportWalletOpenFailure('timeout');
    void failRun(run);
  }
}

/**
 * Refreshes the balance on the current connection with a plain read, or a
 * read after the wallet has synced. No-ops without a connection. When reads
 * overlap only the latest one writes. Never rejects; a failure while current
 * ends in the store, unless `ignoreFailure` is set: then a failed read changes
 * nothing and the wallet stays as it is.
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
    await readBalance(run, conn, options);
  } catch {
    if (options?.ignoreFailure !== true) {
      await failRun(run);
    }
  }
}

/**
 * Disconnects the wallet, resets the store to its resting status, and invalidates
 * in-flight work. Never rejects.
 *
 * @returns Resolves after the handle is dropped.
 */
export async function disconnectWallet(): Promise<void> {
  bumpRun();
  useWalletStore.getState().reset();
  await dropConnection();
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
  await conn.registerAddress(username);
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
 * itself, since it carries the minimum.
 *
 * @param err - Rejection from the SDK.
 * @returns The reason.
 */
function sdkFailureReason(err: unknown): PayReason {
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
  let prepared;
  try {
    prepared = await conn.prepare(request);
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
    const info = await conn.getInfo({ ensureSynced: true });
    if (connection !== conn) {
      return { kind: 'failed', failure: failureOf('prepare', 'disconnected', feeSats) };
    }
    let balanceSats = info.balanceSats;
    if (read === balanceReadCounter) {
      writtenReadCounter = read;
      useWalletStore.getState().setReady(info.balanceSats, info.identityPubkey);
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
      const sending = prepared.send(speed);
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
