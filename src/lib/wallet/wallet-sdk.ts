/**
 * Narrow adapter over `@breeztech/breez-sdk-spark/ssr`.
 *
 * The SDK keeps wallet state in IndexedDB; the recovery phrase is passed in
 * memory and never stored by this app. The adapter exposes no availability
 * check for addresses: the account's own username is the only one registered.
 */

/**
 * IndexedDB directory name the SDK uses for this app's wallet state. The SDK
 * appends the network and a hash of the wallet's identity key to this name, so
 * each wallet on a browser gets its own database.
 */
const WALLET_STORAGE_DIR = '21gifts-wallet';

/**
 * Set when `sdk.default()` (SDK init) rejects inside {@link loadWalletSdk}.
 * Never cleared; only a page reload recovers because the SDK caches a failed
 * initialisation. A rejecting `import()` does not set it.
 */
let sdkInitFailed = false;

/**
 * True while `sdk.default()` (SDK init) inside {@link loadWalletSdk} has not
 * settled. The SDK caches a pending initialisation as well, so a new attempt
 * would wait on the same promise.
 */
let sdkInitPending = false;

/**
 * True after the SDK's initialisation failed in this page, or while it is still
 * pending (for example after the connect deadline expired during it). The SDK
 * caches its initialisation promise, so only a reload recovers.
 *
 * @returns Whether the page must be reloaded before another connect attempt.
 */
export function walletNeedsReload(): boolean {
  return sdkInitFailed || sdkInitPending;
}

/**
 * Balance and identity returned by a connected wallet.
 */
export interface WalletInfo {
  /** Confirmed balance in satoshis. */
  balanceSats: number;
  /** Wallet identity public key. */
  identityPubkey: string;
}

/**
 * Opaque SDK event forwarded to listeners.
 */
export interface WalletSdkEvent {
  /** Event discriminant from the SDK. */
  type: string;
}

/** Direction of a wallet payment as the member sees it. */
export type WalletPaymentDirection = 'received' | 'sent';

/**
 * One wallet payment in the shape the history list renders.
 */
export interface WalletPayment {
  /** SDK payment id. */
  id: string;
  /** `received` for an incoming payment, `sent` for an outgoing one. */
  direction: WalletPaymentDirection;
  /** Amount in whole satoshis, without fees. */
  amountSats: number;
  /** Epoch ms when the payment was created. */
  timestamp: number;
  /** Whether the payment settled, is still open, or failed. */
  status: 'completed' | 'pending' | 'failed';
  /** Note the payer attached to a received payment, or `null`. */
  senderComment: string | null;
}

/**
 * One page of the wallet's payment list.
 */
export interface WalletPaymentPage {
  /** Number of payments to skip from the newest. */
  offset: number;
  /** Maximum number of payments to return. */
  limit: number;
}

/**
 * Narrow view of an SDK payment that {@link toWalletPayment} reads.
 */
export interface SdkPaymentLike {
  /** SDK payment id. */
  id: string;
  /** `receive` or `send`. */
  paymentType: string;
  /** `completed`, `pending`, or `failed`. */
  status: string;
  /** Amount in satoshis (the SDK uses `bigint`). */
  amount: bigint | number;
  /** Creation time in epoch seconds. */
  timestamp: number;
  /** Method-specific details; only the received-payment note is read. */
  details?: { type: string; lnurlReceiveMetadata?: { senderComment?: string } } | undefined;
}

/**
 * Maps an SDK payment to the {@link WalletPayment} the history list renders.
 * A blank note counts as no note.
 *
 * @param payment - Payment from the SDK's `listPayments`.
 * @returns The mapped payment.
 */
export function toWalletPayment(payment: SdkPaymentLike): WalletPayment {
  const details = payment.details;
  const rawComment =
    details !== undefined && details.type === 'lightning'
      ? details.lnurlReceiveMetadata?.senderComment
      : undefined;
  const comment = typeof rawComment === 'string' ? rawComment.trim() : '';
  return {
    id: payment.id,
    direction: payment.paymentType === 'send' ? 'sent' : 'received',
    amountSats: Number(payment.amount),
    timestamp: payment.timestamp * 1000,
    status:
      payment.status === 'pending' || payment.status === 'failed' ? payment.status : 'completed',
    senderComment: comment === '' ? null : comment,
  };
}

