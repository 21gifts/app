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
   * Reads the current balance and identity key.
   *
   * @returns Balance and identity public key.
   */
  getInfo(): Promise<WalletInfo>;
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
 *
 * @returns A {@link WalletSdk} whose `connect` opens a mainnet wallet.
 */
export async function loadWalletSdk(): Promise<WalletSdk> {
  const sdk = await import('@breeztech/breez-sdk-spark/ssr');
  await sdk.default();
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
        async getInfo(): Promise<WalletInfo> {
          const info = await handle.getInfo({});
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
