/**
 * Moving the rest of a previous wallet to the signed-in member's wallet, on
 * `/settings/previous-wallets/[sparkPubkey]`. The previous wallet opens from
 * its old 12 words beside the member's own wallet; the words and the
 * connection stay in this module's memory until the page closes it.
 */
import {
  defaultRecoveryDeps,
  openWordsWallet,
  RECOVERY_SEND_TRIES,
  type RecoveryDeps,
} from '@/lib/recovery-flow';
import { traceWallet } from '@/lib/sentry';
import { reportPaymentFailure } from '@/lib/wallet/payment-failure';
import type { WalletConnection, WalletSdk } from '@/lib/wallet/wallet-sdk';
import { receiveWalletSparkAddress, sdkFailureReason } from '@/lib/wallet/wallet-service';

/** Effects of the move: the SDK, the API key, the host, the deadline timer, and keys. */
export type RemainingBalanceDeps = Pick<
  RecoveryDeps,
  'loadSdk' | 'apiKey' | 'host' | 'sleep' | 'randomUUID'
>;

/** The open previous wallet. */
interface OpenWallet {
  /** Its live connection. */
  connection: WalletConnection;
  /** Idempotency key of the next send, or of a send whose outcome is unknown. */
  key: string;
  /** The effects it was opened with. */
  deps: RemainingBalanceDeps;
}

/** The previous wallet open on this page, or `null`. */
let open: OpenWallet | null = null;

/** Advanced by every open and close, so a late connection of an older open is closed. */
let generation = 0;

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
 * Opens a previous wallet from its old 12 words. Words of another wallet (or
 * no phrase at all) are `mismatch`, found offline before anything connects.
 * Otherwise a wallet still open from an earlier call is closed, the wallet
 * connects and reads its synced balance within `WALLET_CONNECT_TIMEOUT_MS`,
 * the member's own wallet deadline ({@link openWordsWallet}), and a fresh
 * idempotency key is drawn for its sends, so two wallets never share one.
 * Without a wallet in this build, or when it does not open, the answer is
 * `wallet`; so it is when the page closed the wallet ({@link closePreviousWallet})
 * or another open began while this one waited, and nothing connects then.
 *
 * @param words - The previous wallet's 12 words.
 * @param expectedPubkey - The previous wallet's identity key.
 * @param deps - Effects of the move; the real ones by default.
 * @returns The synced balance in sats, `mismatch`, or `wallet`.
 */
export async function openPreviousWallet(
  words: string,
  expectedPubkey: string,
  deps: RemainingBalanceDeps = defaultRecoveryDeps(),
): Promise<{ balanceSats: number } | 'mismatch' | 'wallet'> {
  const started = generation;
  const apiKey = deps.apiKey();
  if (apiKey === null) {
    return 'wallet';
  }
  let sdk: WalletSdk;
  try {
    sdk = await deps.loadSdk();
  } catch {
    return 'wallet';
  }
  let key: string;
  try {
    key = await sdk.identityPubkey(words);
  } catch {
    return 'mismatch';
  }
  if (key.toLowerCase() !== expectedPubkey.toLowerCase()) {
    return 'mismatch';
  }
  if (generation !== started) {
    // Closed or opened again while the SDK loaded or read the key.
    return 'wallet';
  }
  await closePreviousWallet();
  const mine = generation;
  let opened: { connection: WalletConnection; balanceSats: number };
  try {
    opened = await openWordsWallet(sdk, words, apiKey, deps);
  } catch {
    return 'wallet';
  }
  if (generation !== mine) {
    await closeQuietly(opened.connection);
    return 'wallet';
  }
  open = { connection: opened.connection, key: deps.randomUUID(), deps };
  return { balanceSats: opened.balanceSats };
}

/**
 * Moves the whole balance of the open previous wallet to the signed-in
 * member's wallet (its Spark address, opened from the tab phrase when needed).
 * It reads the synced balance first and sends all of it. A send that throws
 * keeps its key, so **Try again** repeats that send and the SDK answers it
 * instead of paying twice. A send that throws is also reported as a payment
 * that did not go out ({@link reportPaymentFailure}: stage `send`, method
 * `spark`, flow `previous_wallet`, the reason from {@link sdkFailureReason}).
 * After a send that went out the balance is read again; funds that arrived
 * meanwhile get a send with a new key, up to {@link RECOVERY_SEND_TRIES} sends
 * per call.
 *
 * @param session - Session the move runs under, for the failure report.
 * @returns `sent` once a synced read gives 0, otherwise `error` (also without
 *   an open wallet).
 */
export async function transferRemainingBalance(session: string | null): Promise<'sent' | 'error'> {
  const wallet = open;
  if (wallet === null) {
    return 'error';
  }
  try {
    const address = await receiveWalletSparkAddress();
    let balance = (await wallet.connection.getInfo({ ensureSynced: true })).balanceSats;
    let sends = 0;
    while (balance > 0) {
      if (sends === RECOVERY_SEND_TRIES) {
        return 'error';
      }
      const key = wallet.key;
      const amount = balance;
      try {
        await traceWallet(
          'wallet.send',
          () => wallet.connection.sendToSparkAddress(address, amount, key),
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
          'previous_wallet',
          { session },
        );
        return 'error';
      }
      sends += 1;
      wallet.key = wallet.deps.randomUUID();
      balance = (await wallet.connection.getInfo({ ensureSynced: true })).balanceSats;
    }
    return 'sent';
  } catch {
    return 'error';
  }
}

/**
 * Closes the open previous wallet (best effort) and drops its connection and
 * idempotency key. A wallet still connecting from an earlier
 * {@link openPreviousWallet} is closed once it opens.
 *
 * @returns Resolves once it is closed.
 */
export async function closePreviousWallet(): Promise<void> {
  generation += 1;
  const wallet = open;
  open = null;
  if (wallet !== null) {
    await closeQuietly(wallet.connection);
  }
}
