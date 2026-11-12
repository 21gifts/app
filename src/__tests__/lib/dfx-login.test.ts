import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DFX_SIGN_MESSAGE_PREFIX, dfxLoginUrl } from '@/lib/dfx-login';
import { logInteraction } from '@/lib/interaction-log';
import { receiveWalletSparkAddress, signWithWallet } from '@/lib/wallet/wallet-service';

vi.mock('@/lib/wallet/wallet-service', () => ({
  receiveWalletSparkAddress: vi.fn(),
  signWithWallet: vi.fn(),
}));

const ADDRESS = 'spark1qexampleaddress';
const SIGN_PREFIX =
  'By_signing_this_message,_you_confirm_that_you_are_the_sole_owner_of_the_provided_Blockchain_address._Your_ID:_';
const SIGN_TEXT = SIGN_PREFIX + ADDRESS;
const SIGNATURE = 'ab'.repeat(32);
const TOKEN = 'header.payload.sig';
const AUTH_URL = 'https://api.dfx.swiss/v1/auth';
const BUY_URL = `https://app.dfx.swiss/buy?session=${TOKEN}&blockchain=Spark&asset-out=BTC`;

const fetchMock = vi.fn();

/**
 * A fetch `Response` stand-in. `read` flips when the body is read, so a
 * non-2xx test can prove the body was left alone.
 *
 * @param body - JSON value, or a function that rejects.
 * @param ok - HTTP success.
 * @returns The stand-in and a flag that becomes true if `json` runs.
 */
function fakeResponse(
  body: unknown | (() => never),
  ok = true,
): { response: Response; wasRead: () => boolean } {
  let read = false;
  const response = {
    ok,
    json: (): Promise<unknown> => {
      read = true;
      if (typeof body === 'function') {
        body();
      }
      return Promise.resolve(body);
    },
  } as Response;
  return { response, wasRead: () => read };
}

/**
 * Queues the one session response.
 *
 * @param authBody - POST JSON.
 * @param authOk - Whether the POST is 2xx.
 * @returns A flag that becomes true if the body is read.
 */
function queueAuth(authBody: unknown, authOk = true): { wasRead: () => boolean } {
  const auth = fakeResponse(authBody, authOk);
  fetchMock.mockResolvedValueOnce(auth.response);
  return { wasRead: auth.wasRead };
}

/**
 * The wallet signed the production text plus the address, and nothing else.
 *
 * @param loadSdk - Loader forwarded with the text, when the call passed one.
 */
function expectSigned(loadSdk?: unknown): void {
  expect(DFX_SIGN_MESSAGE_PREFIX).toBe(SIGN_PREFIX);
  expect(SIGN_TEXT).toBe(DFX_SIGN_MESSAGE_PREFIX + ADDRESS);
  expect(vi.mocked(signWithWallet).mock.calls[0]?.[0]).toBe(SIGN_TEXT);
  if (loadSdk === undefined) {
    expect(signWithWallet).toHaveBeenCalledTimes(1);
    expect(signWithWallet).toHaveBeenCalledWith(SIGN_TEXT);
    return;
  }
  expect(signWithWallet).toHaveBeenCalledTimes(1);
  expect(signWithWallet).toHaveBeenCalledWith(SIGN_TEXT, loadSdk);
}

/**
 * Exactly one request, and it is the session POST.
 *
 * @param signature - Signature hex placed in the body.
 */
function expectOnePost(signature: string): void {
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(fetchMock).toHaveBeenCalledWith(AUTH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ address: ADDRESS, signature, wallet: '21gifts' }),
  });
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  vi.mocked(receiveWalletSparkAddress).mockReset().mockResolvedValue(ADDRESS);
  vi.mocked(signWithWallet).mockReset().mockResolvedValue(SIGNATURE);
  vi.mocked(logInteraction).mockClear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('dfxLoginUrl', () => {
  it('signs the local text and returns the Buy URL', async () => {
    const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    queueAuth({ accessToken: TOKEN, blockchains: ['Spark'] });
    await expect(dfxLoginUrl()).resolves.toBe(BUY_URL);
    expect(receiveWalletSparkAddress).toHaveBeenCalledWith();
    expectSigned();
    expectOnePost(SIGNATURE);
    expect(logInteraction).not.toHaveBeenCalled();
    expect(consoleLog).not.toHaveBeenCalled();
    expect(consoleError).not.toHaveBeenCalled();
    consoleLog.mockRestore();
    consoleError.mockRestore();
  });

  it('forwards an SDK loader and signs the same local text', async () => {
    const loadSdk = vi.fn();
    queueAuth({ accessToken: TOKEN });
    await expect(dfxLoginUrl(loadSdk)).resolves.toBe(BUY_URL);
    expect(receiveWalletSparkAddress).toHaveBeenCalledWith(loadSdk);
    expectSigned(loadSdk);
    expectOnePost(SIGNATURE);
  });

  it('encodes a session token in the Buy URL', async () => {
    queueAuth({ accessToken: 'a+b/c=' });
    await expect(dfxLoginUrl()).resolves.toBe(
      'https://app.dfx.swiss/buy?session=a%2Bb%2Fc%3D&blockchain=Spark&asset-out=BTC',
    );
    expectSigned();
    expectOnePost(SIGNATURE);
  });

  it('posts an empty signature when the wallet returns one', async () => {
    vi.mocked(signWithWallet).mockResolvedValue('');
    queueAuth({ accessToken: TOKEN });
    await expect(dfxLoginUrl()).resolves.toBe(BUY_URL);
    expectSigned();
    expectOnePost('');
  });

  it('rejects wallet-connect before any request when the address cannot be read', async () => {
    vi.mocked(receiveWalletSparkAddress).mockRejectedValue(new Error('wallet-connect'));
    await expect(dfxLoginUrl()).rejects.toThrow('wallet-connect');
    expect(fetchMock).not.toHaveBeenCalled();
    expect(signWithWallet).not.toHaveBeenCalled();
  });

  it('does not post when signing fails', async () => {
    vi.mocked(signWithWallet).mockRejectedValue(new Error('wallet-connect'));
    await expect(dfxLoginUrl()).rejects.toThrow('wallet-connect');
    expectSigned();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does not read the session body when the sign-in is not 2xx', async () => {
    const failed = queueAuth({ accessToken: 'secret' }, false);
    await expect(dfxLoginUrl()).rejects.toThrow('dfx-login');
    expect(failed.wasRead()).toBe(false);
    expectSigned();
    expectOnePost(SIGNATURE);
  });

  it('rejects dfx-login when the session body is not JSON', async () => {
    fetchMock.mockResolvedValueOnce(
      fakeResponse(() => {
        throw new SyntaxError('Unexpected token');
      }).response,
    );
    await expect(dfxLoginUrl()).rejects.toThrow('dfx-login');
    expectSigned();
    expectOnePost(SIGNATURE);
  });

  it('rejects dfx-login when the session token is missing, empty, or not text', async () => {
    for (const body of [
      null,
      'nope',
      {},
      { accessToken: 1 },
      { accessToken: '' },
      { accessToken: '   ' },
    ]) {
      fetchMock.mockReset();
      vi.mocked(signWithWallet).mockClear();
      queueAuth(body);
      await expect(dfxLoginUrl()).rejects.toThrow('dfx-login');
      expectSigned();
      expectOnePost(SIGNATURE);
    }
  });

  it('lets a sign-in request failure through after the text was signed', async () => {
    fetchMock.mockRejectedValueOnce(new Error('offline'));
    await expect(dfxLoginUrl()).rejects.toThrow('offline');
    expectSigned();
    expectOnePost(SIGNATURE);
  });
});