/**
 * A live SDK connection.
 */
export interface WalletConnection {
  /**
   * Reads the current balance and identity key, optionally waiting for the SDK
   * to synchronize first.
   *
   * @param options - Set `ensureSynced` to wait for synchronized wallet state.
   * @returns Balance and identity public key.
   */
  getInfo(options?: { ensureSynced?: boolean }): Promise<WalletInfo>;
  /**
   * Registers an event listener on the connection.
   *
   * @param onEvent - Callback invoked for each SDK event.
   * @returns Listener id assigned by the SDK.
   */
  addEventListener(onEvent: (event: WalletSdkEvent) => void): Promise<string>;
  /**
   * Registers `username` as this wallet's address on the configured domain.
   *
   * @param username - The account's username.
   * @returns Resolves once the domain accepted the registration.
   */
  registerAddress(username: string): Promise<void>;
  /**
   * Lists payments newest first.
   *
   * @param page - Offset and limit.
   * @returns The payments on that page.
   */
  listPayments(page: WalletPaymentPage): Promise<WalletPayment[]>;
  /**
   * Closes the connection.
   *
   * @returns Resolves when the SDK has disconnected.
   */
  disconnect(): Promise<void>;
}

/**
 * Lazily loaded wallet SDK surface.
 */
export interface WalletSdk {
  /**
   * Opens a wallet from a mnemonic and API key.
   *
   * @param mnemonic - BIP-39 recovery phrase.
   * @param apiKey - Breez API key.
   * @param lnurlDomain - Host that serves the wallet's address (the app's own host).
   * @returns A live connection.
   */
  connect(mnemonic: string, apiKey: string, lnurlDomain: string): Promise<WalletConnection>;
}

/**
 * Dynamically imports the Breez Spark SSR package, initializes it, and returns
 * a narrow {@link WalletSdk} wrapper. The only module that names the package.
 * A rejected or still pending initialisation is reported by {@link walletNeedsReload}.
 *
 * @returns A {@link WalletSdk} whose `connect` opens a mainnet wallet and whose
 * `getInfo` can wait for synchronized state.
 * @throws When the SDK module cannot be imported or its initialisation fails.
 */
export async function loadWalletSdk(): Promise<WalletSdk> {
  const sdk = await import('@breeztech/breez-sdk-spark/ssr');
  sdkInitPending = true;
  try {
    await sdk.default();
  } catch (error: unknown) {
    sdkInitFailed = true;
    throw error;
  } finally {
    sdkInitPending = false;
  }
  return {
    async connect(
      mnemonic: string,
      apiKey: string,
      lnurlDomain: string,
    ): Promise<WalletConnection> {
      const config = sdk.defaultConfig('mainnet');
      config.apiKey = apiKey;
      config.lnurlDomain = lnurlDomain;
      const handle = await sdk.connect({
        config,
        seed: { type: 'mnemonic', mnemonic },
        storageDir: WALLET_STORAGE_DIR,
      });
      return {
        async getInfo(options?: { ensureSynced?: boolean }): Promise<WalletInfo> {
          const request = options?.ensureSynced === true ? { ensureSynced: true } : {};
          const info = await handle.getInfo(request);
          return {
            balanceSats: info.balanceSats,
            identityPubkey: info.identityPubkey,
          };
        },
        async addEventListener(onEvent: (event: WalletSdkEvent) => void): Promise<string> {
          return handle.addEventListener({ onEvent });
        },
        async registerAddress(username: string): Promise<void> {
          await handle.registerLightningAddress({ username });
        },
        async listPayments(page: WalletPaymentPage): Promise<WalletPayment[]> {
          const response = await handle.listPayments({
            offset: page.offset,
            limit: page.limit,
            sortAscending: false,
          });
          return response.payments.map(toWalletPayment);
        },
        async disconnect(): Promise<void> {
          await handle.disconnect();
        },
      };
    },
  };
}
