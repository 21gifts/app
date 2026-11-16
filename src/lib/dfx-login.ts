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
 * Expected start of DFX's sign-in text. The returned text must equal this
 * prefix plus the wallet address, or nothing is signed.
 */
export const DFX_SIGN_MESSAGE_PREFIX =
  'By_signing_this_message,_you_confirm_that_you_are_the_sole_owner_of_the_provided_Blockchain_address._Your_ID:_';

/**
 * Limit of the entire sign-in (ms), from its start through wallet address,
 * sign-in text request, signature, auth request and response bodies. Reaching
 * it rejects with `dfx-login` and aborts the request. A failed request still
 * rejects with that fetch error.
 */
export const DFX_LOGIN_TIMEOUT_MS = 15_000;

/**
 * Builds the DFX Buy URL for the signed-in member's own in-app wallet.
 *
 * Reads the Spark address, fetches and checks DFX's sign-in text, signs it
 * with the wallet identity key, and exchanges the signature for a session
 * token. The token is placed only in the returned URL. It is not stored, and
 * the address, the text, the signature, the token, and the URL are not logged.
 * The time limit starts immediately and covers every step.
 *
 * @param loadSdk - SDK loader forwarded to the wallet. Omit it to use the real SDK.
 * @returns Absolute Buy URL with `session`, `blockchain=Spark`, and `asset-out=BTC`.
 * @throws Error `wallet-connect` when the wallet cannot be opened. Error
 *   `dfx-login` when the time limit is reached, when DFX answers non-2xx,
 *   returns a body that is not JSON, omits a non-empty `message` or
 *   `accessToken`, or returns an unexpected sign-in text. A failed request
 *   rejects with that fetch error.
 */
export async function dfxLoginUrl(loadSdk?: WalletSdkLoader): Promise<string> {
  // A timer, not `AbortSignal.timeout`, which older Safari versions do not have.
  const controller = new AbortController();
  let onAbort!: () => void;
  const aborted = new Promise<never>((_resolve, reject) => {
    onAbort = (): void => reject(new Error('dfx-login'));
    controller.signal.addEventListener('abort', onAbort);
  });
  const timer = setTimeout(() => {
    controller.abort();
  }, DFX_LOGIN_TIMEOUT_MS);
  try {
    const address = await Promise.race([
      loadSdk === undefined ? receiveWalletSparkAddress() : receiveWalletSparkAddress(loadSdk),
      aborted,
    ]);
    const message = await Promise.race([readDfxSignMessage(address, controller.signal), aborted]);
    const signature = await Promise.race([
      loadSdk === undefined ? signWithWallet(message) : signWithWallet(message, loadSdk),
      aborted,
    ]);
    const accessToken = await Promise.race([
      readDfxAccessToken(address, signature, controller.signal),
      aborted,
    ]);
    const buy = new URL('/buy', DFX_APP_ORIGIN);
    buy.searchParams.set('session', accessToken);
    buy.searchParams.set('blockchain', 'Spark');
    buy.searchParams.set('asset-out', 'BTC');
    return buy.toString();
  } finally {
    clearTimeout(timer);
    controller.signal.removeEventListener('abort', onAbort);
  }
}

// GET the sign-in text and reject any text other than the expected one.
async function readDfxSignMessage(address: string, signal: AbortSignal): Promise<string> {
  try {
    const url = new URL('/v1/auth/signMessage', DFX_API_ORIGIN);
    url.searchParams.set('address', address);
    const response = await fetch(url.toString(), { method: 'GET', signal });
    const message = requiredText(await readJson(response), 'message');
    if (message !== DFX_SIGN_MESSAGE_PREFIX + address) {
      throw new Error('dfx-login');
    }
    return message;
  } catch (error) {
    if (signal.aborted) {
      throw new Error('dfx-login');
    }
    throw error;
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
function requiredText(body: unknown, key: 'accessToken' | 'message'): string {
  if (typeof body !== 'object' || body === null) {
    throw new Error('dfx-login');
  }
  const value = (body as Record<string, unknown>)[key];
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error('dfx-login');
  }
  return value;
}
