import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DFX_LOGIN_TIMEOUT_MS, DFX_SIGN_MESSAGE_PREFIX, dfxLoginUrl } from '@/lib/dfx-login';
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
const MESSAGE_URL = `${AUTH_URL}/signMessage?address=${encodeURIComponent(ADDRESS)}`;
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
 * Queues the sign-in text and session responses.
 *
 * @param authBody - POST JSON.
 * @param authOk - Whether the POST is 2xx.
 * @returns A flag that becomes true if the body is read.
 */
function queueAuth(authBody: unknown, authOk = true): { wasRead: () => boolean } {
  const auth = fakeResponse(authBody, authOk);
  queueMessage();
  fetchMock.mockResolvedValueOnce(auth.response);
  return { wasRead: auth.wasRead };
}

function queueMessage(
  body: unknown = { message: SIGN_TEXT },
  ok = true,
): { wasRead: () => boolean } {
  const message = fakeResponse(body, ok);
  fetchMock.mockResolvedValueOnce(message.response);
  return { wasRead: message.wasRead };
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
 * A sign-in request that never answers, and rejects with `AbortError` once
 * its signal aborts, as `fetch` does.
 *
 * @param _url - Ignored. The stand-in matches `fetch`.
 * @param init - Request options. The signal is the time limit.
 * @returns A promise that settles only when that signal aborts.
 */
function hangUntilAbort(_url: string, init?: RequestInit): Promise<Response> {
  return new Promise((_resolve, reject) => {
    const signal = init?.signal;
    if (signal === undefined || signal === null) {
      reject(new Error('missing-signal'));
      return;
    }
    const abort = (): void => {
      reject(new DOMException('The operation was aborted.', 'AbortError'));
    };
    if (signal.aborted) {
      abort();
      return;
    }
    signal.addEventListener('abort', abort);
  });
}

/**
 * The sign-in GET precedes the session POST. Their shared signal is still open.
 *
 * @param signature - Signature hex placed in the body.
 */
function expectOnePost(signature: string): void {
  expect(fetchMock).toHaveBeenCalledTimes(2);
  const init = fetchMock.mock.calls[1]?.[1] as RequestInit | undefined;
  expect(init?.signal).toBeInstanceOf(AbortSignal);
  expect(init?.signal?.aborted).toBe(false);
  expect(fetchMock).toHaveBeenNthCalledWith(1, MESSAGE_URL, {
    method: 'GET',
    signal: init?.signal,
  });
  expect(fetchMock).toHaveBeenCalledWith(AUTH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ address: ADDRESS, signature, wallet: '21gifts' }),
    signal: init?.signal,
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
  vi.useRealTimers();
});

