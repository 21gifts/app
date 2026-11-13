import {
  receiveWalletSparkAddress,
  signWithWallet,
  type WalletSdkLoader,
} from '@/lib/wallet/wallet-service';

/** Origin of the DFX API that issues the session. */
export const DFX_API_ORIGIN = 'https://api.dfx.swiss';

/** Origin of the DFX web app the new tab opens on Buy. */
export const DFX_APP_ORIGIN = 'https://app.dfx.swiss';

/**
 * Wallet name sent with the sign-in. DFX files a new account under it. An
 * unknown name does not fail the sign-in; DFX then uses its own default.
 */
export const DFX_WALLET_NAME = '21gifts';

/**
 * DFX's production sign-in text. The app signs only this text plus its own
 * address.
 */
export const DFX_SIGN_MESSAGE_PREFIX =
  'By_signing_this_message,_you_confirm_that_you_are_the_sole_owner_of_the_provided_Blockchain_address._Your_ID:_';

/**
 * Limit of one `POST /v1/auth` (ms). Reaching it aborts the request and the
 * reading of its body, and the sign-in rejects with `dfx-login`. A failed
 * request still rejects with that fetch error.
 */
export const DFX_LOGIN_TIMEOUT_MS = 15_000;

/**
 * Builds the DFX Buy URL for the signed-in member's own in-app wallet.
 *
 * Reads the Spark address, signs the production sign-in text plus that address
 * with the wallet identity key, and exchanges the signature for a session
 * token. The token is placed only in the returned URL. It is not stored, and
 * the address, the text, the signature, the token, and the URL are not logged.
 *
 * @param loadSdk - SDK loader forwarded to the wallet. Omit it to use the real SDK.
 * @returns Absolute Buy URL with `session`, `blockchain=Spark`, and `asset-out=BTC`.
 * @throws Error `wallet-connect` when the wallet cannot be opened. Error
 *   `dfx-login` when the time limit is reached, when DFX answers non-2xx,
 *   returns a body that is not JSON, or omits a non-empty `accessToken`. A
 *   failed request rejects with that fetch error.
 */
export async function dfxLoginUrl(loadSdk?: WalletSdkLoader): Promise<string> {
  const address =
    loadSdk === undefined
      ? await receiveWalletSparkAddress()
      : await receiveWalletSparkAddress(loadSdk);
  const message = DFX_SIGN_MESSAGE_PREFIX + address;
  const signature =
    loadSdk === undefined ? await signWithWallet(message) : await signWithWallet(message, loadSdk);
  // A timer, not `AbortSignal.timeout`, which older Safari versions do not have.
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort();
  }, DFX_LOGIN_TIMEOUT_MS);
  try {
    const accessToken = await readDfxAccessToken(address, signature, controller.signal);
    const buy = new URL('/buy', DFX_APP_ORIGIN);
    buy.searchParams.set('session', accessToken);
    buy.searchParams.set('blockchain', 'Spark');
    buy.searchParams.set('asset-out', 'BTC');
    return buy.toString();
  } finally {
    clearTimeout(timer);
  }
}

// POST /v1/auth and its body. An abort is `dfx-login`. Any other fetch error is that error.
async function readDfxAccessToken(
  address: string,
  signature: string,
  signal: AbortSignal,
): Promise<string> {
  try {
    const authResponse = await fetch(new URL('/v1/auth', DFX_API_ORIGIN).toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address, signature, wallet: DFX_WALLET_NAME }),
      signal,
    });
    return requiredText(await readJson(authResponse), 'accessToken');
  } catch (error) {
    if (signal.aborted) {
      throw new Error('dfx-login');
    }
    throw error;
  }
}

// A non-2xx body is never read. A body that is not JSON is `dfx-login`.
async function readJson(response: Response): Promise<unknown> {
  if (!response.ok) {
    throw new Error('dfx-login');
  }
  try {
    const body: unknown = await response.json();
    return body;
  } catch {
    throw new Error('dfx-login');
  }
}

// Space-only text is empty. Any other string is returned unchanged.
function requiredText(body: unknown, key: 'accessToken'): string {
  if (typeof body !== 'object' || body === null) {
    throw new Error('dfx-login');
  }
  const value = (body as Record<string, unknown>)[key];
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error('dfx-login');
  }
  return value;
}
