/**
 * Narrow adapter over `@breeztech/breez-sdk-spark/ssr`.
 *
 * The SDK keeps wallet state in IndexedDB; the recovery phrase is passed in
 * memory and never stored by this app.
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
   * @returns A live connection.
   */
  connect(mnemonic: string, apiKey: string): Promise<WalletConnection>;
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
    async connect(mnemonic: string, apiKey: string): Promise<WalletConnection> {
      const config = sdk.defaultConfig('mainnet');
      config.apiKey = apiKey;
      delete config.lnurlDomain;
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
        async disconnect(): Promise<void> {
          await handle.disconnect();
        },
      };
    },
  };
}
