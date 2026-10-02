import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { obtainPrfFirst, prfEvalFirstSalt, readPrfFirst } from '@/lib/prf-mnemonic';
import { clearSessionPhrase, rememberSessionPhrase } from '@/lib/tab-phrase';
import { bytesToBase64Url, requestOptionsFromJSON } from '@/lib/webauthn-browser';
import { usePasskeyLogin } from '@/hooks/usePasskeyLogin';
import {
  finishPasskeyAuthentication,
  finishPasskeyRegistration,
  startPasskeyAuthentication,
  startPasskeyRegistration,
  UnknownCredentialError,
  WRONG_ACCOUNT_ERROR,
  WrongAccountError,
} from '@/lib/api';
import { isInAppBrowser } from '@/lib/in-app-browser';
import { useAuthStore } from '@/stores/auth-store';

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return {
    ...actual,
    startPasskeyRegistration: vi.fn(),
    finishPasskeyRegistration: vi.fn(),
    startPasskeyAuthentication: vi.fn(),
    finishPasskeyAuthentication: vi.fn(),
  };
});

vi.mock('@/lib/in-app-browser', () => ({
  isInAppBrowser: vi.fn(() => false),
}));

vi.mock('@/lib/webauthn-browser', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/webauthn-browser')>();
  return {
    ...actual,
    creationOptionsFromJSON: vi.fn().mockReturnValue({ challenge: new ArrayBuffer(1) }),
    requestOptionsFromJSON: vi.fn().mockReturnValue({ challenge: new ArrayBuffer(1) }),
    credentialToJSON: vi.fn().mockReturnValue({ id: 'cred' }),
  };
});

vi.mock('@/lib/prf-mnemonic', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/prf-mnemonic')>();
  return {
    ...actual,
    obtainPrfFirst: vi.fn().mockResolvedValue(new Uint8Array(32).fill(7)),
    mnemonicFromPrfFirst: vi
      .fn()
      .mockResolvedValue(
        'abandon ability able about above absent absorb abstract absurd abuse access accident',
      ),
    prfEvalFirstSalt: vi.fn().mockResolvedValue(new Uint8Array(32).fill(1)),
    readPrfFirst: vi.fn(() => undefined),
  };
});

vi.mock('@/lib/tab-phrase', () => ({
  rememberSessionPhrase: vi.fn(),
  clearSessionPhrase: vi.fn(),
  peekSessionPhrase: vi.fn(() => null),
  sessionPhraseGeneration: vi.fn(() => 0),
}));

const ORIGINAL_BREEZ = process.env.NEXT_PUBLIC_BREEZ_API_KEY;
const WALLET_CHALLENGE = 'ab'.repeat(32);
const FIXTURE_MNEMONIC =
  'abandon ability able about above absent absorb abstract absurd abuse access accident';

const account = {
  id: 'acc_1',
  linkingKey: null,
  role: 'basis' as const,
  name: null,
  location: null,
  lightningAddress: null,
  lightningAddressVerified: false,
  forumLawsDismissed: false,
  createdAt: 1_700_000_000,
  rulesAgreedAt: null as number | null,
  viewKey: 'a'.repeat(64),
  aboutMe: null,
  aboutMeHasPhoto: false,
  setup: 'name' as const,
  missing: ['name', 'lightning-address', 'rules'] as ('name' | 'lightning-address' | 'rules')[],
};

const begin = { challengeId: 'ch', options: { challenge: 'aa' } };
const beginWithRp = {
  challengeId: 'ch',
  options: { challenge: 'aa', rpId: 'localhost' },
};

let stubInstalledPublicKeyCredential = false;

function stubSignalUnknownCredential(
  impl: (
    this: unknown,
    options?: { rpId: string; credentialId: string },
  ) => Promise<void> = async () => undefined,
): ReturnType<typeof vi.fn> {
  let ctor: object;
  const existing = globalThis.PublicKeyCredential as unknown;
  if (typeof existing === 'function') {
    ctor = existing;
  } else {
    class DummyPublicKeyCredential {}
    Object.defineProperty(globalThis, 'PublicKeyCredential', {
      configurable: true,
      writable: true,
      value: DummyPublicKeyCredential,
    });
    ctor = DummyPublicKeyCredential;
    stubInstalledPublicKeyCredential = true;
  }
  const fn = vi.fn(function (
    this: unknown,
    options: { rpId: string; credentialId: string },
  ): Promise<void> {
    return impl.call(this, options);
  });
  Object.defineProperty(ctor, 'signalUnknownCredential', {
    configurable: true,
    writable: true,
    value: fn,
  });
  return fn;
}

beforeEach(() => {
  useAuthStore.setState({ session: null, account: null, wrongAccount: false });
  delete process.env.NEXT_PUBLIC_BREEZ_API_KEY;
  vi.mocked(isInAppBrowser).mockReturnValue(false);
  vi.mocked(startPasskeyRegistration).mockReset().mockResolvedValue(begin);
  vi.mocked(finishPasskeyRegistration).mockReset().mockResolvedValue({ token: 'tok', account });
  vi.mocked(startPasskeyAuthentication).mockReset().mockResolvedValue(begin);
  vi.mocked(finishPasskeyAuthentication).mockReset().mockResolvedValue({ token: 'tok', account });
  vi.mocked(obtainPrfFirst).mockReset().mockResolvedValue(new Uint8Array(32).fill(7));
  vi.mocked(prfEvalFirstSalt).mockReset().mockResolvedValue(new Uint8Array(32).fill(1));
  vi.mocked(readPrfFirst).mockReset().mockReturnValue(undefined);
  vi.mocked(requestOptionsFromJSON)
    .mockReset()
    .mockReturnValue({
      challenge: new ArrayBuffer(1),
      extensions: {
        prf: { eval: { first: new Uint8Array(32).fill(1).buffer } },
      },
    });
  vi.mocked(rememberSessionPhrase).mockClear();
  const ctor = globalThis.PublicKeyCredential as unknown;
  if (typeof ctor === 'function' || (typeof ctor === 'object' && ctor !== null)) {
    Reflect.deleteProperty(ctor, 'signalUnknownCredential');
  }
});

afterEach(() => {
  cleanup();
  if (ORIGINAL_BREEZ === undefined) {
    delete process.env.NEXT_PUBLIC_BREEZ_API_KEY;
  } else {
    process.env.NEXT_PUBLIC_BREEZ_API_KEY = ORIGINAL_BREEZ;
  }
  if (stubInstalledPublicKeyCredential) {
    Reflect.deleteProperty(globalThis, 'PublicKeyCredential');
    stubInstalledPublicKeyCredential = false;
  }
});

