import { getBreezApiKey } from '@/lib/config';
import { peekSessionPhrase, SESSION_PHRASE_EVENT } from '@/lib/tab-phrase';
import { loadWalletSdk, type WalletConnection, type WalletSdk } from '@/lib/wallet/wallet-sdk';
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
 * this read is still the latest. A stale read returns without writing.
 *
 * @param run - Run number captured by the caller.
 * @param conn - Connection to query.
 * @returns Resolves after `setReady` or when the run or read is stale.
 */
async function readBalance(run: number, conn: WalletConnection): Promise<void> {
  balanceReadCounter += 1;
  const read = balanceReadCounter;
  const info = await conn.getInfo();
  if (run !== runCounter || read !== balanceReadCounter) {
    return;
  }
  useWalletStore.getState().setReady(info.balanceSats, info.identityPubkey);
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
 * Connects the in-app wallet from the tab phrase and Breez API key. No-ops when
 * either is missing. Never rejects; failures end in the store.
 *
 * @param loadSdk - SDK loader; defaults to {@link loadWalletSdk}.
 * @returns Resolves when the attempt finishes (ready, error, or superseded).
 */
export async function connectWallet(loadSdk: WalletSdkLoader = loadWalletSdk): Promise<void> {
  const apiKey = getBreezApiKey();
  const mnemonic = peekSessionPhrase();
  if (apiKey === null || mnemonic === null) {
    return;
  }
  const run = bumpRun();
  useWalletStore.getState().setConnecting();
  await dropConnection();
  try {
    const sdk = await loadSdk();
    if (run !== runCounter) {
      return;
    }
    const next = await sdk.connect(mnemonic, apiKey);
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
      if (event.type === 'synced') {
        void refreshWallet();
      }
    });
    if (run !== runCounter) {
      return;
    }
    await readBalance(run, next);
  } catch {
    await failRun(run);
  }
}

/**
 * Refreshes the balance on the current connection. No-ops without a connection.
 * When reads overlap only the latest one writes. Never rejects; a failure while
 * current ends in the store.
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