describe('dfxLoginUrl', () => {
  it('fetches and signs the checked text before posting and returning the Buy URL', async () => {
    const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    queueAuth({ accessToken: TOKEN, blockchains: ['Spark'] });
    await expect(dfxLoginUrl()).resolves.toBe(BUY_URL);
    expect(receiveWalletSparkAddress).toHaveBeenCalledWith();
    expectSigned();
    expectOnePost(SIGNATURE);
    expect(vi.mocked(receiveWalletSparkAddress).mock.invocationCallOrder[0]).toBeLessThan(
      fetchMock.mock.invocationCallOrder[0]!,
    );
    expect(fetchMock.mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(signWithWallet).mock.invocationCallOrder[0]!,
    );
    expect(vi.mocked(signWithWallet).mock.invocationCallOrder[0]).toBeLessThan(
      fetchMock.mock.invocationCallOrder[1]!,
    );
    expect(logInteraction).not.toHaveBeenCalled();
    expect(consoleLog).not.toHaveBeenCalled();
    expect(consoleError).not.toHaveBeenCalled();
    consoleLog.mockRestore();
    consoleError.mockRestore();
  });

  it('forwards an SDK loader and signs the checked text', async () => {
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
    queueMessage();
    await expect(dfxLoginUrl()).rejects.toThrow('wallet-connect');
    expectSigned();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does not read the session body when the sign-in is not 2xx', async () => {
    const failed = queueAuth({ accessToken: 'secret' }, false);
    await expect(dfxLoginUrl()).rejects.toThrow('dfx-login');
    expect(failed.wasRead()).toBe(false);
    expectSigned();
    expectOnePost(SIGNATURE);
  });

  it('rejects dfx-login when the session body is not JSON', async () => {
    queueMessage();
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
    const failure = new Error('offline');
    queueMessage();
    fetchMock.mockRejectedValueOnce(failure);
    await expect(dfxLoginUrl()).rejects.toBe(failure);
    expectSigned();
    expectOnePost(SIGNATURE);
  });

  it('leaves no timer after a successful sign-in', async () => {
    vi.useFakeTimers();
    queueAuth({ accessToken: TOKEN });
    const pending = dfxLoginUrl();
    await vi.advanceTimersByTimeAsync(0);
    await expect(pending).resolves.toBe(BUY_URL);
    expectOnePost(SIGNATURE);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('times out while the address is pending without signing or posting', async () => {
    vi.useFakeTimers();
    let finish: (address: string) => void = () => undefined;
    vi.mocked(receiveWalletSparkAddress).mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const rejected = expect(dfxLoginUrl()).rejects.toThrow('dfx-login');
    await vi.advanceTimersByTimeAsync(DFX_LOGIN_TIMEOUT_MS);
    await rejected;
    finish(ADDRESS);
    await Promise.resolve();
    expect(signWithWallet).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('times out while signing and never posts a late signature', async () => {
    vi.useFakeTimers();
    queueMessage();
    let finish: (signature: string) => void = () => undefined;
    vi.mocked(signWithWallet).mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const rejected = expect(dfxLoginUrl()).rejects.toThrow('dfx-login');
    await vi.advanceTimersByTimeAsync(DFX_LOGIN_TIMEOUT_MS);
    await rejected;
    expectSigned();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    finish(SIGNATURE);
    await Promise.resolve();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('times out while the response body is pending', async () => {
    vi.useFakeTimers();
    queueMessage();
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: () => new Promise<unknown>(() => undefined),
    });
    const rejected = expect(dfxLoginUrl()).rejects.toThrow('dfx-login');
    await vi.advanceTimersByTimeAsync(DFX_LOGIN_TIMEOUT_MS);
    await rejected;
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('leaves no timer after a non-2xx answer', async () => {
    vi.useFakeTimers();
    const failed = queueAuth({ accessToken: 'secret' }, false);
    const pending = dfxLoginUrl();
    const rejected = expect(pending).rejects.toThrow('dfx-login');
    await vi.advanceTimersByTimeAsync(0);
    await rejected;
    expect(failed.wasRead()).toBe(false);
    expectOnePost(SIGNATURE);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('rejects dfx-login when the sign-in has not answered at the time limit', async () => {
    vi.useFakeTimers();
    queueMessage();
    fetchMock.mockImplementation(hangUntilAbort);
    let settled = false;
    const pending = dfxLoginUrl().then(
      (value) => {
        settled = true;
        return value;
      },
      (error: unknown) => {
        settled = true;
        throw error;
      },
    );
    await vi.advanceTimersByTimeAsync(DFX_LOGIN_TIMEOUT_MS - 1);
    expect(settled).toBe(false);
    expect(DFX_LOGIN_TIMEOUT_MS).toBe(15_000);
    expectSigned();
    const signal = (fetchMock.mock.calls[1]?.[1] as RequestInit | undefined)?.signal;
    expect(signal).toBeInstanceOf(AbortSignal);
    expect(signal?.aborted).toBe(false);
    const rejected = expect(pending).rejects.toThrow('dfx-login');
    await vi.advanceTimersByTimeAsync(1);
    await rejected;
    expect(settled).toBe(true);
    expect(signal?.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('encodes the wallet address in the GET before signing its exact returned text', async () => {
    const address = 'spark+address/with=characters';
    const message = SIGN_PREFIX + address;
    vi.mocked(receiveWalletSparkAddress).mockResolvedValue(address);
    queueMessage({ message });
    fetchMock.mockResolvedValueOnce(fakeResponse({ accessToken: TOKEN }).response);
    await expect(dfxLoginUrl()).resolves.toBe(BUY_URL);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      `${AUTH_URL}/signMessage?address=${encodeURIComponent(address)}`,
    );
    expect(signWithWallet).toHaveBeenCalledWith(message);
  });

  it.each([
    'other-prefix' + ADDRESS,
    SIGN_PREFIX + 'another-address',
    SIGN_TEXT + ' extra',
    ' ' + SIGN_TEXT,
  ])('rejects an unexpected sign-in text without signing or posting', async (message) => {
    queueMessage({ message });
    await expect(dfxLoginUrl()).rejects.toThrow('dfx-login');
    expect(signWithWallet).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('rejects a non-2xx sign-in text response without reading it', async () => {
    const failed = queueMessage({ message: SIGN_TEXT }, false);
    await expect(dfxLoginUrl()).rejects.toThrow('dfx-login');
    expect(failed.wasRead()).toBe(false);
    expect(signWithWallet).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('rejects a sign-in text body that is not JSON', async () => {
    queueMessage(() => {
      throw new SyntaxError('Unexpected token');
    });
    await expect(dfxLoginUrl()).rejects.toThrow('dfx-login');
    expect(signWithWallet).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it.each([{}, { message: '' }, { message: '   ' }, { message: 1 }])(
    'rejects a missing, empty, or non-text sign-in message',
    async (body) => {
      queueMessage(body);
      await expect(dfxLoginUrl()).rejects.toThrow('dfx-login');
      expect(signWithWallet).not.toHaveBeenCalled();
      expect(fetchMock).toHaveBeenCalledTimes(1);
    },
  );

  it('propagates a sign-in text request failure without signing or posting', async () => {
    const failure = new Error('offline');
    fetchMock.mockRejectedValueOnce(failure);
    await expect(dfxLoginUrl()).rejects.toBe(failure);
    expect(signWithWallet).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('aborts a pending sign-in text GET at the time limit', async () => {
    vi.useFakeTimers();
    fetchMock.mockImplementation(hangUntilAbort);
    const rejected = expect(dfxLoginUrl()).rejects.toThrow('dfx-login');
    await vi.advanceTimersByTimeAsync(DFX_LOGIN_TIMEOUT_MS);
    await rejected;
    const signal = (fetchMock.mock.calls[0]?.[1] as RequestInit | undefined)?.signal;
    expect(signal?.aborted).toBe(true);
    expect(signWithWallet).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });
});
