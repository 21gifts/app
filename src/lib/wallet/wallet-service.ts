import { getBreezApiKey } from '@/lib/config';
import { peekSessionPhrase, SESSION_PHRASE_EVENT } from '@/lib/tab-phrase';
import {
  loadWalletSdk,
  type WalletConnection,
  type WalletPayment,
  type WalletPaymentPage,
  type WalletPayRequest,
  type WalletSdk,
  type WalletTarget,
} from '@/lib/wallet/wallet-sdk';
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
 * Connects the in-app wallet from the tab phrase and Breez API key. Loading the
 * SDK, connecting, and the first synchronized balance read share a 30-second
 * deadline. A timeout moves a still-connecting wallet to `error`, but leaves a
 * wallet made ready by a synchronized refresh unchanged. No-ops when either
 * input is missing. Never rejects; failures end in the store.
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
    void failRun(run);
  }
}

/**
 * Refreshes the balance on the current connection with a plain read. No-ops
 * without a connection. When reads overlap only the latest one writes. Never
 * rejects; a failure while current ends in the store.
 *
 * @returns Resolves when the refresh finishes or is skipped.
 */
export async function refreshWallet(): Promise<void> {
  const run = runCounter;
  const conn = connection;
  if (conn === null) {
    return;
  }
  try {
    await readBalance(run, conn);
  } catch {
    await failRun(run);
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

/** How long a send may take before the app stops waiting for the SDK. */
export const WALLET_SEND_TIMEOUT_MS = 30_000;

/**
 * Outcome of sending a prepared payment.
 *
 * - `paid`: the SDK reported the payment sent.
 * - `insufficient`: the wallet balance does not cover amount and fee.
 * - `failed`: the send failed, timed out, or the wallet changed since prepare.
 *   The payment may still arrive; callers do not retry on their own.
 */
export type WalletSendResult = { kind: 'paid' } | { kind: 'insufficient' } | { kind: 'failed' };

/**
 * Outcome of preparing a payment from the in-app wallet.
 *
 * - `confirm`: amount and fee to show; `send` pays it once.
 * - `insufficient`: the balance does not cover amount and fee.
 * - `failed`: the SDK could not prepare the payment.
 * - `unlock`: no wallet connection; the member has to unlock first.
 */
export type WalletPayResult =
  | {
      kind: 'confirm';
      amountSats: number;
      feeSats: number;
      send: () => Promise<WalletSendResult>;
    }
  | { kind: 'insufficient' }
  | { kind: 'failed' }
  | { kind: 'unlock' };

/**
 * Outcome of reading a pasted text with {@link parseWalletInput}.
 *
 * - `target`: what the text pays (which may be `onchain` or `unsupported`).
 * - `unreachable`: the text names a receiver whose server did not answer
 *   this browser.
 * - `invalid`: not a payment request or address.
 * - `unlock`: no wallet connection.
 */
export type WalletParseResult =
  | { kind: 'target'; target: WalletTarget }
  | { kind: 'unreachable' }
  | { kind: 'invalid' }
  | { kind: 'unlock' };

/**
 * True when an SDK error says the balance is too low.
 *
 * @param err - Rejection from the SDK.
 * @returns Whether the error names insufficient funds.
 */
function isInsufficientFunds(err: unknown): boolean {
  const text = err instanceof Error ? err.message : String(err);
  return /insufficient/i.test(text);
}

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
 * confirmation, checked against a balance read after the wallet has synced; the returned `send` pays it once and refreshes the balance.
 * Never rejects.
 *
 * @param request - Request text to pay, or a receiver that takes an amount.
 * @returns Confirmation with `send`, or why the payment cannot be made.
 */
export async function payFromWallet(request: WalletPayRequest): Promise<WalletPayResult> {
  const conn = connection;
  if (conn === null) {
    return { kind: 'unlock' };
  }
  let prepared;
  try {
    prepared = await conn.prepare(request);
  } catch (err: unknown) {
    return isInsufficientFunds(err) ? { kind: 'insufficient' } : { kind: 'failed' };
  }
  const { amountSats, feeSats } = prepared;
  try {
    const info = await conn.getInfo({ ensureSynced: true });
    if (info.balanceSats < amountSats + feeSats) {
      return { kind: 'insufficient' };
    }
  } catch {
    return { kind: 'failed' };
  }
  let sent = false;
  const send = async (): Promise<WalletSendResult> => {
    if (sent || connection !== conn) {
      return { kind: 'failed' };
    }
    sent = true;
    let result: WalletSendResult;
    try {
      const done = await withTimeout(
        prepared.send().then(() => true),
        WALLET_SEND_TIMEOUT_MS,
      );
      result = done === null ? { kind: 'failed' } : { kind: 'paid' };
    } catch (err: unknown) {
      result = isInsufficientFunds(err) ? { kind: 'insufficient' } : { kind: 'failed' };
    }
    void refreshWallet();
    return result;
  };
  return { kind: 'confirm', amountSats, feeSats, send };
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
  try {
    return { kind: 'target', target: await conn.parse(trimmed) };
  } catch {
    return isReceiverServerName(trimmed) ? { kind: 'unreachable' } : { kind: 'invalid' };
  }
}