describe('usePasskeyLogin', () => {
  it('does not finish registration when PRF is missing', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(null, { status: 204 }));
    vi.mocked(obtainPrfFirst).mockResolvedValueOnce(null);
    const cred = { id: 'cred', type: 'public-key' };
    vi.stubGlobal('navigator', {
      ...navigator,
      credentials: { create: vi.fn().mockResolvedValue(cred), get: vi.fn() },
    });
    const { result } = renderHook(() => usePasskeyLogin());
    await act(async () => {
      result.current.register();
      result.current.submitName('Ada');
    });
    expect(finishPasskeyRegistration).not.toHaveBeenCalled();
    expect(rememberSessionPhrase).not.toHaveBeenCalled();
    expect(result.current.status).toBe('error');
    const prfBody = fetchMock.mock.calls
      .map((call) => JSON.parse(String((call[1] as RequestInit).body)) as { event?: string })
      .find((body) => body.event === 'client.passkey.register.prf');
    expect(prfBody).toEqual({
      event: 'client.passkey.register.prf',
      prfPresent: false,
      stage: 'register',
    });
    fetchMock.mockRestore();
    vi.unstubAllGlobals();
  });

  it('fails an old iPhone register when the extra key prompt is NotAllowedError', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(null, { status: 204 }));
    const challengeId = 'ab'.repeat(32);
    const accountId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
    vi.mocked(startPasskeyRegistration).mockResolvedValue({
      challengeId,
      options: {
        challenge: 'aa',
        user: { id: bytesToBase64Url(new TextEncoder().encode(accountId)), name: 'ada' },
      },
    });
    vi.mocked(obtainPrfFirst).mockRejectedValueOnce(new DOMException('no', 'NotAllowedError'));
    vi.stubGlobal('navigator', {
      ...navigator,
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5_1 like Mac OS X)',
      credentials: {
        create: vi.fn().mockResolvedValue({ id: 'cred', type: 'public-key' }),
        get: vi.fn(),
      },
    });
    const { result } = renderHook(() => usePasskeyLogin());
    await act(async () => {
      result.current.register();
    });
    expect(result.current.status).toBe('name');
    expect(startPasskeyRegistration).not.toHaveBeenCalled();
    await act(async () => {
      result.current.submitName('Ada');
    });
    expect(finishPasskeyRegistration).not.toHaveBeenCalled();
    expect(result.current.status).toBe('error');
    expect(result.current.error).toBe('login.iosVersion');
    const bodies = fetchMock.mock.calls.map(
      (call) => JSON.parse(String((call[1] as RequestInit).body)) as { event?: string },
    );
    expect(bodies.filter((body) => body.event === 'client.passkey.register.ceremony')).toEqual([
      {
        event: 'client.passkey.register.ceremony',
        stage: 'register',
        name: 'NotAllowedError',
        message: 'iOS 17.5.1 below 18 at prf. no',
        prfPresent: false,
        challengeId,
        accountId,
      },
    ]);
    fetchMock.mockRestore();
    vi.unstubAllGlobals();
  });

  it('fails an old iPhone register when create itself is NotAllowedError', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(null, { status: 204 }));
    const challengeId = 'cd'.repeat(32);
    const accountId = 'bbbbbbbb-cccc-dddd-eeee-ffffffffffff';
    vi.mocked(startPasskeyRegistration).mockResolvedValue({
      challengeId,
      options: {
        challenge: 'aa',
        user: { id: bytesToBase64Url(new TextEncoder().encode(accountId)), name: 'ada' },
      },
    });
    vi.stubGlobal('navigator', {
      ...navigator,
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5_1 like Mac OS X)',
      credentials: {
        create: vi.fn().mockRejectedValue(new DOMException('(timed out)', 'NotAllowedError')),
        get: vi.fn(),
      },
    });
    const { result } = renderHook(() => usePasskeyLogin());
    await act(async () => {
      result.current.register();
    });
    expect(result.current.status).toBe('name');
    expect(startPasskeyRegistration).not.toHaveBeenCalled();
    await act(async () => {
      result.current.submitName('Ada');
    });
    expect(finishPasskeyRegistration).not.toHaveBeenCalled();
    expect(result.current.status).toBe('error');
    expect(result.current.error).toBe('login.iosVersion');
    const bodies = fetchMock.mock.calls.map(
      (call) => JSON.parse(String((call[1] as RequestInit).body)) as { event?: string },
    );
    expect(bodies.filter((body) => body.event === 'client.passkey.register.ceremony')).toEqual([
      {
        event: 'client.passkey.register.ceremony',
        stage: 'register',
        name: 'NotAllowedError',
        message: 'iOS 17.5.1 below 18 at create. timed out',
        prfPresent: false,
        challengeId,
        accountId,
      },
    ]);
    fetchMock.mockRestore();
    vi.unstubAllGlobals();
  });

  it('keeps the version line when the browser text is empty', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal('navigator', {
      ...navigator,
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5_1 like Mac OS X)',
      credentials: {
        create: vi.fn().mockRejectedValue(new DOMException('', 'NotAllowedError')),
        get: vi.fn(),
      },
    });
    const { result } = renderHook(() => usePasskeyLogin());
    await act(async () => {
      result.current.register();
    });
    expect(result.current.status).toBe('name');
    await act(async () => {
      result.current.submitName('Ada');
    });
    const bodies = fetchMock.mock.calls.map(
      (call) => JSON.parse(String((call[1] as RequestInit).body)) as { message?: string },
    );
    expect(bodies.find((body) => body.message?.startsWith('iOS '))?.message).toBe(
      'iOS 17.5.1 below 18 at create',
    );
    expect(result.current.error).toBe('login.iosVersion');
    fetchMock.mockRestore();
    vi.unstubAllGlobals();
  });

  it('keeps the version line when the browser text has no allowlisted characters', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal('navigator', {
      ...navigator,
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5_1 like Mac OS X)',
      credentials: {
        create: vi.fn().mockRejectedValue(new DOMException('!!!', 'AbortError')),
        get: vi.fn(),
      },
    });
    const { result } = renderHook(() => usePasskeyLogin());
    await act(async () => {
      result.current.register();
    });
    expect(result.current.status).toBe('name');
    await act(async () => {
      result.current.submitName('Ada');
    });
    const bodies = fetchMock.mock.calls.map(
      (call) =>
        JSON.parse(String((call[1] as RequestInit).body)) as { message?: string; name?: string },
    );
    expect(bodies.find((body) => body.message?.startsWith('iOS '))).toMatchObject({
      name: 'AbortError',
      message: 'iOS 17.5.1 below 18 at create',
    });
    expect(result.current.error).toBe('login.iosVersion');
    fetchMock.mockRestore();
    vi.unstubAllGlobals();
  });

  it('names the iOS version when an old iPhone returns no extra key', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(null, { status: 204 }));
    const challengeId = 'ef'.repeat(32);
    vi.mocked(startPasskeyRegistration).mockResolvedValue({
      challengeId,
      options: { challenge: 'aa' },
    });
    vi.mocked(obtainPrfFirst).mockResolvedValueOnce(null);
    vi.stubGlobal('navigator', {
      ...navigator,
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
      credentials: {
        create: vi.fn().mockResolvedValue({ id: 'cred', type: 'public-key' }),
        get: vi.fn(),
      },
    });
    const { result } = renderHook(() => usePasskeyLogin());
    await act(async () => {
      result.current.register();
    });
    expect(result.current.status).toBe('name');
    expect(startPasskeyRegistration).not.toHaveBeenCalled();
    await act(async () => {
      result.current.submitName('Ada');
    });
    expect(finishPasskeyRegistration).not.toHaveBeenCalled();
    expect(result.current.status).toBe('error');
    expect(result.current.error).toBe('login.iosVersion');
    const bodies = fetchMock.mock.calls.map(
      (call) => JSON.parse(String((call[1] as RequestInit).body)) as { event?: string },
    );
    expect(bodies.filter((body) => body.event === 'client.passkey.register.prf')).toEqual([
      {
        event: 'client.passkey.register.prf',
        prfPresent: false,
        stage: 'register',
        message: 'iOS 17.0 below 18 at prf.absent',
        challengeId,
      },
    ]);
    fetchMock.mockRestore();
    vi.unstubAllGlobals();
  });

  it('fails an old Android register when create itself is NotAllowedError', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(null, { status: 204 }));
    const challengeId = 'cd'.repeat(32);
    const accountId = 'bbbbbbbb-cccc-dddd-eeee-ffffffffffff';
    vi.mocked(startPasskeyRegistration).mockResolvedValue({
      challengeId,
      options: {
        challenge: 'aa',
        user: { id: bytesToBase64Url(new TextEncoder().encode(accountId)), name: 'ada' },
      },
    });
    vi.stubGlobal('navigator', {
      ...navigator,
      userAgent:
        'Mozilla/5.0 (Linux; Android 8.1.0; Pixel) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
      credentials: {
        create: vi.fn().mockRejectedValue(new DOMException('', 'NotAllowedError')),
        get: vi.fn(),
      },
    });
    const { result } = renderHook(() => usePasskeyLogin());
    await act(async () => {
      result.current.register();
    });
    expect(result.current.status).toBe('name');
    expect(startPasskeyRegistration).not.toHaveBeenCalled();
    await act(async () => {
      result.current.submitName('Ada');
    });
    expect(finishPasskeyRegistration).not.toHaveBeenCalled();
    expect(result.current.status).toBe('error');
    expect(result.current.error).toBe('login.androidVersion');
    const bodies = fetchMock.mock.calls.map(
      (call) => JSON.parse(String((call[1] as RequestInit).body)) as { event?: string },
    );
    expect(bodies.filter((body) => body.event === 'client.passkey.register.ceremony')).toEqual([
      {
        event: 'client.passkey.register.ceremony',
        stage: 'register',
        name: 'NotAllowedError',
        message: 'Android 8.1.0 below 9 at create',
        prfPresent: false,
        challengeId,
        accountId,
      },
    ]);
    fetchMock.mockRestore();
    vi.unstubAllGlobals();
  });

  it('fails an old Android register when the extra key prompt is NotAllowedError', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(null, { status: 204 }));
    const challengeId = 'ab'.repeat(32);
    const accountId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
    vi.mocked(startPasskeyRegistration).mockResolvedValue({
      challengeId,
      options: {
        challenge: 'aa',
        user: { id: bytesToBase64Url(new TextEncoder().encode(accountId)), name: 'ada' },
      },
    });
    vi.mocked(obtainPrfFirst).mockRejectedValueOnce(new DOMException('', 'NotAllowedError'));
    vi.stubGlobal('navigator', {
      ...navigator,
      userAgent:
        'Mozilla/5.0 (Linux; Android 8.1.0; Pixel) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
      credentials: {
        create: vi.fn().mockResolvedValue({ id: 'cred', type: 'public-key' }),
        get: vi.fn(),
      },
    });
    const { result } = renderHook(() => usePasskeyLogin());
    await act(async () => {
      result.current.register();
    });
    expect(result.current.status).toBe('name');
    expect(startPasskeyRegistration).not.toHaveBeenCalled();
    await act(async () => {
      result.current.submitName('Ada');
    });
    expect(finishPasskeyRegistration).not.toHaveBeenCalled();
    expect(result.current.status).toBe('error');
    expect(result.current.error).toBe('login.androidVersion');
    const bodies = fetchMock.mock.calls.map(
      (call) => JSON.parse(String((call[1] as RequestInit).body)) as { event?: string },
    );
    expect(bodies.filter((body) => body.event === 'client.passkey.register.ceremony')).toEqual([
      {
        event: 'client.passkey.register.ceremony',
        stage: 'register',
        name: 'NotAllowedError',
        message: 'Android 8.1.0 below 9 at prf',
        prfPresent: false,
        challengeId,
        accountId,
      },
    ]);
    fetchMock.mockRestore();
    vi.unstubAllGlobals();
  });

  it('names the Android version when an old Android returns no extra key', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(null, { status: 204 }));
    const challengeId = 'ef'.repeat(32);
    vi.mocked(startPasskeyRegistration).mockResolvedValue({
      challengeId,
      options: { challenge: 'aa' },
    });
    vi.mocked(obtainPrfFirst).mockResolvedValueOnce(null);
    vi.stubGlobal('navigator', {
      ...navigator,
      userAgent:
        'Mozilla/5.0 (Linux; Android 8.1.0; Pixel) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
      credentials: {
        create: vi.fn().mockResolvedValue({ id: 'cred', type: 'public-key' }),
        get: vi.fn(),
      },
    });
    const { result } = renderHook(() => usePasskeyLogin());
    await act(async () => {
      result.current.register();
    });
    expect(result.current.status).toBe('name');
    expect(startPasskeyRegistration).not.toHaveBeenCalled();
    await act(async () => {
      result.current.submitName('Ada');
    });
    expect(finishPasskeyRegistration).not.toHaveBeenCalled();
    expect(result.current.status).toBe('error');
    expect(result.current.error).toBe('login.androidVersion');
    const bodies = fetchMock.mock.calls.map(
      (call) => JSON.parse(String((call[1] as RequestInit).body)) as { event?: string },
    );
    expect(bodies.filter((body) => body.event === 'client.passkey.register.prf')).toEqual([
      {
        event: 'client.passkey.register.prf',
        prfPresent: false,
        stage: 'register',
        message: 'Android 8.1.0 below 9 at prf.absent',
        challengeId,
      },
    ]);
    fetchMock.mockRestore();
    vi.unstubAllGlobals();
  });

  it('names the installed Android version on a failed login without blocking', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(null, { status: 204 }));
    const challengeId = 'ef'.repeat(32);
    vi.mocked(startPasskeyAuthentication).mockResolvedValue({
      challengeId,
      options: { challenge: 'aa' },
    });
    vi.stubGlobal('navigator', {
      ...navigator,
      userAgent:
        'Mozilla/5.0 (Linux; Android 14; Pixel) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
      credentials: {
        get: vi.fn().mockRejectedValue(new DOMException('', 'NotAllowedError')),
        create: vi.fn(),
      },
    });
    const { result } = renderHook(() => usePasskeyLogin());
    await act(async () => {
      result.current.login();
    });
    expect(result.current.status).toBe('choice');
    expect(result.current.error).toBeNull();
    const bodies = fetchMock.mock.calls.map(
      (call) =>
        JSON.parse(String((call[1] as RequestInit).body)) as { event?: string; message?: string },
    );
    const failed = bodies.filter((body) => body.event === 'client.passkey.login.fail');
    expect(failed[0]?.message?.startsWith('Android 14')).toBe(true);
    fetchMock.mockRestore();
    vi.unstubAllGlobals();
  });

  it('appends the browser text when an old Android create is NotAllowedError', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(null, { status: 204 }));
    const challengeId = 'cd'.repeat(32);
    const accountId = 'bbbbbbbb-cccc-dddd-eeee-ffffffffffff';
    vi.mocked(startPasskeyRegistration).mockResolvedValue({
      challengeId,
      options: {
        challenge: 'aa',
        user: { id: bytesToBase64Url(new TextEncoder().encode(accountId)), name: 'ada' },
      },
    });
    vi.stubGlobal('navigator', {
      ...navigator,
      userAgent:
        'Mozilla/5.0 (Linux; Android 8.1.0; Pixel) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
      credentials: {
        create: vi.fn().mockRejectedValue(new DOMException('(timed out)', 'NotAllowedError')),
        get: vi.fn(),
      },
    });
    const { result } = renderHook(() => usePasskeyLogin());
    await act(async () => {
      result.current.register();
    });
    expect(result.current.status).toBe('name');
    expect(startPasskeyRegistration).not.toHaveBeenCalled();
    await act(async () => {
      result.current.submitName('Ada');
    });
    expect(finishPasskeyRegistration).not.toHaveBeenCalled();
    expect(result.current.status).toBe('error');
    expect(result.current.error).toBe('login.androidVersion');
    const bodies = fetchMock.mock.calls.map(
      (call) => JSON.parse(String((call[1] as RequestInit).body)) as { event?: string },
    );
    expect(bodies.filter((body) => body.event === 'client.passkey.register.ceremony')).toEqual([
      {
        event: 'client.passkey.register.ceremony',
        stage: 'register',
        name: 'NotAllowedError',
        message: 'Android 8.1.0 below 9 at create. timed out',
        prfPresent: false,
        challengeId,
        accountId,
      },
    ]);
    fetchMock.mockRestore();
    vi.unstubAllGlobals();
  });

  it('prefixes a plain Android login failure that does not name the OS', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(null, { status: 204 }));
    const challengeId = 'ef'.repeat(32);
    vi.mocked(startPasskeyAuthentication).mockResolvedValue({
      challengeId,
      options: { challenge: 'aa' },
    });
    vi.stubGlobal('navigator', {
      ...navigator,
      userAgent:
        'Mozilla/5.0 (Linux; Android 14; Pixel) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
      credentials: {
        get: vi.fn().mockRejectedValue(new DOMException('no', 'NotAllowedError')),
        create: vi.fn(),
      },
    });
    const { result } = renderHook(() => usePasskeyLogin());
    await act(async () => {
      result.current.login();
    });
    expect(finishPasskeyAuthentication).not.toHaveBeenCalled();
    expect(result.current.status).toBe('choice');
    expect(result.current.error).toBeNull();
    const bodies = fetchMock.mock.calls.map(
      (call) =>
        JSON.parse(String((call[1] as RequestInit).body)) as { event?: string; message?: string },
    );
    const failed = bodies.filter((body) => body.event === 'client.passkey.login.fail');
    expect(failed[0]?.message).toBe('Android 14. no');
    fetchMock.mockRestore();
    vi.unstubAllGlobals();
  });

  it('keeps an Android login failure that is only the OS label', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(null, { status: 204 }));
    const challengeId = 'ef'.repeat(32);
    vi.mocked(startPasskeyAuthentication).mockResolvedValue({
      challengeId,
      options: { challenge: 'aa' },
    });
    vi.stubGlobal('navigator', {
      ...navigator,
      userAgent:
        'Mozilla/5.0 (Linux; Android 14; Pixel) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
      credentials: {
        get: vi.fn().mockRejectedValue(new DOMException('Android 14', 'NotAllowedError')),
        create: vi.fn(),
      },
    });
    const { result } = renderHook(() => usePasskeyLogin());
    await act(async () => {
      result.current.login();
    });
    expect(finishPasskeyAuthentication).not.toHaveBeenCalled();
    expect(result.current.status).toBe('choice');
    expect(result.current.error).toBeNull();
    const bodies = fetchMock.mock.calls.map(
      (call) =>
        JSON.parse(String((call[1] as RequestInit).body)) as { event?: string; message?: string },
    );
    const failed = bodies.filter((body) => body.event === 'client.passkey.login.fail');
    expect(failed[0]?.message).toBe('Android 14');
    fetchMock.mockRestore();
    vi.unstubAllGlobals();
  });

  it('keeps an Android login failure that already starts with the OS label and a space', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(null, { status: 204 }));
    const challengeId = 'ef'.repeat(32);
    vi.mocked(startPasskeyAuthentication).mockResolvedValue({
      challengeId,
      options: { challenge: 'aa' },
    });
    vi.stubGlobal('navigator', {
      ...navigator,
      userAgent:
        'Mozilla/5.0 (Linux; Android 14; Pixel) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
      credentials: {
        get: vi.fn().mockRejectedValue(new DOMException('Android 14 already', 'NotAllowedError')),
        create: vi.fn(),
      },
    });
    const { result } = renderHook(() => usePasskeyLogin());
    await act(async () => {
      result.current.login();
    });
    expect(finishPasskeyAuthentication).not.toHaveBeenCalled();
    expect(result.current.status).toBe('choice');
    expect(result.current.error).toBeNull();
    const bodies = fetchMock.mock.calls.map(
      (call) =>
        JSON.parse(String((call[1] as RequestInit).body)) as { event?: string; message?: string },
    );
    const failed = bodies.filter((body) => body.event === 'client.passkey.login.fail');
    expect(failed[0]?.message).toBe('Android 14 already');
    fetchMock.mockRestore();
    vi.unstubAllGlobals();
  });

  it('keeps an Android login failure that already starts with the OS label and a period', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(null, { status: 204 }));
    const challengeId = 'ef'.repeat(32);
    vi.mocked(startPasskeyAuthentication).mockResolvedValue({
      challengeId,
      options: { challenge: 'aa' },
    });
    vi.stubGlobal('navigator', {
      ...navigator,
      userAgent:
        'Mozilla/5.0 (Linux; Android 14; Pixel) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
      credentials: {
        get: vi.fn().mockRejectedValue(new DOMException('Android 14. already', 'NotAllowedError')),
        create: vi.fn(),
      },
    });
    const { result } = renderHook(() => usePasskeyLogin());
    await act(async () => {
      result.current.login();
    });
    expect(finishPasskeyAuthentication).not.toHaveBeenCalled();
    expect(result.current.status).toBe('choice');
    expect(result.current.error).toBeNull();
    const bodies = fetchMock.mock.calls.map(
      (call) =>
        JSON.parse(String((call[1] as RequestInit).body)) as { event?: string; message?: string },
    );
    const failed = bodies.filter((body) => body.event === 'client.passkey.login.fail');
    expect(failed[0]?.message).toBe('Android 14. already');
    fetchMock.mockRestore();
    vi.unstubAllGlobals();
  });

  it('keeps a failed Android login diagnostic inside 120 characters when the version is long', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(null, { status: 204 }));
    const challengeId = 'ef'.repeat(32);
    vi.mocked(startPasskeyAuthentication).mockResolvedValue({
      challengeId,
      options: { challenge: 'aa' },
    });
    vi.stubGlobal('navigator', {
      ...navigator,
      userAgent: `Mozilla/5.0 (Linux; Android 8.1.${'0'.repeat(40)}; Pixel) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36`,
      credentials: {
        get: vi.fn().mockRejectedValue(new DOMException('no', 'NotAllowedError')),
        create: vi.fn(),
      },
    });
    const { result } = renderHook(() => usePasskeyLogin());
    await act(async () => {
      result.current.login();
    });
    expect(finishPasskeyAuthentication).not.toHaveBeenCalled();
    expect(result.current.status).toBe('choice');
    expect(result.current.error).toBeNull();
    const bodies = fetchMock.mock.calls.map(
      (call) =>
        JSON.parse(String((call[1] as RequestInit).body)) as { event?: string; message?: string },
    );
    const failed = bodies.filter((body) => body.event === 'client.passkey.login.fail');
    expect(failed[0]?.message?.length).toBeLessThanOrEqual(120);
    expect(failed[0]?.message).toMatch(/^[A-Za-z0-9._: -]{1,120}$/);
    fetchMock.mockRestore();
    vi.unstubAllGlobals();
  });

  it('keeps an old Android register diagnostic inside 120 characters when the version is long', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(null, { status: 204 }));
    const challengeId = 'cd'.repeat(32);
    const accountId = 'bbbbbbbb-cccc-dddd-eeee-ffffffffffff';
    vi.mocked(startPasskeyRegistration).mockResolvedValue({
      challengeId,
      options: {
        challenge: 'aa',
        user: { id: bytesToBase64Url(new TextEncoder().encode(accountId)), name: 'ada' },
      },
    });
    vi.stubGlobal('navigator', {
      ...navigator,
      userAgent: `Mozilla/5.0 (Linux; Android 8.1.${'0'.repeat(40)}; Pixel) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36`,
      credentials: {
        create: vi.fn().mockRejectedValue(new DOMException('n'.repeat(200), 'NotAllowedError')),
        get: vi.fn(),
      },
    });
    const { result } = renderHook(() => usePasskeyLogin());
    await act(async () => {
      result.current.register();
    });
    expect(result.current.status).toBe('name');
    expect(startPasskeyRegistration).not.toHaveBeenCalled();
    await act(async () => {
      result.current.submitName('Ada');
    });
    expect(finishPasskeyRegistration).not.toHaveBeenCalled();
    expect(result.current.status).toBe('error');
    expect(result.current.error).toBe('login.androidVersion');
    const bodies = fetchMock.mock.calls.map(
      (call) =>
        JSON.parse(String((call[1] as RequestInit).body)) as { event?: string; message?: string },
    );
    const ceremony = bodies.filter((body) => body.event === 'client.passkey.register.ceremony');
    expect(ceremony[0]?.message?.length).toBeLessThanOrEqual(120);
    expect(ceremony[0]?.message).toMatch(/^[A-Za-z0-9._: -]{1,120}$/);
    expect(ceremony[0]?.message?.startsWith('Android ')).toBe(true);
    fetchMock.mockRestore();
    vi.unstubAllGlobals();
  });

  it('leaves a desktop login failure unprefixed', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(null, { status: 204 }));
    const challengeId = 'ef'.repeat(32);
    vi.mocked(startPasskeyAuthentication).mockResolvedValue({
      challengeId,
      options: { challenge: 'aa' },
    });
    vi.stubGlobal('navigator', {
      ...navigator,
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/120.0.0.0',
      credentials: {
        get: vi.fn().mockRejectedValue(new DOMException('no', 'NotAllowedError')),
        create: vi.fn(),
      },
    });
    const { result } = renderHook(() => usePasskeyLogin());
    await act(async () => {
      result.current.login();
    });
    expect(result.current.status).toBe('choice');
    expect(result.current.error).toBeNull();
    const bodies = fetchMock.mock.calls.map(
      (call) =>
        JSON.parse(String((call[1] as RequestInit).body)) as { event?: string; message?: string },
    );
    const failed = bodies.filter((body) => body.event === 'client.passkey.login.fail');
    expect(failed[0]?.message).toBe('no');
    fetchMock.mockRestore();
    vi.unstubAllGlobals();
  });

  it('names the installed iOS version on a failed login without blocking', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(null, { status: 204 }));
    const challengeId = 'ef'.repeat(32);
    vi.mocked(startPasskeyAuthentication).mockResolvedValue({
      challengeId,
      options: { challenge: 'aa' },
    });
    vi.stubGlobal('navigator', {
      ...navigator,
      userAgent:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
      credentials: {
        get: vi.fn().mockRejectedValue(new DOMException('', 'NotAllowedError')),
        create: vi.fn(),
      },
    });
    const { result } = renderHook(() => usePasskeyLogin());
    await act(async () => {
      result.current.login();
    });
    expect(result.current.status).toBe('choice');
    expect(result.current.error).toBeNull();
    const bodies = fetchMock.mock.calls.map(
      (call) =>
        JSON.parse(String((call[1] as RequestInit).body)) as { event?: string; message?: string },
    );
    const failed = bodies.filter((body) => body.event === 'client.passkey.login.fail');
    expect(failed[0]?.message?.startsWith('iOS 18.0')).toBe(true);
    fetchMock.mockRestore();
    vi.unstubAllGlobals();
  });

  it('reports a cancelled PRF prompt and does not finish registration', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(null, { status: 204 }));
    vi.mocked(obtainPrfFirst).mockRejectedValueOnce(new DOMException('no', 'NotAllowedError'));
    vi.stubGlobal('navigator', {
      ...navigator,
      credentials: {
        create: vi.fn().mockResolvedValue({ id: 'cred', type: 'public-key' }),
        get: vi.fn(),
      },
    });
    const { result } = renderHook(() => usePasskeyLogin());
    await act(async () => {
      result.current.register();
      result.current.submitName('Ada');
    });
    expect(finishPasskeyRegistration).not.toHaveBeenCalled();
    expect(result.current.status).toBe('name');
    const bodies = fetchMock.mock.calls.map(
      (call) => JSON.parse(String((call[1] as RequestInit).body)) as { event?: string },
    );
    expect(bodies.filter((body) => body.event === 'client.passkey.register.fail')).toEqual([
      {
        event: 'client.passkey.register.fail',
        stage: 'register',
        name: 'NotAllowedError',
        message: 'no',
      },
    ]);
    fetchMock.mockRestore();
    vi.unstubAllGlobals();
  });

  it('records a dismissed register with the begin ids and does not finish', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(null, { status: 204 }));
    const challengeId = 'ab'.repeat(32);
    const accountId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
    vi.mocked(startPasskeyRegistration).mockResolvedValue({
      challengeId,
      options: {
        challenge: 'aa',
        user: { id: bytesToBase64Url(new TextEncoder().encode(accountId)), name: 'ada' },
      },
    });
    vi.mocked(obtainPrfFirst).mockRejectedValueOnce(new DOMException('no', 'NotAllowedError'));
    vi.stubGlobal('navigator', {
      ...navigator,
      credentials: {
        create: vi.fn().mockResolvedValue({ id: 'cred', type: 'public-key' }),
        get: vi.fn(),
      },
    });
    const { result } = renderHook(() => usePasskeyLogin());
    await act(async () => {
      result.current.register();
    });
    expect(result.current.status).toBe('name');
    await act(async () => {
      result.current.submitName('Ada');
    });
    expect(finishPasskeyRegistration).not.toHaveBeenCalled();
    expect(result.current.status).toBe('name');
    const bodies = fetchMock.mock.calls.map(
      (call) => JSON.parse(String((call[1] as RequestInit).body)) as { event?: string },
    );
    expect(bodies.filter((body) => body.event === 'client.passkey.register.fail')).toEqual([
      {
        event: 'client.passkey.register.fail',
        stage: 'register',
        name: 'NotAllowedError',
        message: 'no',
        challengeId,
        accountId,
      },
    ]);
    fetchMock.mockRestore();
    vi.unstubAllGlobals();
  });

  it('records a failed login even when no account exists', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(null, { status: 204 }));
    const challengeId = 'ef'.repeat(32);
    vi.mocked(startPasskeyAuthentication).mockResolvedValue({
      challengeId,
      options: { challenge: 'aa' },
    });
    const create = vi.fn();
    vi.stubGlobal('navigator', {
      ...navigator,
      credentials: {
        get: vi.fn().mockRejectedValue(new DOMException('no', 'NotAllowedError')),
        create,
      },
    });
    const { result } = renderHook(() => usePasskeyLogin());
    await act(async () => {
      result.current.login();
    });
    expect(result.current.status).toBe('choice');
    expect(create).not.toHaveBeenCalled();
    expect(startPasskeyRegistration).not.toHaveBeenCalled();
    expect(finishPasskeyAuthentication).not.toHaveBeenCalled();
    const bodies = fetchMock.mock.calls.map(
      (call) => JSON.parse(String((call[1] as RequestInit).body)) as { event?: string },
    );
    const failed = bodies.filter((body) => body.event === 'client.passkey.login.fail');
    expect(failed).toEqual([
      {
        event: 'client.passkey.login.fail',
        stage: 'login',
        name: 'NotAllowedError',
        message: 'no',
        challengeId,
      },
    ]);
    expect(failed[0]).not.toHaveProperty('accountId');
    fetchMock.mockRestore();
    vi.unstubAllGlobals();
  });

  it('records a failed login when the browser message is empty', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(null, { status: 204 }));
    const challengeId = '12'.repeat(32);
    vi.mocked(startPasskeyAuthentication).mockResolvedValue({
      challengeId,
      options: { challenge: 'aa' },
    });
    vi.stubGlobal('navigator', {
      ...navigator,
      credentials: {
        get: vi.fn().mockRejectedValue(new DOMException('', 'NotAllowedError')),
        create: vi.fn(),
      },
    });
    const { result } = renderHook(() => usePasskeyLogin());
    await act(async () => {
      result.current.login();
    });
    expect(result.current.status).toBe('choice');
    const bodies = fetchMock.mock.calls.map(
      (call) => JSON.parse(String((call[1] as RequestInit).body)) as Record<string, unknown>,
    );
    const failed = bodies.filter((body) => body['event'] === 'client.passkey.login.fail');
    expect(failed).toEqual([
      {
        event: 'client.passkey.login.fail',
        stage: 'login',
        name: 'NotAllowedError',
        challengeId,
      },
    ]);
    expect(failed[0]).not.toHaveProperty('message');
    expect(failed[0]).not.toHaveProperty('accountId');
    fetchMock.mockRestore();
    vi.unstubAllGlobals();
  });

  it('reports a failed PRF prompt and shows the registration error', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(null, { status: 204 }));
    vi.mocked(startPasskeyRegistration).mockResolvedValue({
      challengeId: 'cd'.repeat(32),
      options: {
        challenge: 'aa',
        user: {
          id: bytesToBase64Url(new TextEncoder().encode('bbbbbbbb-cccc-dddd-eeee-ffffffffffff')),
          name: 'ada',
        },
      },
    });
    vi.mocked(obtainPrfFirst).mockRejectedValueOnce(new TypeError('Boom'));
    vi.stubGlobal('navigator', {
      ...navigator,
      credentials: {
        create: vi.fn().mockResolvedValue({ id: 'cred', type: 'public-key' }),
        get: vi.fn(),
      },
    });
    const { result } = renderHook(() => usePasskeyLogin());
    await act(async () => {
      result.current.register();
      result.current.submitName('Ada');
    });
    expect(finishPasskeyRegistration).not.toHaveBeenCalled();
    expect(result.current.status).toBe('error');
    const bodies = fetchMock.mock.calls.map(
      (call) => JSON.parse(String((call[1] as RequestInit).body)) as { event?: string },
    );
    expect(bodies.filter((body) => body.event === 'client.passkey.register.ceremony')).toEqual([
      {
        event: 'client.passkey.register.ceremony',
        stage: 'register',
        name: 'TypeError',
        message: 'Boom',
        challengeId: 'cd'.repeat(32),
        accountId: 'bbbbbbbb-cccc-dddd-eeee-ffffffffffff',
      },
    ]);
    fetchMock.mockRestore();
    vi.unstubAllGlobals();
  });

  it('omits a PRF failure whose name and message are not strings', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(null, { status: 204 }));
    vi.mocked(obtainPrfFirst).mockRejectedValueOnce({ name: 1, message: false });
    vi.stubGlobal('navigator', {
      ...navigator,
      credentials: {
        create: vi.fn().mockResolvedValue({ id: 'cred', type: 'public-key' }),
        get: vi.fn(),
      },
    });
    const { result } = renderHook(() => usePasskeyLogin());
    await act(async () => {
      result.current.register();
      result.current.submitName('Ada');
    });
    expect(result.current.status).toBe('error');
    const bodies = fetchMock.mock.calls.map(
      (call) => JSON.parse(String((call[1] as RequestInit).body)) as { event?: string },
    );
    expect(bodies.filter((body) => body.event === 'client.passkey.register.ceremony')).toEqual([
      { event: 'client.passkey.register.ceremony', stage: 'register' },
    ]);
    fetchMock.mockRestore();
    vi.unstubAllGlobals();
  });

  it('registers a passkey and stores the session', async () => {
    const cred = { id: 'cred', type: 'public-key' };
    vi.stubGlobal('navigator', {
      ...navigator,
      credentials: { create: vi.fn().mockResolvedValue(cred), get: vi.fn() },
    });
    const { result } = renderHook(() => usePasskeyLogin());
    await act(async () => {
      result.current.register();
      result.current.submitName('Ada');
    });
    expect(result.current.status).toBe('idle');
    expect(useAuthStore.getState().session).toBe('tok');
    expect(finishPasskeyRegistration).toHaveBeenCalled();
    expect(rememberSessionPhrase).not.toHaveBeenCalled();
    const createArg = vi.mocked(navigator.credentials.create).mock.calls[0]?.[0] as
      CredentialCreationOptions | undefined;
    expect(createArg?.publicKey?.extensions).toHaveProperty('prf.eval.first');
    expect(vi.mocked(startPasskeyRegistration).mock.calls[0]?.[0]).toBeUndefined();
    vi.unstubAllGlobals();
  });

  it('register(viewKey) forwards the viewKey to startPasskeyRegistration', async () => {
    const viewKey = 'b'.repeat(64);
    const cred = { id: 'cred', type: 'public-key' };
    vi.stubGlobal('navigator', {
      ...navigator,
      credentials: { create: vi.fn().mockResolvedValue(cred), get: vi.fn() },
    });
    const { result } = renderHook(() => usePasskeyLogin());
    await act(async () => {
      result.current.register(viewKey);
    });
    expect(startPasskeyRegistration).toHaveBeenCalledWith(viewKey);
    expect(result.current.status).not.toBe('name');
    expect(useAuthStore.getState().session).toBe('tok');
    vi.unstubAllGlobals();
  });

  it('register without a view key opens the name step', () => {
    const { result } = renderHook(() => usePasskeyLogin());
    act(() => {
      result.current.register();
    });
    expect(result.current.status).toBe('name');
    expect(result.current.nameError).toBeNull();
    expect(startPasskeyRegistration).not.toHaveBeenCalled();
  });

  it('submitName forwards the normalized name to startPasskeyRegistration', async () => {
    const cred = { id: 'cred', type: 'public-key' };
    vi.stubGlobal('navigator', {
      ...navigator,
      credentials: { create: vi.fn().mockResolvedValue(cred), get: vi.fn() },
    });
    const { result } = renderHook(() => usePasskeyLogin());
    await act(async () => {
      result.current.submitName('Ada');
    });
    expect(startPasskeyRegistration).toHaveBeenCalledWith(undefined, 'ada');
    vi.unstubAllGlobals();
  });

  it('submitName stays on name when the typed name is invalid', () => {
    const { result } = renderHook(() => usePasskeyLogin());
    act(() => {
      result.current.submitName('Ada Lovelace');
    });
    expect(startPasskeyRegistration).not.toHaveBeenCalled();
    expect(result.current.status).toBe('name');
    expect(result.current.nameError).toBe('invalid');
  });

  it('taken username stays on name', async () => {
    vi.mocked(startPasskeyRegistration).mockRejectedValue(new Error('Username is already in use'));
    const { result } = renderHook(() => usePasskeyLogin());
    await act(async () => {
      result.current.submitName('Ada');
    });
    expect(result.current.status).toBe('name');
    expect(result.current.nameError).toBe('taken');
    expect(result.current.status).not.toBe('error');
  });

  it('invalid username from begin stays on name', async () => {
    vi.mocked(startPasskeyRegistration).mockRejectedValue(
      new Error('Username must be 1–32 characters of a-z, 0-9, hyphen, underscore, or dot'),
    );
    const { result } = renderHook(() => usePasskeyLogin());
    await act(async () => {
      result.current.submitName('Ada');
    });
    expect(result.current.status).toBe('name');
    expect(result.current.nameError).toBe('invalid');
  });

  it('named create NotAllowedError returns to name', async () => {
    vi.stubGlobal('navigator', {
      ...navigator,
      credentials: {
        create: vi.fn().mockRejectedValue(new DOMException('no', 'NotAllowedError')),
        get: vi.fn(),
      },
    });
    const { result } = renderHook(() => usePasskeyLogin());
    await act(async () => {
      result.current.submitName('Ada');
    });
    expect(result.current.status).toBe('name');
    expect(result.current.status).not.toBe('idle');
    expect(result.current.status).not.toBe('choice');
    expect(result.current.status).not.toBe('error');
    vi.unstubAllGlobals();
  });

  it('retry after register(viewKey) resends the same viewKey', async () => {
    const viewKey = 'c'.repeat(64);
    vi.mocked(startPasskeyRegistration).mockRejectedValue(new Error('nope'));
    const { result } = renderHook(() => usePasskeyLogin());
    await act(async () => {
      result.current.register(viewKey);
    });
    expect(result.current.status).toBe('error');
    expect(startPasskeyRegistration).toHaveBeenCalledWith(viewKey);
    await act(async () => {
      result.current.retry();
    });
    expect(startPasskeyRegistration).toHaveBeenCalledTimes(2);
    expect(vi.mocked(startPasskeyRegistration).mock.calls[1]?.[0]).toBe(viewKey);
  });

  it('authenticates with a passkey', async () => {
    const cred = { id: 'cred', type: 'public-key' };
    vi.stubGlobal('navigator', {
      ...navigator,
      credentials: { create: vi.fn(), get: vi.fn().mockResolvedValue(cred) },
    });
    const { result } = renderHook(() => usePasskeyLogin());
    await act(async () => {
      result.current.authenticate();
    });
    expect(useAuthStore.getState().account?.id).toBe('acc_1');
    expect(rememberSessionPhrase).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('login uses an existing passkey without creating one', async () => {
    const cred = { id: 'cred', type: 'public-key' };
    const create = vi.fn();
    vi.stubGlobal('navigator', {
      ...navigator,
      credentials: { create, get: vi.fn().mockResolvedValue(cred) },
    });
    const { result } = renderHook(() => usePasskeyLogin());
    await act(async () => {
      result.current.login();
    });
    expect(useAuthStore.getState().account?.id).toBe('acc_1');
    expect(create).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('retries the single-button flow after an authenticate error', async () => {
    vi.mocked(startPasskeyAuthentication).mockRejectedValueOnce(new Error('nope'));
    const { result } = renderHook(() => usePasskeyLogin());
    await act(async () => {
      result.current.login();
    });
    expect(result.current.status).toBe('error');
    expect(startPasskeyRegistration).not.toHaveBeenCalled();
    const cred = { id: 'cred', type: 'public-key' };
    vi.stubGlobal('navigator', {
      ...navigator,
      credentials: {
        get: vi.fn().mockRejectedValue(new DOMException('no', 'NotAllowedError')),
        create: vi.fn().mockResolvedValue(cred),
      },
    });
    await act(async () => {
      result.current.retry();
    });
    expect(startPasskeyAuthentication).toHaveBeenCalledTimes(2);
    expect(startPasskeyRegistration).not.toHaveBeenCalled();
    expect(result.current.status).toBe('choice');
    expect(useAuthStore.getState().session).toBeNull();
    vi.unstubAllGlobals();
  });

  it('login WrongAccountError from finish does not start registration', async () => {
    const cred = { id: 'cred', type: 'public-key' };
    vi.stubGlobal('navigator', {
      ...navigator,
      credentials: { create: vi.fn(), get: vi.fn().mockResolvedValue(cred) },
    });
    vi.mocked(finishPasskeyAuthentication).mockRejectedValue(new WrongAccountError());
    const { result } = renderHook(() => usePasskeyLogin());
    await act(async () => {
      result.current.login();
    });
    expect(result.current.status).toBe('error');
    expect(result.current.error).toBe(WRONG_ACCOUNT_ERROR);
    expect(startPasskeyRegistration).not.toHaveBeenCalled();
    expect(useAuthStore.getState().session).toBeNull();
    expect(useAuthStore.getState().wrongAccount).toBe(true);
    vi.unstubAllGlobals();
  });

  it('finish Unknown credential sets unknown and signals the offered id', async () => {
    const cred = { id: 'cred', type: 'public-key' };
    const signal = stubSignalUnknownCredential();
    vi.mocked(startPasskeyAuthentication).mockResolvedValue(beginWithRp);
    vi.mocked(finishPasskeyAuthentication).mockRejectedValue(new UnknownCredentialError());
    vi.stubGlobal('navigator', {
      ...navigator,
      credentials: { create: vi.fn(), get: vi.fn().mockResolvedValue(cred) },
    });
    const { result } = renderHook(() => usePasskeyLogin());
    await act(async () => {
      result.current.login();
    });
    expect(result.current.status).toBe('unknown');
    expect(result.current.error).toBeNull();
    expect(signal).toHaveBeenCalledWith({ rpId: 'localhost', credentialId: 'cred' });
    expect(signal.mock.contexts[0]).toBe(globalThis.PublicKeyCredential);
    expect(startPasskeyRegistration).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('still shows unknown when signalUnknownCredential rejects', async () => {
    const cred = { id: 'cred', type: 'public-key' };
    stubSignalUnknownCredential(async () => {
      throw new Error('signal failed');
    });
    vi.mocked(startPasskeyAuthentication).mockResolvedValue(beginWithRp);
    vi.mocked(finishPasskeyAuthentication).mockRejectedValue(new UnknownCredentialError());
    vi.stubGlobal('navigator', {
      ...navigator,
      credentials: { create: vi.fn(), get: vi.fn().mockResolvedValue(cred) },
    });
    const { result } = renderHook(() => usePasskeyLogin());
    await act(async () => {
      result.current.login();
    });
    expect(result.current.status).toBe('unknown');
    vi.unstubAllGlobals();
  });

  it('still shows unknown when signalUnknownCredential is absent', async () => {
    const cred = { id: 'cred', type: 'public-key' };
    vi.mocked(startPasskeyAuthentication).mockResolvedValue(beginWithRp);
    vi.mocked(finishPasskeyAuthentication).mockRejectedValue(new UnknownCredentialError());
    vi.stubGlobal('navigator', {
      ...navigator,
      credentials: { create: vi.fn(), get: vi.fn().mockResolvedValue(cred) },
    });
    const { result } = renderHook(() => usePasskeyLogin());
    await act(async () => {
      result.current.login();
    });
    expect(result.current.status).toBe('unknown');
    vi.unstubAllGlobals();
  });

  it('still shows unknown when the constructor exists but signalUnknownCredential is not a function', async () => {
    const cred = { id: 'cred', type: 'public-key' };
    const installedConstructor = typeof globalThis.PublicKeyCredential !== 'function';
    if (installedConstructor) {
      class DummyPublicKeyCredential {}
      Object.defineProperty(globalThis, 'PublicKeyCredential', {
        configurable: true,
        writable: true,
        value: DummyPublicKeyCredential,
      });
    }
    vi.mocked(startPasskeyAuthentication).mockResolvedValue(beginWithRp);
    vi.mocked(finishPasskeyAuthentication).mockRejectedValue(new UnknownCredentialError());
    vi.stubGlobal('navigator', {
      ...navigator,
      credentials: { create: vi.fn(), get: vi.fn().mockResolvedValue(cred) },
    });
    try {
      const { result } = renderHook(() => usePasskeyLogin());
      await act(async () => {
        result.current.login();
      });
      expect(result.current.status).toBe('unknown');
    } finally {
      vi.unstubAllGlobals();
      if (installedConstructor) {
        Reflect.deleteProperty(globalThis, 'PublicKeyCredential');
      }
    }
  });

  it('does not signal on a different finish 400 and shows error', async () => {
    const cred = { id: 'cred', type: 'public-key' };
    const signal = stubSignalUnknownCredential();
    vi.mocked(startPasskeyAuthentication).mockResolvedValue(beginWithRp);
    vi.mocked(finishPasskeyAuthentication).mockRejectedValue(
      new Error('Failed to finish passkey authentication: 400'),
    );
    vi.stubGlobal('navigator', {
      ...navigator,
      credentials: { create: vi.fn(), get: vi.fn().mockResolvedValue(cred) },
    });
    const { result } = renderHook(() => usePasskeyLogin());
    await act(async () => {
      result.current.login();
    });
    expect(result.current.status).toBe('error');
    expect(signal).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('skips the signal when rpId is missing and still shows unknown', async () => {
    const cred = { id: 'cred', type: 'public-key' };
    const signal = stubSignalUnknownCredential();
    vi.mocked(finishPasskeyAuthentication).mockRejectedValue(new UnknownCredentialError());
    vi.stubGlobal('navigator', {
      ...navigator,
      credentials: { create: vi.fn(), get: vi.fn().mockResolvedValue(cred) },
    });
    const { result } = renderHook(() => usePasskeyLogin());
    await act(async () => {
      result.current.login();
    });
    expect(result.current.status).toBe('unknown');
    expect(signal).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('skips the signal when rpId is empty and still shows unknown', async () => {
    const cred = { id: 'cred', type: 'public-key' };
    const signal = stubSignalUnknownCredential();
    vi.mocked(startPasskeyAuthentication).mockResolvedValue({
      challengeId: 'ch',
      options: { challenge: 'aa', rpId: '' },
    });
    vi.mocked(finishPasskeyAuthentication).mockRejectedValue(new UnknownCredentialError());
    vi.stubGlobal('navigator', {
      ...navigator,
      credentials: { create: vi.fn(), get: vi.fn().mockResolvedValue(cred) },
    });
    const { result } = renderHook(() => usePasskeyLogin());
    await act(async () => {
      result.current.login();
    });
    expect(result.current.status).toBe('unknown');
    expect(signal).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('skips the signal when the credential id is empty and still shows unknown', async () => {
    const cred = { id: '', type: 'public-key' };
    const signal = stubSignalUnknownCredential();
    vi.mocked(startPasskeyAuthentication).mockResolvedValue(beginWithRp);
    vi.mocked(finishPasskeyAuthentication).mockRejectedValue(new UnknownCredentialError());
    vi.stubGlobal('navigator', {
      ...navigator,
      credentials: { create: vi.fn(), get: vi.fn().mockResolvedValue(cred) },
    });
    const { result } = renderHook(() => usePasskeyLogin());
    await act(async () => {
      result.current.login();
    });
    expect(result.current.status).toBe('unknown');
    expect(signal).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('returns to the name form when a named create is dismissed after unknown', async () => {
    const cred = { id: 'cred', type: 'public-key' };
    stubSignalUnknownCredential();
    vi.mocked(startPasskeyAuthentication).mockResolvedValue(beginWithRp);
    vi.mocked(finishPasskeyAuthentication).mockRejectedValue(new UnknownCredentialError());
    const create = vi
      .fn()
      .mockRejectedValueOnce(new DOMException('no', 'NotAllowedError'))
      .mockRejectedValueOnce(new DOMException('aborted', 'AbortError'));
    vi.stubGlobal('navigator', {
      ...navigator,
      credentials: { create, get: vi.fn().mockResolvedValue(cred) },
    });
    const { result } = renderHook(() => usePasskeyLogin());
    await act(async () => {
      result.current.login();
    });
    expect(result.current.status).toBe('unknown');
    await act(async () => {
      result.current.register();
      result.current.submitName('Ada');
    });
    expect(result.current.status).toBe('name');
    expect(create).toHaveBeenCalledTimes(1);
    await act(async () => {
      result.current.register();
      result.current.submitName('Ada');
    });
    expect(result.current.status).toBe('name');
    expect(create).toHaveBeenCalledTimes(2);
    vi.unstubAllGlobals();
  });

  it('stays on unknown when Try again login is dismissed', async () => {
    const cred = { id: 'cred', type: 'public-key' };
    stubSignalUnknownCredential();
    vi.mocked(startPasskeyAuthentication).mockResolvedValue(beginWithRp);
    vi.mocked(finishPasskeyAuthentication).mockRejectedValue(new UnknownCredentialError());
    const get = vi
      .fn()
      .mockResolvedValueOnce(cred)
      .mockRejectedValueOnce(new DOMException('no', 'NotAllowedError'));
    vi.stubGlobal('navigator', {
      ...navigator,
      credentials: { create: vi.fn(), get },
    });
    const { result } = renderHook(() => usePasskeyLogin());
    await act(async () => {
      result.current.login();
    });
    expect(result.current.status).toBe('unknown');
    await act(async () => {
      result.current.login();
    });
    expect(result.current.status).toBe('unknown');
    vi.unstubAllGlobals();
  });

  it('cancel from unknown returns to idle', async () => {
    const cred = { id: 'cred', type: 'public-key' };
    stubSignalUnknownCredential();
    vi.mocked(startPasskeyAuthentication).mockResolvedValue(beginWithRp);
    vi.mocked(finishPasskeyAuthentication).mockRejectedValue(new UnknownCredentialError());
    vi.stubGlobal('navigator', {
      ...navigator,
      credentials: { create: vi.fn(), get: vi.fn().mockResolvedValue(cred) },
    });
    const { result } = renderHook(() => usePasskeyLogin());
    await act(async () => {
      result.current.login();
    });
    expect(result.current.status).toBe('unknown');
    act(() => {
      result.current.cancel();
    });
    expect(result.current.status).toBe('idle');
    vi.unstubAllGlobals();
  });

  it('returns to the name form when dismissed after choice then unknown', async () => {
    const cred = { id: 'cred', type: 'public-key' };
    stubSignalUnknownCredential();
    const get = vi
      .fn()
      .mockRejectedValueOnce(new DOMException('no', 'NotAllowedError'))
      .mockResolvedValueOnce(cred);
    const create = vi.fn().mockRejectedValue(new DOMException('no', 'NotAllowedError'));
    vi.mocked(startPasskeyAuthentication).mockResolvedValue(beginWithRp);
    vi.mocked(finishPasskeyAuthentication).mockRejectedValue(new UnknownCredentialError());
    vi.stubGlobal('navigator', {
      ...navigator,
      credentials: { create, get },
    });
    const { result } = renderHook(() => usePasskeyLogin());
    await act(async () => {
      result.current.login();
    });
    expect(result.current.status).toBe('choice');
    await act(async () => {
      result.current.authenticate();
    });
    expect(result.current.status).toBe('unknown');
    await act(async () => {
      result.current.register();
      result.current.submitName('Ada');
    });
    expect(result.current.status).toBe('name');
    vi.unstubAllGlobals();
  });

  it('clears unknown after a later successful register', async () => {
    const cred = { id: 'cred', type: 'public-key' };
    stubSignalUnknownCredential();
    vi.mocked(startPasskeyAuthentication).mockResolvedValue(beginWithRp);
    vi.mocked(finishPasskeyAuthentication).mockRejectedValue(new UnknownCredentialError());
    vi.stubGlobal('navigator', {
      ...navigator,
      credentials: {
        create: vi.fn().mockResolvedValue(cred),
        get: vi.fn().mockResolvedValue(cred),
      },
    });
    const { result } = renderHook(() => usePasskeyLogin());
    await act(async () => {
      result.current.login();
    });
    expect(result.current.status).toBe('unknown');
    await act(async () => {
      result.current.register();
      result.current.submitName('Ada');
    });
    expect(result.current.status).toBe('idle');
    expect(useAuthStore.getState().session).toBe('tok');
    vi.unstubAllGlobals();
  });

  it('clears unknown after a later successful login', async () => {
    const cred = { id: 'cred', type: 'public-key' };
    stubSignalUnknownCredential();
    vi.mocked(startPasskeyAuthentication).mockResolvedValue(beginWithRp);
    vi.mocked(finishPasskeyAuthentication).mockRejectedValueOnce(new UnknownCredentialError());
    const get = vi
      .fn()
      .mockResolvedValueOnce(cred)
      .mockResolvedValueOnce(cred)
      .mockRejectedValueOnce(new DOMException('no', 'NotAllowedError'));
    vi.stubGlobal('navigator', {
      ...navigator,
      credentials: { create: vi.fn(), get },
    });
    const { result } = renderHook(() => usePasskeyLogin());
    await act(async () => {
      result.current.login();
    });
    expect(result.current.status).toBe('unknown');
    vi.mocked(finishPasskeyAuthentication).mockResolvedValue({ token: 'tok', account });
    await act(async () => {
      result.current.authenticate();
    });
    expect(result.current.status).toBe('idle');
    expect(useAuthStore.getState().session).toBe('tok');
    useAuthStore.setState({ session: null, account: null, wrongAccount: false });
    await act(async () => {
      result.current.authenticate();
    });
    expect(result.current.status).toBe('idle');
    vi.unstubAllGlobals();
  });

  it('login does not create a passkey when authenticate begin fails', async () => {
    const create = vi.fn();
    vi.stubGlobal('navigator', {
      ...navigator,
      credentials: { create, get: vi.fn() },
    });
    vi.mocked(startPasskeyAuthentication).mockRejectedValue(new Error('nope'));
    const { result } = renderHook(() => usePasskeyLogin());
    await act(async () => {
      result.current.login();
    });
    expect(result.current.status).toBe('error');
    expect(create).not.toHaveBeenCalled();
    expect(startPasskeyRegistration).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('login offers a choice when get is dismissed', async () => {
    const create = vi.fn();
    vi.stubGlobal('navigator', {
      ...navigator,
      credentials: {
        get: vi.fn().mockRejectedValue(new DOMException('no', 'NotAllowedError')),
        create,
      },
    });
    const { result } = renderHook(() => usePasskeyLogin());
    await act(async () => {
      result.current.login();
    });
    expect(result.current.status).toBe('choice');
    expect(startPasskeyRegistration).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
    expect(useAuthStore.getState().session).toBeNull();
    vi.unstubAllGlobals();
  });

  it('authenticate from choice runs get, not create', async () => {
    const cred = { id: 'cred', type: 'public-key' };
    const create = vi.fn();
    const get = vi
      .fn()
      .mockRejectedValueOnce(new DOMException('no', 'NotAllowedError'))
      .mockResolvedValueOnce(cred);
    vi.stubGlobal('navigator', {
      ...navigator,
      credentials: { create, get },
    });
    const { result } = renderHook(() => usePasskeyLogin());
    await act(async () => {
      result.current.login();
    });
    expect(result.current.status).toBe('choice');
    await act(async () => {
      result.current.authenticate();
    });
    expect(get).toHaveBeenCalledTimes(2);
    expect(create).not.toHaveBeenCalled();
    expect(startPasskeyRegistration).not.toHaveBeenCalled();
    expect(useAuthStore.getState().session).toBe('tok');
    vi.unstubAllGlobals();
  });

  it('register from choice runs create', async () => {
    const cred = { id: 'cred', type: 'public-key' };
    const create = vi.fn().mockResolvedValue(cred);
    vi.stubGlobal('navigator', {
      ...navigator,
      credentials: {
        get: vi.fn().mockRejectedValue(new DOMException('no', 'NotAllowedError')),
        create,
      },
    });
    const { result } = renderHook(() => usePasskeyLogin());
    await act(async () => {
      result.current.login();
    });
    expect(result.current.status).toBe('choice');
    await act(async () => {
      result.current.register();
      result.current.submitName('Ada');
    });
    expect(create).toHaveBeenCalledTimes(1);
    expect(startPasskeyRegistration).toHaveBeenCalledTimes(1);
    expect(vi.mocked(startPasskeyRegistration).mock.calls[0]?.[0]).toBeUndefined();
    expect(useAuthStore.getState().session).toBe('tok');
    vi.unstubAllGlobals();
  });

  it('returns to choice when authenticate is cancelled after a choice', async () => {
    vi.stubGlobal('navigator', {
      ...navigator,
      credentials: {
        get: vi.fn().mockRejectedValue(new DOMException('no', 'NotAllowedError')),
        create: vi.fn(),
      },
    });
    const { result } = renderHook(() => usePasskeyLogin());
    await act(async () => {
      result.current.login();
    });
    expect(result.current.status).toBe('choice');
    await act(async () => {
      result.current.authenticate();
    });
    expect(result.current.status).toBe('choice');
    expect(startPasskeyRegistration).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('returns to the name form when a named create is cancelled after a choice', async () => {
    vi.stubGlobal('navigator', {
      ...navigator,
      credentials: {
        get: vi.fn().mockRejectedValue(new DOMException('no', 'NotAllowedError')),
        create: vi.fn().mockRejectedValue(new DOMException('no', 'NotAllowedError')),
      },
    });
    const { result } = renderHook(() => usePasskeyLogin());
    await act(async () => {
      result.current.login();
    });
    expect(result.current.status).toBe('choice');
    await act(async () => {
      result.current.register();
      result.current.submitName('Ada');
    });
    expect(result.current.status).toBe('name');
    vi.unstubAllGlobals();
  });

  it('login sets unsupported when get is NotAllowedError inside an in-app browser', async () => {
    const create = vi.fn();
    vi.mocked(isInAppBrowser).mockReturnValue(true);
    vi.stubGlobal('navigator', {
      ...navigator,
      credentials: {
        get: vi.fn().mockRejectedValue(new DOMException('no', 'NotAllowedError')),
        create,
      },
    });
    const { result } = renderHook(() => usePasskeyLogin());
    await act(async () => {
      result.current.login();
    });
    expect(result.current.status).toBe('unsupported');
    expect(create).not.toHaveBeenCalled();
    expect(startPasskeyRegistration).not.toHaveBeenCalled();
    expect(useAuthStore.getState().session).toBeNull();
    vi.unstubAllGlobals();
  });

  it('login skips the passkey ceremony when isInAppBrowser is true', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(null, { status: 204 }));
    const get = vi.fn();
    vi.mocked(isInAppBrowser).mockReturnValue(true);
    vi.stubGlobal('navigator', {
      ...navigator,
      credentials: { create: vi.fn(), get },
    });
    const { result } = renderHook(() => usePasskeyLogin());
    await act(async () => {
      result.current.login();
    });
    expect(result.current.status).toBe('unsupported');
    expect(startPasskeyAuthentication).not.toHaveBeenCalled();
    expect(get).not.toHaveBeenCalled();
    expect(clearSessionPhrase).toHaveBeenCalled();
    const bodies = fetchMock.mock.calls.map(
      (call) => JSON.parse(String((call[1] as RequestInit).body)) as { event?: string },
    );
    expect(bodies.filter((body) => body.event === 'client.passkey.login.fail')).toEqual([
      {
        event: 'client.passkey.login.fail',
        stage: 'login',
        name: 'Error',
        message: 'in-app browser',
      },
    ]);
    fetchMock.mockRestore();
    vi.unstubAllGlobals();
  });

  it('authenticate skips the passkey ceremony when isInAppBrowser is true', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(null, { status: 204 }));
    const get = vi.fn();
    vi.mocked(isInAppBrowser).mockReturnValue(true);
    vi.stubGlobal('navigator', {
      ...navigator,
      credentials: { create: vi.fn(), get },
    });
    const { result } = renderHook(() => usePasskeyLogin());
    await act(async () => {
      result.current.authenticate();
    });
    expect(result.current.status).toBe('unsupported');
    expect(startPasskeyAuthentication).not.toHaveBeenCalled();
    expect(get).not.toHaveBeenCalled();
    expect(clearSessionPhrase).toHaveBeenCalled();
    const bodies = fetchMock.mock.calls.map(
      (call) => JSON.parse(String((call[1] as RequestInit).body)) as { event?: string },
    );
    expect(bodies.filter((body) => body.event === 'client.passkey.login.fail')).toEqual([
      {
        event: 'client.passkey.login.fail',
        stage: 'authenticate',
        name: 'Error',
        message: 'in-app browser',
      },
    ]);
    fetchMock.mockRestore();
    vi.unstubAllGlobals();
  });

  it('register skips the passkey ceremony when isInAppBrowser is true', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(null, { status: 204 }));
    const create = vi.fn();
    vi.mocked(isInAppBrowser).mockReturnValue(true);
    vi.stubGlobal('navigator', {
      ...navigator,
      credentials: { create, get: vi.fn() },
    });
    const { result } = renderHook(() => usePasskeyLogin());
    await act(async () => {
      result.current.register();
      result.current.submitName('Ada');
    });
    expect(result.current.status).toBe('unsupported');
    expect(startPasskeyRegistration).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
    const bodies = fetchMock.mock.calls.map(
      (call) => JSON.parse(String((call[1] as RequestInit).body)) as { event?: string },
    );
    expect(bodies.filter((body) => body.event === 'client.passkey.register.fail')).toEqual([
      {
        event: 'client.passkey.register.fail',
        stage: 'register',
        name: 'Error',
        message: 'in-app browser',
      },
    ]);
    fetchMock.mockRestore();
    vi.unstubAllGlobals();
  });

  it('login sets unsupported when get is NotAllowedError after entering an in-app browser', async () => {
    const create = vi.fn();
    vi.mocked(isInAppBrowser).mockReturnValueOnce(false).mockReturnValue(true);
    vi.stubGlobal('navigator', {
      ...navigator,
      credentials: {
        get: vi.fn().mockRejectedValue(new DOMException('no', 'NotAllowedError')),
        create,
      },
    });
    const { result } = renderHook(() => usePasskeyLogin());
    await act(async () => {
      result.current.login();
    });
    expect(result.current.status).toBe('unsupported');
    expect(startPasskeyRegistration).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('cancel aborts in-flight login before register starts', async () => {
    let rejectGet: (reason: unknown) => void = () => undefined;
    const create = vi.fn();
    vi.stubGlobal('navigator', {
      ...navigator,
      credentials: {
        get: vi.fn().mockImplementation(
          () =>
            new Promise((_resolve, reject) => {
              rejectGet = reject;
            }),
        ),
        create,
      },
    });
    const { result } = renderHook(() => usePasskeyLogin());
    act(() => {
      result.current.login();
    });
    act(() => {
      result.current.cancel();
    });
    await act(async () => {
      rejectGet(new DOMException('no', 'NotAllowedError'));
      await Promise.resolve();
    });
    expect(result.current.status).toBe('idle');
    expect(create).not.toHaveBeenCalled();
    expect(startPasskeyRegistration).not.toHaveBeenCalled();
    expect(useAuthStore.getState().session).toBeNull();
    vi.unstubAllGlobals();
  });

  it('returns to the name form when a named create is cancelled', async () => {
    const accountId = 'cccccccc-dddd-eeee-ffff-000000000001';
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(null, { status: 204 }));
    vi.mocked(startPasskeyRegistration).mockResolvedValue({
      challengeId: 'ch',
      options: {
        challenge: 'aa',
        user: {
          id: bytesToBase64Url(new TextEncoder().encode(accountId)),
          name: 'ada',
        },
      },
    });
    vi.stubGlobal('navigator', {
      ...navigator,
      credentials: {
        create: vi.fn().mockRejectedValue(new DOMException('no', 'NotAllowedError')),
        get: vi.fn(),
      },
    });
    const { result } = renderHook(() => usePasskeyLogin());
    await act(async () => {
      result.current.register();
      result.current.submitName('Ada');
    });
    expect(result.current.status).toBe('name');
    const bodies = fetchMock.mock.calls.map(
      (call) => JSON.parse(String((call[1] as RequestInit).body)) as { event?: string },
    );
    expect(bodies.filter((body) => body.event === 'client.passkey.register.fail')).toEqual([
      {
        event: 'client.passkey.register.fail',
        stage: 'register',
        name: 'NotAllowedError',
        message: 'no',
        accountId,
      },
    ]);
    fetchMock.mockRestore();
    vi.unstubAllGlobals();
  });

  it('cancel returns to idle without finishing', async () => {
    let resolveCreate: (value: unknown) => void = () => undefined;
    vi.stubGlobal('navigator', {
      ...navigator,
      credentials: {
        create: vi.fn().mockImplementation(
          () =>
            new Promise((resolve) => {
              resolveCreate = resolve;
            }),
        ),
        get: vi.fn(),
      },
    });
    const { result } = renderHook(() => usePasskeyLogin());
    act(() => {
      result.current.register();
      result.current.submitName('Ada');
    });
    act(() => {
      result.current.cancel();
    });
    await act(async () => {
      resolveCreate({ id: 'cred', type: 'public-key' });
      await Promise.resolve();
    });
    expect(result.current.status).toBe('idle');
    expect(useAuthStore.getState().session).toBeNull();
    vi.unstubAllGlobals();
  });

  it('ignores a late create after unmount', async () => {
    let resolveCreate: (value: unknown) => void = () => undefined;
    vi.stubGlobal('navigator', {
      ...navigator,
      credentials: {
        create: vi.fn().mockImplementation(
          () =>
            new Promise((resolve) => {
              resolveCreate = resolve;
            }),
        ),
        get: vi.fn(),
      },
    });
    const { result, unmount } = renderHook(() => usePasskeyLogin());
    act(() => {
      result.current.register();
      result.current.submitName('Ada');
    });
    unmount();
    await act(async () => {
      resolveCreate({ id: 'cred', type: 'public-key' });
      await Promise.resolve();
    });
    expect(useAuthStore.getState().session).toBeNull();
    vi.unstubAllGlobals();
  });

  it('stores a non-Error rejection as a string', async () => {
    vi.mocked(startPasskeyRegistration).mockRejectedValue('plain-fail');
    const { result } = renderHook(() => usePasskeyLogin());
    await act(async () => {
      result.current.register();
      result.current.submitName('Ada');
    });
    expect(result.current.status).toBe('error');
    expect(result.current.error).toBe('plain-fail');
  });

  it('goes to error when create returns null', async () => {
    vi.stubGlobal('navigator', {
      ...navigator,
      credentials: { create: vi.fn().mockResolvedValue(null), get: vi.fn() },
    });
    const { result } = renderHook(() => usePasskeyLogin());
    await act(async () => {
      result.current.register();
      result.current.submitName('Ada');
    });
    expect(result.current.status).toBe('error');
    vi.unstubAllGlobals();
  });

  it('goes to error when get returns null', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal('navigator', {
      ...navigator,
      credentials: { create: vi.fn(), get: vi.fn().mockResolvedValue(null) },
    });
    const { result } = renderHook(() => usePasskeyLogin());
    await act(async () => {
      result.current.authenticate();
    });
    expect(result.current.status).toBe('error');
    await act(async () => {
      result.current.login();
    });
    expect(result.current.status).toBe('error');
    const bodies = fetchMock.mock.calls.map(
      (call) => JSON.parse(String((call[1] as RequestInit).body)) as { event?: string },
    );
    expect(bodies.filter((body) => body.event === 'client.passkey.login.fail')).toEqual([
      {
        event: 'client.passkey.login.fail',
        stage: 'authenticate',
        name: 'Error',
        message: 'Passkey assertion returned no credential',
      },
      {
        event: 'client.passkey.login.fail',
        stage: 'login',
        name: 'Error',
        message: 'Passkey assertion returned no credential',
      },
    ]);
    fetchMock.mockRestore();
    vi.unstubAllGlobals();
  });

  it('goes to error on a failed request', async () => {
    vi.mocked(startPasskeyRegistration).mockRejectedValue(new Error('nope'));
    const { result } = renderHook(() => usePasskeyLogin());
    await act(async () => {
      result.current.register();
      result.current.submitName('Ada');
    });
    expect(result.current.status).toBe('error');
  });

  it('goes to error on a failed authenticate request', async () => {
    vi.mocked(startPasskeyAuthentication).mockRejectedValue(new Error('nope'));
    const { result } = renderHook(() => usePasskeyLogin());
    await act(async () => {
      result.current.authenticate();
    });
    expect(result.current.status).toBe('error');
  });

  it('returns to idle when authenticate is cancelled', async () => {
    vi.stubGlobal('navigator', {
      ...navigator,
      credentials: {
        create: vi.fn(),
        get: vi.fn().mockRejectedValue(new DOMException('no', 'NotAllowedError')),
      },
    });
    const { result } = renderHook(() => usePasskeyLogin());
    await act(async () => {
      result.current.authenticate();
    });
    expect(result.current.status).toBe('idle');
    vi.unstubAllGlobals();
  });

  it('returns to idle when authenticate is aborted', async () => {
    vi.stubGlobal('navigator', {
      ...navigator,
      credentials: {
        create: vi.fn(),
        get: vi.fn().mockRejectedValue(new DOMException('aborted', 'AbortError')),
      },
    });
    const { result } = renderHook(() => usePasskeyLogin());
    await act(async () => {
      result.current.authenticate();
    });
    expect(result.current.status).toBe('idle');
    vi.unstubAllGlobals();
  });

  it('retries the last authenticate attempt', async () => {
    vi.mocked(startPasskeyAuthentication).mockRejectedValueOnce(new Error('nope'));
    const { result } = renderHook(() => usePasskeyLogin());
    await act(async () => {
      result.current.authenticate();
    });
    expect(result.current.status).toBe('error');
    vi.mocked(startPasskeyAuthentication).mockRejectedValueOnce(new Error('again'));
    await act(async () => {
      result.current.retry();
    });
    expect(vi.mocked(startPasskeyAuthentication)).toHaveBeenCalledTimes(2);
    expect(result.current.status).toBe('error');
  });

  it('retries authenticate by default', async () => {
    vi.mocked(startPasskeyAuthentication).mockRejectedValue(new Error('nope'));
    const { result } = renderHook(() => usePasskeyLogin());
    await act(async () => {
      result.current.retry();
    });
    expect(vi.mocked(startPasskeyAuthentication)).toHaveBeenCalled();
    expect(vi.mocked(startPasskeyRegistration)).not.toHaveBeenCalled();
  });

  it('retry after a failed named create returns to the name form', async () => {
    vi.mocked(startPasskeyRegistration).mockRejectedValue(new Error('nope'));
    const { result } = renderHook(() => usePasskeyLogin());
    await act(async () => {
      result.current.register();
      result.current.submitName('Ada');
    });
    expect(result.current.status).toBe('error');
    await act(async () => {
      result.current.retry();
    });
    expect(result.current.status).toBe('name');
    expect(vi.mocked(startPasskeyRegistration)).toHaveBeenCalledTimes(1);
  });

  it('goes to error when create returns a non-passkey credential', async () => {
    vi.stubGlobal('navigator', {
      ...navigator,
      credentials: { create: vi.fn().mockResolvedValue({ type: 'password' }), get: vi.fn() },
    });
    const { result } = renderHook(() => usePasskeyLogin());
    await act(async () => {
      result.current.register();
      result.current.submitName('Ada');
    });
    expect(result.current.status).toBe('error');
    vi.unstubAllGlobals();
  });

  it('goes to error when get returns a non-passkey credential', async () => {
    vi.stubGlobal('navigator', {
      ...navigator,
      credentials: { create: vi.fn(), get: vi.fn().mockResolvedValue({ type: 'password' }) },
    });
    const { result } = renderHook(() => usePasskeyLogin());
    await act(async () => {
      result.current.authenticate();
    });
    expect(result.current.status).toBe('error');
    vi.unstubAllGlobals();
  });

  it('ignores a superseded register finish', async () => {
    const cred = { id: 'cred', type: 'public-key' };
    vi.stubGlobal('navigator', {
      ...navigator,
      credentials: { create: vi.fn().mockResolvedValue(cred), get: vi.fn() },
    });
    let resolveFinish!: (v: { token: string; account: typeof account }) => void;
    vi.mocked(finishPasskeyRegistration).mockReturnValueOnce(
      new Promise((resolve) => {
        resolveFinish = resolve;
      }),
    );
    const { result } = renderHook(() => usePasskeyLogin());
    await act(async () => {
      result.current.register();
      result.current.submitName('Ada');
    });
    vi.mocked(startPasskeyRegistration).mockRejectedValueOnce(new Error('second'));
    await act(async () => {
      result.current.register();
      result.current.submitName('Ada');
    });
    await act(async () => {
      resolveFinish({ token: 'tok', account });
    });
    expect(useAuthStore.getState().session).toBeNull();
    vi.unstubAllGlobals();
  });

  it('ignores a superseded authenticate finish', async () => {
    const cred = { id: 'cred', type: 'public-key' };
    vi.stubGlobal('navigator', {
      ...navigator,
      credentials: { create: vi.fn(), get: vi.fn().mockResolvedValue(cred) },
    });
    let resolveFinish!: (v: { token: string; account: typeof account }) => void;
    vi.mocked(finishPasskeyAuthentication).mockReturnValueOnce(
      new Promise((resolve) => {
        resolveFinish = resolve;
      }),
    );
    const { result } = renderHook(() => usePasskeyLogin());
    await act(async () => {
      result.current.authenticate();
    });
    vi.mocked(startPasskeyAuthentication).mockRejectedValueOnce(new Error('second'));
    await act(async () => {
      result.current.authenticate();
    });
    await act(async () => {
      resolveFinish({ token: 'tok', account });
    });
    expect(useAuthStore.getState().session).toBeNull();
    vi.unstubAllGlobals();
  });

  it('does not finish register after a newer run started during create', async () => {
    let resolveCreate!: (v: { id: string; type: string }) => void;
    vi.stubGlobal('navigator', {
      ...navigator,
      credentials: {
        create: vi.fn().mockReturnValue(
          new Promise((resolve) => {
            resolveCreate = resolve;
          }),
        ),
        get: vi.fn(),
      },
    });
    const { result } = renderHook(() => usePasskeyLogin());
    await act(async () => {
      result.current.register();
      result.current.submitName('Ada');
    });
    vi.mocked(startPasskeyRegistration).mockRejectedValueOnce(new Error('second'));
    await act(async () => {
      result.current.register();
      result.current.submitName('Ada');
    });
    await act(async () => {
      resolveCreate({ id: 'cred', type: 'public-key' });
    });
    expect(vi.mocked(finishPasskeyRegistration)).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('does not finish authenticate after a newer run started during get', async () => {
    let resolveGet!: (v: { id: string; type: string }) => void;
    vi.stubGlobal('navigator', {
      ...navigator,
      credentials: {
        create: vi.fn(),
        get: vi.fn().mockReturnValue(
          new Promise((resolve) => {
            resolveGet = resolve;
          }),
        ),
      },
    });
    const { result } = renderHook(() => usePasskeyLogin());
    await act(async () => {
      result.current.authenticate();
    });
    vi.mocked(startPasskeyAuthentication).mockRejectedValueOnce(new Error('second'));
    await act(async () => {
      result.current.authenticate();
    });
    await act(async () => {
      resolveGet({ id: 'cred', type: 'public-key' });
    });
    expect(vi.mocked(finishPasskeyAuthentication)).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('does not finish authenticate after cancellation during the login salt check', async () => {
    process.env.NEXT_PUBLIC_BREEZ_API_KEY = 'test-breez-api-key';
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(null, { status: 204 }));
    let resolveSalt!: (salt: Uint8Array) => void;
    vi.mocked(prfEvalFirstSalt).mockReturnValueOnce(
      new Promise<Uint8Array>((resolve) => {
        resolveSalt = resolve;
      }),
    );
    vi.mocked(readPrfFirst).mockReturnValue(new Uint8Array(32).fill(7));
    vi.stubGlobal('navigator', {
      ...navigator,
      credentials: {
        create: vi.fn(),
        get: vi.fn().mockResolvedValue({ id: 'cred', type: 'public-key' }),
      },
    });
    const { result } = renderHook(() => usePasskeyLogin());
    act(() => {
      result.current.login();
    });
    await vi.waitFor(() => {
      expect(prfEvalFirstSalt).toHaveBeenCalledTimes(1);
    });
    act(() => {
      result.current.cancel();
    });
    await act(async () => {
      resolveSalt(new Uint8Array(32).fill(1));
      await Promise.resolve();
    });
    expect(readPrfFirst).toHaveBeenCalledTimes(1);
    expect(finishPasskeyAuthentication).not.toHaveBeenCalled();
    expect(result.current.status).toBe('idle');
    expect(result.current.error).toBeNull();
    fetchMock.mockRestore();
    vi.unstubAllGlobals();
  });

  it('ignores a superseded register success and a late error', async () => {
    const cred = { id: 'cred', type: 'public-key' };
    vi.stubGlobal('navigator', {
      ...navigator,
      credentials: { create: vi.fn().mockResolvedValue(cred), get: vi.fn() },
    });
    let resolveBegin!: (v: typeof begin) => void;
    let rejectBegin!: (e: unknown) => void;
    vi.mocked(startPasskeyRegistration).mockReturnValueOnce(
      new Promise((resolve) => {
        resolveBegin = resolve;
      }),
    );
    vi.mocked(startPasskeyRegistration).mockReturnValueOnce(
      new Promise((_, reject) => {
        rejectBegin = reject;
      }),
    );
    const { result } = renderHook(() => usePasskeyLogin());
    act(() => {
      result.current.register();
      result.current.submitName('Ada');
    });
    act(() => {
      result.current.register();
      result.current.submitName('Ada');
    });
    await act(async () => {
      resolveBegin(begin);
    });
    await act(async () => {
      rejectBegin(new Error('late'));
    });
    expect(useAuthStore.getState().session).toBeNull();
    vi.unstubAllGlobals();
  });

  it('ignores a late register error after a newer run', async () => {
    let rejectFirst!: (e: unknown) => void;
    vi.mocked(startPasskeyRegistration).mockReturnValueOnce(
      new Promise((_, reject) => {
        rejectFirst = reject;
      }),
    );
    vi.mocked(startPasskeyRegistration).mockRejectedValueOnce(new Error('second'));
    const { result } = renderHook(() => usePasskeyLogin());
    act(() => {
      result.current.register();
      result.current.submitName('Ada');
    });
    await act(async () => {
      result.current.register();
      result.current.submitName('Ada');
    });
    await act(async () => {
      rejectFirst(new Error('late first'));
    });
    expect(result.current.status).toBe('error');
  });

  it('ignores a superseded authenticate success and a late error', async () => {
    const cred = { id: 'cred', type: 'public-key' };
    vi.stubGlobal('navigator', {
      ...navigator,
      credentials: { create: vi.fn(), get: vi.fn().mockResolvedValue(cred) },
    });
    let resolveBegin!: (v: typeof begin) => void;
    let rejectBegin!: (e: unknown) => void;
    vi.mocked(startPasskeyAuthentication).mockReturnValueOnce(
      new Promise((resolve) => {
        resolveBegin = resolve;
      }),
    );
    vi.mocked(startPasskeyAuthentication).mockReturnValueOnce(
      new Promise((_, reject) => {
        rejectBegin = reject;
      }),
    );
    const { result } = renderHook(() => usePasskeyLogin());
    act(() => {
      result.current.authenticate();
    });
    act(() => {
      result.current.authenticate();
    });
    await act(async () => {
      resolveBegin(begin);
    });
    await act(async () => {
      rejectBegin(new Error('late'));
    });
    expect(useAuthStore.getState().session).toBeNull();
    vi.unstubAllGlobals();
  });

  it('ignores a late authenticate error after a newer run', async () => {
    let rejectFirst!: (e: unknown) => void;
    vi.mocked(startPasskeyAuthentication).mockReturnValueOnce(
      new Promise((_, reject) => {
        rejectFirst = reject;
      }),
    );
    vi.mocked(startPasskeyAuthentication).mockRejectedValueOnce(new Error('second'));
    const { result } = renderHook(() => usePasskeyLogin());
    act(() => {
      result.current.authenticate();
    });
    await act(async () => {
      result.current.authenticate();
    });
    await act(async () => {
      rejectFirst(new Error('late first'));
    });
    expect(result.current.status).toBe('error');
  });

  it('omits signal on iPhone authenticate get', async () => {
    const cred = { id: 'cred', type: 'public-key' };
    const get = vi.fn().mockResolvedValue(cred);
    vi.stubGlobal('navigator', {
      ...navigator,
      credentials: { create: vi.fn(), get },
    });
    const originalUserAgent = navigator.userAgent;
    Object.defineProperty(navigator, 'userAgent', {
      configurable: true,
      value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
    });
    const { result } = renderHook(() => usePasskeyLogin());
    await act(async () => {
      result.current.authenticate();
    });
    expect(get).toHaveBeenCalledTimes(1);
    expect(get.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({ publicKey: expect.anything() }),
    );
    expect(get.mock.calls[0]?.[0]).not.toHaveProperty('signal');
    Object.defineProperty(navigator, 'userAgent', {
      configurable: true,
      value: originalUserAgent,
    });
    vi.unstubAllGlobals();
  });

  it('omits signal on iPhone register create', async () => {
    const cred = { id: 'cred', type: 'public-key' };
    const create = vi.fn().mockResolvedValue(cred);
    vi.stubGlobal('navigator', {
      ...navigator,
      credentials: { create, get: vi.fn() },
    });
    const originalUserAgent = navigator.userAgent;
    Object.defineProperty(navigator, 'userAgent', {
      configurable: true,
      value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
    });
    const { result } = renderHook(() => usePasskeyLogin());
    await act(async () => {
      result.current.register();
      result.current.submitName('Ada');
    });
    expect(create).toHaveBeenCalledTimes(1);
    expect(create.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({ publicKey: expect.anything() }),
    );
    expect(create.mock.calls[0]?.[0]).not.toHaveProperty('signal');
    Object.defineProperty(navigator, 'userAgent', {
      configurable: true,
      value: originalUserAgent,
    });
    vi.unstubAllGlobals();
  });

  it('omits signal on iPadOS desktop-site authenticate get', async () => {
    const cred = { id: 'cred', type: 'public-key' };
    const get = vi.fn().mockResolvedValue(cred);
    vi.stubGlobal('navigator', {
      ...navigator,
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15',
      platform: 'MacIntel',
      maxTouchPoints: 5,
      credentials: { create: vi.fn(), get },
    });
    const { result } = renderHook(() => usePasskeyLogin());
    await act(async () => {
      result.current.authenticate();
    });
    expect(get).toHaveBeenCalledTimes(1);
    expect(get.mock.calls[0]?.[0]).not.toHaveProperty('signal');
    vi.unstubAllGlobals();
  });

  it('passes signal to get on non-iOS', async () => {
    const cred = { id: 'cred', type: 'public-key' };
    const get = vi.fn().mockResolvedValue(cred);
    vi.stubGlobal('navigator', {
      ...navigator,
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/120.0.0.0',
      platform: 'MacIntel',
      maxTouchPoints: 0,
      credentials: { create: vi.fn(), get },
    });
    const { result } = renderHook(() => usePasskeyLogin());
    await act(async () => {
      result.current.authenticate();
    });
    expect(get).toHaveBeenCalledTimes(1);
    expect(get.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        publicKey: expect.anything(),
        signal: expect.any(AbortSignal),
      }),
    );
    vi.unstubAllGlobals();
  });

  it('goes to choice on iPhone after login NotAllowedError without registering', async () => {
    vi.useFakeTimers();
    const create = vi.fn();
    vi.stubGlobal('navigator', {
      ...navigator,
      credentials: {
        get: vi.fn().mockRejectedValue(new DOMException('no', 'NotAllowedError')),
        create,
      },
    });
    const originalUserAgent = navigator.userAgent;
    Object.defineProperty(navigator, 'userAgent', {
      configurable: true,
      value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
    });
    const { result } = renderHook(() => usePasskeyLogin());
    await act(async () => {
      result.current.login();
    });
    expect(result.current.status).toBe('choice');
    expect(startPasskeyRegistration).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
    await act(async () => {
      vi.advanceTimersByTime(400);
    });
    expect(result.current.status).toBe('choice');
    expect(startPasskeyRegistration).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
    Object.defineProperty(navigator, 'userAgent', {
      configurable: true,
      value: originalUserAgent,
    });
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('records a decoded user.id and ignores a null, non-string, or undecodable id', async () => {
    const cred = { id: 'cred', type: 'public-key' };
    vi.stubGlobal('navigator', {
      ...navigator,
      credentials: { create: vi.fn().mockResolvedValue(cred), get: vi.fn() },
    });
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(null, { status: 204 }));
    const accountId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
    vi.mocked(startPasskeyRegistration)
      .mockResolvedValueOnce({
        challengeId: 'ab'.repeat(32),
        options: {
          user: {
            id: bytesToBase64Url(new TextEncoder().encode(accountId)),
            name: 'ada',
          },
        },
      })
      .mockResolvedValueOnce({ challengeId: 'ch', options: { user: null } })
      .mockResolvedValueOnce({ challengeId: 'ch', options: { user: { id: 4 } } })
      .mockResolvedValueOnce({ challengeId: 'ch', options: { user: 'ada' } })
      .mockResolvedValueOnce({
        challengeId: 'ch',
        options: { user: { id: '###', name: 'ada' } },
      })
      .mockResolvedValueOnce({
        challengeId: 'ch',
        options: { user: { id: bytesToBase64Url(Uint8Array.of(0xff)), name: 'ada' } },
      });
    const { result } = renderHook(() => usePasskeyLogin());
    await act(async () => {
      result.current.register();
      result.current.submitName('Ada');
    });
    await act(async () => {
      result.current.register();
      result.current.submitName('Ada');
    });
    await act(async () => {
      result.current.register();
      result.current.submitName('Ada');
    });
    await act(async () => {
      result.current.register();
      result.current.submitName('Ada');
    });
    await act(async () => {
      result.current.register();
      result.current.submitName('Ada');
    });
    await act(async () => {
      result.current.register();
      result.current.submitName('Ada');
    });
    const bodies = fetchMock.mock.calls.map(
      (call) => JSON.parse(String((call[1] as RequestInit).body)) as { accountId?: string },
    );
    expect(bodies.map((body) => body.accountId).filter((id) => id !== undefined)).toEqual([
      accountId,
    ]);
    fetchMock.mockRestore();
    vi.unstubAllGlobals();
  });

  it('reports a ceremony error that is not a cancel', async () => {
    const accountId = 'dddddddd-eeee-ffff-0000-111111111111';
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(null, { status: 204 }));
    vi.mocked(startPasskeyRegistration).mockResolvedValueOnce({
      challengeId: 'ch',
      options: {
        challenge: 'aa',
        user: {
          id: bytesToBase64Url(new TextEncoder().encode(accountId)),
          name: 'ada',
        },
      },
    });
    vi.stubGlobal('navigator', {
      ...navigator,
      credentials: {
        create: vi.fn().mockRejectedValue(new TypeError('blocked')),
        get: vi.fn().mockRejectedValue(new TypeError('blocked')),
      },
    });
    const { result } = renderHook(() => usePasskeyLogin());
    await act(async () => {
      result.current.register();
      result.current.submitName('Ada');
    });
    expect(result.current.status).toBe('error');
    const bodies = fetchMock.mock.calls.map(
      (call) => JSON.parse(String((call[1] as RequestInit).body)) as { event?: string },
    );
    expect(bodies.filter((body) => body.event === 'client.passkey.register.ceremony')).toEqual([
      {
        event: 'client.passkey.register.ceremony',
        stage: 'register',
        name: 'TypeError',
        message: 'blocked',
        accountId,
      },
    ]);
    const createCalls = vi.mocked(navigator.credentials.create).mock.calls.length;
    await act(async () => {
      result.current.register();
    });
    expect(result.current.status).toBe('name');
    expect(vi.mocked(navigator.credentials.create).mock.calls.length).toBe(createCalls);
    await act(async () => {
      result.current.submitName('Ada');
    });
    expect(result.current.status).toBe('error');
    const later = fetchMock.mock.calls.map(
      (call) => JSON.parse(String((call[1] as RequestInit).body)) as { event?: string },
    );
    expect(later.filter((body) => body.event === 'client.passkey.register.ceremony')).toEqual([
      {
        event: 'client.passkey.register.ceremony',
        stage: 'register',
        name: 'TypeError',
        message: 'blocked',
        accountId,
      },
      {
        event: 'client.passkey.register.ceremony',
        stage: 'register',
        name: 'TypeError',
        message: 'blocked',
      },
    ]);
    await act(async () => {
      result.current.authenticate();
    });
    expect(result.current.status).toBe('error');
    fetchMock.mockRestore();
    vi.unstubAllGlobals();
  });

  it('reports a failed registration finish and a credential of the wrong type', async () => {
    vi.mocked(finishPasskeyRegistration).mockRejectedValueOnce(new Error('finish failed'));
    vi.stubGlobal('navigator', {
      ...navigator,
      credentials: {
        create: vi.fn().mockResolvedValue({ id: 'cred', type: 'public-key' }),
        get: vi.fn().mockResolvedValue({ id: 'cred', type: 'password' }),
      },
    });
    const { result } = renderHook(() => usePasskeyLogin());
    await act(async () => {
      result.current.register();
      result.current.submitName('Ada');
    });
    expect(result.current.status).toBe('error');
    await act(async () => {
      result.current.authenticate();
    });
    expect(result.current.status).toBe('error');
    expect(finishPasskeyAuthentication).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  describe('in-app wallet phrase from PRF', () => {
    const walletAccount = {
      ...account,
      walletRequired: true as const,
      passkeyCredentialId: 'cred',
    };

    it('remembers the phrase on login when PRF is present and the key is set', async () => {
      process.env.NEXT_PUBLIC_BREEZ_API_KEY = 'test-breez-api-key';
      const fetchMock = vi
        .spyOn(globalThis, 'fetch')
        .mockResolvedValue(new Response(null, { status: 204 }));
      vi.mocked(startPasskeyAuthentication).mockResolvedValue({
        challengeId: WALLET_CHALLENGE,
        options: { challenge: 'aa' },
      });
      vi.mocked(finishPasskeyAuthentication).mockResolvedValue({
        token: 'tok',
        account: walletAccount,
      });
      vi.mocked(readPrfFirst).mockReturnValue(new Uint8Array(32).fill(7));
      const get = vi.fn().mockResolvedValue({ id: 'cred', type: 'public-key' });
      vi.stubGlobal('navigator', {
        ...navigator,
        credentials: { create: vi.fn(), get },
      });
      const { result } = renderHook(() => usePasskeyLogin());
      await act(async () => {
        result.current.login();
      });
      await vi.waitFor(() => {
        expect(rememberSessionPhrase).toHaveBeenCalledWith(FIXTURE_MNEMONIC);
      });
      expect(finishPasskeyAuthentication).toHaveBeenCalledWith(WALLET_CHALLENGE, { id: 'cred' });
      const bodies = fetchMock.mock.calls.map(
        (call) => JSON.parse(String((call[1] as RequestInit).body)) as { event?: string },
      );
      expect(bodies.filter((body) => body.event === 'client.passkey.login.prf')).toEqual([
        {
          event: 'client.passkey.login.prf',
          prfPresent: true,
          stage: 'login',
          challengeId: WALLET_CHALLENGE,
        },
      ]);
      fetchMock.mockRestore();
      vi.unstubAllGlobals();
    });

    it('reports absent PRF on login without remembering or prompting again', async () => {
      process.env.NEXT_PUBLIC_BREEZ_API_KEY = 'test-breez-api-key';
      const fetchMock = vi
        .spyOn(globalThis, 'fetch')
        .mockResolvedValue(new Response(null, { status: 204 }));
      vi.mocked(startPasskeyAuthentication).mockResolvedValue({
        challengeId: WALLET_CHALLENGE,
        options: { challenge: 'aa' },
      });
      vi.mocked(finishPasskeyAuthentication).mockResolvedValue({
        token: 'tok',
        account: walletAccount,
      });
      vi.mocked(readPrfFirst).mockReturnValue(undefined);
      const get = vi.fn().mockResolvedValue({ id: 'cred', type: 'public-key' });
      vi.stubGlobal('navigator', {
        ...navigator,
        credentials: { create: vi.fn(), get },
      });
      const { result } = renderHook(() => usePasskeyLogin());
      await act(async () => {
        result.current.login();
      });
      expect(result.current.status).toBe('idle');
      expect(rememberSessionPhrase).not.toHaveBeenCalled();
      expect(get).toHaveBeenCalledTimes(1);
      const bodies = fetchMock.mock.calls.map(
        (call) => JSON.parse(String((call[1] as RequestInit).body)) as { event?: string },
      );
      expect(bodies.filter((body) => body.event === 'client.passkey.login.prf')).toEqual([
        {
          event: 'client.passkey.login.prf',
          prfPresent: false,
          stage: 'login',
          challengeId: WALLET_CHALLENGE,
        },
      ]);
      fetchMock.mockRestore();
      vi.unstubAllGlobals();
    });

    it('treats PRF output for a different login salt as absent', async () => {
      process.env.NEXT_PUBLIC_BREEZ_API_KEY = 'test-breez-api-key';
      const fetchMock = vi
        .spyOn(globalThis, 'fetch')
        .mockResolvedValue(new Response(null, { status: 204 }));
      vi.mocked(startPasskeyAuthentication).mockResolvedValue({
        challengeId: WALLET_CHALLENGE,
        options: { challenge: 'aa' },
      });
      vi.mocked(requestOptionsFromJSON).mockReturnValueOnce({
        challenge: new ArrayBuffer(1),
        extensions: { prf: { eval: { first: new Uint8Array(32).fill(2) } } },
      });
      vi.mocked(finishPasskeyAuthentication).mockResolvedValue({
        token: 'tok',
        account: walletAccount,
      });
      vi.mocked(readPrfFirst).mockReturnValue(new Uint8Array(32).fill(7));
      const get = vi.fn().mockResolvedValue({ id: 'cred', type: 'public-key' });
      vi.stubGlobal('navigator', {
        ...navigator,
        credentials: { create: vi.fn(), get },
      });
      const { result } = renderHook(() => usePasskeyLogin());
      await act(async () => {
        result.current.login();
      });
      expect(result.current.status).toBe('idle');
      expect(readPrfFirst).not.toHaveBeenCalled();
      expect(rememberSessionPhrase).not.toHaveBeenCalled();
      expect(get).toHaveBeenCalledTimes(1);
      expect(finishPasskeyAuthentication).toHaveBeenCalledWith(WALLET_CHALLENGE, { id: 'cred' });
      const bodies = fetchMock.mock.calls.map(
        (call) => JSON.parse(String((call[1] as RequestInit).body)) as { event?: string },
      );
      expect(bodies.filter((body) => body.event === 'client.passkey.login.prf')).toEqual([
        {
          event: 'client.passkey.login.prf',
          prfPresent: false,
          stage: 'login',
          challengeId: WALLET_CHALLENGE,
        },
      ]);
      fetchMock.mockRestore();
      vi.unstubAllGlobals();
    });

    it('treats a login request without a PRF extension as absent', async () => {
      process.env.NEXT_PUBLIC_BREEZ_API_KEY = 'test-breez-api-key';
      const fetchMock = vi
        .spyOn(globalThis, 'fetch')
        .mockResolvedValue(new Response(null, { status: 204 }));
      vi.mocked(startPasskeyAuthentication).mockResolvedValue({
        challengeId: WALLET_CHALLENGE,
        options: { challenge: 'aa' },
      });
      vi.mocked(requestOptionsFromJSON).mockReturnValueOnce({ challenge: new ArrayBuffer(1) });
      vi.mocked(finishPasskeyAuthentication).mockResolvedValue({
        token: 'tok',
        account: walletAccount,
      });
      vi.mocked(readPrfFirst).mockReturnValue(new Uint8Array(32).fill(7));
      const get = vi.fn().mockResolvedValue({ id: 'cred', type: 'public-key' });
      vi.stubGlobal('navigator', {
        ...navigator,
        credentials: { create: vi.fn(), get },
      });
      const { result } = renderHook(() => usePasskeyLogin());
      await act(async () => {
        result.current.login();
      });
      expect(result.current.status).toBe('idle');
      expect(readPrfFirst).not.toHaveBeenCalled();
      expect(rememberSessionPhrase).not.toHaveBeenCalled();
      expect(get).toHaveBeenCalledTimes(1);
      const bodies = fetchMock.mock.calls.map(
        (call) => JSON.parse(String((call[1] as RequestInit).body)) as { event?: string },
      );
      expect(bodies.filter((body) => body.event === 'client.passkey.login.prf')).toEqual([
        {
          event: 'client.passkey.login.prf',
          prfPresent: false,
          stage: 'login',
          challengeId: WALLET_CHALLENGE,
        },
      ]);
      fetchMock.mockRestore();
      vi.unstubAllGlobals();
    });

    it('treats empty PRF bytes as absent', async () => {
      process.env.NEXT_PUBLIC_BREEZ_API_KEY = 'test-breez-api-key';
      const fetchMock = vi
        .spyOn(globalThis, 'fetch')
        .mockResolvedValue(new Response(null, { status: 204 }));
      vi.mocked(startPasskeyAuthentication).mockResolvedValue({
        challengeId: WALLET_CHALLENGE,
        options: { challenge: 'aa' },
      });
      vi.mocked(finishPasskeyAuthentication).mockResolvedValue({
        token: 'tok',
        account: walletAccount,
      });
      vi.mocked(readPrfFirst).mockReturnValue(new Uint8Array(0));
      vi.stubGlobal('navigator', {
        ...navigator,
        credentials: {
          create: vi.fn(),
          get: vi.fn().mockResolvedValue({ id: 'cred', type: 'public-key' }),
        },
      });
      const { result } = renderHook(() => usePasskeyLogin());
      await act(async () => {
        result.current.login();
      });
      expect(result.current.status).toBe('idle');
      expect(rememberSessionPhrase).not.toHaveBeenCalled();
      const bodies = fetchMock.mock.calls.map(
        (call) => JSON.parse(String((call[1] as RequestInit).body)) as { event?: string },
      );
      expect(bodies.filter((body) => body.event === 'client.passkey.login.prf')).toEqual([
        {
          event: 'client.passkey.login.prf',
          prfPresent: false,
          stage: 'login',
          challengeId: WALLET_CHALLENGE,
        },
      ]);
      fetchMock.mockRestore();
      vi.unstubAllGlobals();
    });

    it('treats a throwing readPrfFirst as absent', async () => {
      process.env.NEXT_PUBLIC_BREEZ_API_KEY = 'test-breez-api-key';
      const fetchMock = vi
        .spyOn(globalThis, 'fetch')
        .mockResolvedValue(new Response(null, { status: 204 }));
      vi.mocked(startPasskeyAuthentication).mockResolvedValue({
        challengeId: WALLET_CHALLENGE,
        options: { challenge: 'aa' },
      });
      vi.mocked(finishPasskeyAuthentication).mockResolvedValue({
        token: 'tok',
        account: walletAccount,
      });
      vi.mocked(readPrfFirst).mockImplementation(() => {
        throw new TypeError('bad prf');
      });
      vi.stubGlobal('navigator', {
        ...navigator,
        credentials: {
          create: vi.fn(),
          get: vi.fn().mockResolvedValue({ id: 'cred', type: 'public-key' }),
        },
      });
      const { result } = renderHook(() => usePasskeyLogin());
      await act(async () => {
        result.current.login();
      });
      expect(result.current.status).toBe('idle');
      expect(rememberSessionPhrase).not.toHaveBeenCalled();
      const bodies = fetchMock.mock.calls.map(
        (call) => JSON.parse(String((call[1] as RequestInit).body)) as { event?: string },
      );
      expect(bodies.filter((body) => body.event === 'client.passkey.login.prf')).toEqual([
        {
          event: 'client.passkey.login.prf',
          prfPresent: false,
          stage: 'login',
          challengeId: WALLET_CHALLENGE,
        },
      ]);
      fetchMock.mockRestore();
      vi.unstubAllGlobals();
    });

    it('uses authenticate stage when entered through authenticate()', async () => {
      process.env.NEXT_PUBLIC_BREEZ_API_KEY = 'test-breez-api-key';
      const fetchMock = vi
        .spyOn(globalThis, 'fetch')
        .mockResolvedValue(new Response(null, { status: 204 }));
      vi.mocked(startPasskeyAuthentication).mockResolvedValue({
        challengeId: WALLET_CHALLENGE,
        options: { challenge: 'aa' },
      });
      vi.mocked(finishPasskeyAuthentication).mockResolvedValue({
        token: 'tok',
        account: walletAccount,
      });
      vi.mocked(readPrfFirst).mockReturnValue(new Uint8Array(32).fill(7));
      vi.stubGlobal('navigator', {
        ...navigator,
        credentials: {
          create: vi.fn(),
          get: vi.fn().mockResolvedValue({ id: 'cred', type: 'public-key' }),
        },
      });
      const { result } = renderHook(() => usePasskeyLogin());
      await act(async () => {
        result.current.authenticate();
      });
      await vi.waitFor(() => {
        expect(rememberSessionPhrase).toHaveBeenCalled();
      });
      const bodies = fetchMock.mock.calls.map(
        (call) => JSON.parse(String((call[1] as RequestInit).body)) as { event?: string },
      );
      expect(bodies.filter((body) => body.event === 'client.passkey.login.prf')).toEqual([
        {
          event: 'client.passkey.login.prf',
          prfPresent: true,
          stage: 'authenticate',
          challengeId: WALLET_CHALLENGE,
        },
      ]);
      fetchMock.mockRestore();
      vi.unstubAllGlobals();
    });

    it('remembers the phrase on registration when the key is set', async () => {
      process.env.NEXT_PUBLIC_BREEZ_API_KEY = 'test-breez-api-key';
      vi.mocked(finishPasskeyRegistration).mockResolvedValue({
        token: 'tok',
        account: walletAccount,
      });
      vi.stubGlobal('navigator', {
        ...navigator,
        credentials: {
          create: vi.fn().mockResolvedValue({ id: 'cred', type: 'public-key' }),
          get: vi.fn(),
        },
      });
      const { result } = renderHook(() => usePasskeyLogin());
      await act(async () => {
        result.current.register();
        result.current.submitName('Ada');
      });
      await vi.waitFor(() => {
        expect(rememberSessionPhrase).toHaveBeenCalledWith(FIXTURE_MNEMONIC);
      });
      expect(finishPasskeyRegistration).toHaveBeenCalledWith('ch', { id: 'cred' });
      expect(readPrfFirst).not.toHaveBeenCalled();
      vi.unstubAllGlobals();
    });

    it('remembers nothing on credential-id mismatch', async () => {
      process.env.NEXT_PUBLIC_BREEZ_API_KEY = 'test-breez-api-key';
      vi.mocked(finishPasskeyAuthentication).mockResolvedValue({
        token: 'tok',
        account: { ...walletAccount, passkeyCredentialId: 'other' },
      });
      vi.mocked(startPasskeyAuthentication).mockResolvedValue({
        challengeId: WALLET_CHALLENGE,
        options: { challenge: 'aa' },
      });
      vi.mocked(readPrfFirst).mockReturnValue(new Uint8Array(32).fill(7));
      vi.stubGlobal('navigator', {
        ...navigator,
        credentials: {
          create: vi.fn(),
          get: vi.fn().mockResolvedValue({ id: 'cred', type: 'public-key' }),
        },
      });
      const { result } = renderHook(() => usePasskeyLogin());
      await act(async () => {
        result.current.login();
      });
      expect(result.current.status).toBe('idle');
      await act(async () => {
        await Promise.resolve();
      });
      expect(rememberSessionPhrase).not.toHaveBeenCalled();
      vi.unstubAllGlobals();
    });

    it('skips login PRF read and remember when the key is unset', async () => {
      const fetchMock = vi
        .spyOn(globalThis, 'fetch')
        .mockResolvedValue(new Response(null, { status: 204 }));
      vi.mocked(finishPasskeyAuthentication).mockResolvedValue({
        token: 'tok',
        account: walletAccount,
      });
      vi.stubGlobal('navigator', {
        ...navigator,
        credentials: {
          create: vi.fn(),
          get: vi.fn().mockResolvedValue({ id: 'cred', type: 'public-key' }),
        },
      });
      const { result } = renderHook(() => usePasskeyLogin());
      await act(async () => {
        result.current.login();
      });
      expect(readPrfFirst).not.toHaveBeenCalled();
      expect(prfEvalFirstSalt).not.toHaveBeenCalled();
      expect(rememberSessionPhrase).not.toHaveBeenCalled();
      const bodies = fetchMock.mock.calls.map(
        (call) => JSON.parse(String((call[1] as RequestInit).body)) as { event?: string },
      );
      expect(bodies.filter((body) => body.event === 'client.passkey.login.prf')).toEqual([]);
      fetchMock.mockRestore();
      vi.unstubAllGlobals();
    });

    it('skips remember on registration when the key is unset', async () => {
      const fetchMock = vi
        .spyOn(globalThis, 'fetch')
        .mockResolvedValue(new Response(null, { status: 204 }));
      vi.mocked(finishPasskeyRegistration).mockResolvedValue({
        token: 'tok',
        account: walletAccount,
      });
      vi.stubGlobal('navigator', {
        ...navigator,
        credentials: {
          create: vi.fn().mockResolvedValue({ id: 'cred', type: 'public-key' }),
          get: vi.fn(),
        },
      });
      const { result } = renderHook(() => usePasskeyLogin());
      await act(async () => {
        result.current.register();
        result.current.submitName('Ada');
      });
      expect(result.current.status).toBe('idle');
      expect(rememberSessionPhrase).not.toHaveBeenCalled();
      const bodies = fetchMock.mock.calls.map(
        (call) => JSON.parse(String((call[1] as RequestInit).body)) as { event?: string },
      );
      expect(bodies.filter((body) => body.event === 'client.passkey.login.prf')).toEqual([]);
      fetchMock.mockRestore();
      vi.unstubAllGlobals();
    });
  });
});
