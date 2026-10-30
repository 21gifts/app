import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AppOutdatedError,
  finishPasskeyAuthentication,
  finishPasskeyRecovery,
  LoginsClosedError,
  RecoveryError,
  RecoveryPendingError,
  startPasskeyAuthentication,
  startPasskeyRecovery,
  UnknownCredentialError,
  WrongAccountError,
} from '@/lib/api';
import type { Account, RecoveryBegin } from '@/lib/api-types';
import { logInteraction } from '@/lib/interaction-log';
import { mergePrfExtension } from '@/lib/passkey-renew';
import { mnemonicFromPrfFirst, obtainPrfFirst } from '@/lib/prf-mnemonic';
import {
  createNewPasskey,
  defaultRecoveryDeps,
  finishWithoutBalance,
  openAndBegin,
  openWordsWallet,
  RECOVERY_BEGIN_TRIES,
  RECOVERY_SEND_TRIES,
  RECOVERY_SETTLE_WAIT_MS,
  rememberOldWords,
  resetRecovery,
  resumeRecovery,
  transfer,
  type RecoveryDeps,
} from '@/lib/recovery-flow';
import { traceWallet } from '@/lib/sentry';
import { clearSessionPhrase, rememberSessionPhrase } from '@/lib/tab-phrase';
import { reportPaymentFailure } from '@/lib/wallet/payment-failure';
import { rememberPhraseFromPrf } from '@/lib/wallet/wallet-phrase';
import { loadWalletSdk, type WalletConnection, type WalletSdk } from '@/lib/wallet/wallet-sdk';
import { WALLET_CONNECT_TIMEOUT_MS } from '@/lib/wallet/wallet-service';
import { credentialToJSON, requestOptionsFromJSON } from '@/lib/webauthn-browser';
import { useAuthStore } from '@/stores/auth-store';
import { useRecoveryStore, type RecoveryView } from '@/stores/recovery-store';

vi.mock('@/lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api')>()),
  startPasskeyRecovery: vi.fn(),
  finishPasskeyRecovery: vi.fn(),
  startPasskeyAuthentication: vi.fn(),
  finishPasskeyAuthentication: vi.fn(),
}));
vi.mock('@/lib/passkey-renew', () => ({
  mergePrfExtension: vi.fn(async (options: PublicKeyCredentialCreationOptions) => ({
    ...options,
    merged: true,
  })),
}));
vi.mock('@/lib/prf-mnemonic', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/prf-mnemonic')>()),
  obtainPrfFirst: vi.fn(),
  mnemonicFromPrfFirst: vi.fn(),
}));
vi.mock('@/lib/webauthn-browser', () => ({
  creationOptionsFromJSON: vi.fn((options: Record<string, unknown>) => ({ ...options })),
  credentialToJSON: vi.fn((credential: { id: string }) => ({ id: credential.id, json: true })),
  requestOptionsFromJSON: vi.fn((options: Record<string, unknown>) => ({ ...options })),
}));
vi.mock('@/lib/wallet/wallet-phrase', () => ({
  rememberPhraseFromPrf: vi.fn(async () => true),
}));
vi.mock('@/lib/tab-phrase', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/tab-phrase')>()),
  clearSessionPhrase: vi.fn(),
  rememberSessionPhrase: vi.fn(),
}));
vi.mock('@/lib/sentry', () => ({
  traceWallet: vi.fn((_name: string, work: () => Promise<unknown>) => work()),
}));
vi.mock('@/lib/wallet/payment-failure', () => ({
  reportPaymentFailure: vi.fn(),
}));
vi.mock('@/lib/wallet/wallet-sdk', () => ({
  loadWalletSdk: vi.fn(),
}));

const OLD_WORDS = 'old words of the lost wallet';
const NEW_WORDS = 'new words of the new passkey';
const OLD_KEY = `02${'a'.repeat(64)}`;
const NEW_KEY = `03${'b'.repeat(64)}`;
const NEW_ADDRESS = 'spark1newwallet';
const HOST = 'app.test';
const PRF = new Uint8Array(32).fill(7);

const BEGIN: RecoveryBegin = {
  challengeId: 'challenge-1',
  options: { challenge: 'Y2hhbGxlbmdlLTE', user: { id: 'dXNlcg' } },
  accountId: 'acc_ada',
  username: 'ada',
};

const BEGIN_2: RecoveryBegin = {
  challengeId: 'challenge-2',
  options: { challenge: 'Y2hhbGxlbmdlLTI', user: { id: 'dXNlcg' } },
  accountId: 'acc_ada',
  username: 'ada',
};

const ACCOUNT = { id: 'acc_ada', username: 'ada' } as unknown as Account;

/** A fake connection: every method a mock, with working defaults. */
type FakeConnection = {
  [K in keyof WalletConnection]: ReturnType<typeof vi.fn>;
};

/**
 * A fake wallet connection.
 *
 * @param balances - Synced balances in turn; the last repeats.
 * @returns The fake.
 */
function connectionOf(balances: number[] = [0]): FakeConnection {
  let reads = 0;
  return {
    getInfo: vi.fn(async () => {
      const balanceSats = balances[Math.min(reads, balances.length - 1)]!;
      reads += 1;
      return { balanceSats, identityPubkey: OLD_KEY };
    }),
    addEventListener: vi.fn(),
    registerAddress: vi.fn(),
    listPayments: vi.fn(),
    getPayment: vi.fn(),
    listReportPayments: vi.fn(),
    parse: vi.fn(),
    prepare: vi.fn(),
    signMessage: vi.fn(async () => ({ pubkey: OLD_KEY, signature: 'f'.repeat(128) })),
    hasAddress: vi.fn(async () => true),
    authorizeAddressTransfer: vi.fn(async () => ({ authorization: 'auth' })),
    claimAddressTransfer: vi.fn(async () => undefined),
    receiveSparkAddress: vi.fn(async () => NEW_ADDRESS),
    sendToSparkAddress: vi.fn(async () => undefined),
    disconnect: vi.fn(async () => undefined),
  };
}

let clock = 1_761_700_000_000;
let old: FakeConnection;
let neu: FakeConnection;
let newConnects: FakeConnection[];
let sdk: { [K in keyof WalletSdk]: ReturnType<typeof vi.fn> };
let deps: RecoveryDeps & {
  sleep: ReturnType<typeof vi.fn>;
  randomUUID: ReturnType<typeof vi.fn>;
  createCredential: ReturnType<typeof vi.fn>;
  getCredential: ReturnType<typeof vi.fn>;
  loadSdk: ReturnType<typeof vi.fn>;
};
let uuids = 0;
let signals: unknown[];

/** The view on `/recover`. */
function view(): RecoveryView {
  return useRecoveryStore.getState().view;
}

/** A sleep that never ends, for a connect deadline that never passes. */
function never(): Promise<void> {
  return new Promise(() => undefined);
}

/** The passkey the fake authenticator creates. */
function newCredential(): { id: string; type: string } {
  return { id: 'cred-new', type: 'public-key' };
}

/**
 * Starts a recovery with the old words and lets the fakes answer: the old
 * wallet opens and begin finds `@ada`.
 *
 * @param owner - Owner from scanned codes, or `null`.
 */
async function toFound(owner: string | null = null): Promise<void> {
  await rememberOldWords(OLD_WORDS, owner, deps);
}

/** Starts a recovery and creates the new passkey and wallet. */
async function toTransfer(): Promise<void> {
  await toFound();
  await createNewPasskey();
  expect(view()).toEqual({
    step: 'transfer',
    done: { account: false, address: false, signedIn: false, balance: false },
    busy: false,
    waiting: false,
    error: null,
  });
}

beforeEach(async () => {
  await resetRecovery();
  vi.clearAllMocks();
  useAuthStore.setState({ session: null, account: null });
  clock = 1_761_700_000_000;
  uuids = 0;
  old = connectionOf([21_000, 21_000, 0]);
  neu = connectionOf();
  newConnects = [];
  sdk = {
    connect: vi.fn(async (words: string) => {
      if (words === OLD_WORDS) {
        return old;
      }
      newConnects.push(neu);
      return neu;
    }),
    identityPubkey: vi.fn(async (words: string) => (words === OLD_WORDS ? OLD_KEY : NEW_KEY)),
    signAddressLookup: vi.fn(async (_words: string, _domain: string, timestamp: number) => ({
      pubkey: OLD_KEY,
      signature: `30${timestamp}`,
    })),
  };
  deps = {
    loadSdk: vi.fn(async () => sdk as unknown as WalletSdk),
    apiKey: () => 'breez-key',
    host: () => HOST,
    now: () => clock,
    sleep: vi.fn((ms: number) => {
      if (ms === WALLET_CONNECT_TIMEOUT_MS) {
        return never();
      }
      clock += ms;
      return Promise.resolve();
    }),
    randomUUID: vi.fn(() => {
      uuids += 1;
      return `00000000-0000-4000-8000-00000000000${uuids}`;
    }),
    createCredential: vi.fn(async () => newCredential()),
    getCredential: vi.fn(async () => ({ id: 'cred-new', type: 'public-key' })),
  };
  vi.mocked(startPasskeyRecovery).mockResolvedValue(BEGIN);
  vi.mocked(finishPasskeyRecovery).mockResolvedValue(undefined);
  vi.mocked(startPasskeyAuthentication).mockResolvedValue({
    challengeId: 'auth-1',
    options: { challenge: 'YXV0aA', rpId: 'app.test' },
  });
  vi.mocked(finishPasskeyAuthentication).mockResolvedValue({ token: 'sess-new', account: ACCOUNT });
  vi.mocked(obtainPrfFirst).mockResolvedValue(PRF);
  vi.mocked(mnemonicFromPrfFirst).mockResolvedValue(NEW_WORDS);
  signals = [];
  Object.defineProperty(globalThis, 'PublicKeyCredential', {
    configurable: true,
    value: {
      signalUnknownCredential: (options: unknown) => {
        signals.push(options);
        return Promise.resolve();
      },
    },
  });
});

afterEach(async () => {
  expect(signals).toEqual([]);
  expect(rememberSessionPhrase).not.toHaveBeenCalled();
  await resetRecovery();
});

describe('defaultRecoveryDeps', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  it('uses the wallet SDK, this build key, the app host, the clock, timers, UUIDs, and the passkey prompts', async () => {
    vi.stubEnv('NEXT_PUBLIC_BREEZ_API_KEY', 'build-key');
    const create = vi.fn(async () => null);
    const get = vi.fn(async () => null);
    Object.defineProperty(navigator, 'credentials', {
      configurable: true,
      value: { create, get },
    });
    const real = defaultRecoveryDeps();
    expect(real.loadSdk).toBe(loadWalletSdk);
    expect(real.apiKey()).toBe('build-key');
    expect(real.host()).toBe(window.location.host);
    expect(Math.abs(real.now() - Date.now())).toBeLessThan(1000);
    expect(real.randomUUID()).toMatch(/^[0-9a-f-]{36}$/);
    await real.createCredential({ publicKey: {} as PublicKeyCredentialCreationOptions });
    await real.getCredential({ publicKey: {} as PublicKeyCredentialRequestOptions });
    expect(create).toHaveBeenCalledWith({ publicKey: {} });
    expect(get).toHaveBeenCalledWith({ publicKey: {} });
    vi.useFakeTimers();
    let slept = false;
    void real.sleep(500).then(() => {
      slept = true;
    });
    await vi.advanceTimersByTimeAsync(499);
    expect(slept).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(slept).toBe(true);
  });
});

describe('openWordsWallet', () => {
  it('connects with the app host and returns the synced balance', async () => {
    const opened = await openWordsWallet(sdk as unknown as WalletSdk, OLD_WORDS, 'k', deps);
    expect(sdk.connect).toHaveBeenCalledWith(OLD_WORDS, 'k', HOST);
    expect(old.getInfo).toHaveBeenCalledWith({ ensureSynced: true });
    expect(opened).toEqual({ connection: old, balanceSats: 21_000 });
  });

  it('closes the connection when its synced read fails', async () => {
    old.getInfo.mockRejectedValueOnce(new Error('sync'));
    old.disconnect.mockRejectedValueOnce(new Error('already closed'));
    await expect(
      openWordsWallet(sdk as unknown as WalletSdk, OLD_WORDS, 'k', deps),
    ).rejects.toThrow('sync');
    expect(old.disconnect).toHaveBeenCalledTimes(1);
  });

  it('gives up at the deadline and closes a connection that opens later', async () => {
    let open: (connection: FakeConnection) => void = () => undefined;
    sdk.connect.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          open = resolve;
        }),
    );
    deps.sleep.mockImplementationOnce(() => Promise.resolve());
    await expect(
      openWordsWallet(sdk as unknown as WalletSdk, OLD_WORDS, 'k', deps),
    ).rejects.toThrow('wallet-connect-timeout');
    expect(deps.sleep).toHaveBeenCalledWith(WALLET_CONNECT_TIMEOUT_MS);
    open(old);
    await vi.waitFor(() => {
      expect(old.disconnect).toHaveBeenCalled();
    });
  });

  it('ignores a connection that fails after the deadline', async () => {
    let fail: (error: Error) => void = () => undefined;
    sdk.connect.mockImplementationOnce(
      () =>
        new Promise((_resolve, reject) => {
          fail = reject;
        }),
    );
    deps.sleep.mockImplementationOnce(() => Promise.resolve());
    await expect(
      openWordsWallet(sdk as unknown as WalletSdk, OLD_WORDS, 'k', deps),
    ).rejects.toThrow('wallet-connect-timeout');
    fail(new Error('late'));
    await Promise.resolve();
    expect(old.disconnect).not.toHaveBeenCalled();
  });
});

describe('rememberOldWords and openAndBegin', () => {
  it('without a wallet in this build refuses at once, without loading the SDK', async () => {
    deps.apiKey = () => null;
    await rememberOldWords(OLD_WORDS, null, deps);
    expect(view()).toEqual({ step: 'refused', reason: 'noWallet' });
    expect(deps.loadSdk).not.toHaveBeenCalled();
  });

  it('opens the old wallet, signs a fresh lookup, and finds the account', async () => {
    await toFound();
    expect(sdk.identityPubkey).toHaveBeenCalledWith(OLD_WORDS);
    expect(sdk.connect).toHaveBeenCalledWith(OLD_WORDS, 'breez-key', HOST);
    expect(old.getInfo).toHaveBeenCalledWith({ ensureSynced: true });
    const timestamp = Math.floor(clock / 1000);
    expect(sdk.signAddressLookup).toHaveBeenCalledWith(OLD_WORDS, HOST, timestamp);
    expect(startPasskeyRecovery).toHaveBeenCalledWith({
      sparkPubkey: OLD_KEY,
      lookup: { signature: `30${timestamp}`, timestamp },
    });
    expect(view()).toEqual({
      step: 'found',
      username: 'ada',
      restart: false,
      error: null,
      busy: false,
    });
  });

  it('shows opening while the old wallet opens', async () => {
    let open: (connection: FakeConnection) => void = () => undefined;
    sdk.connect.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          open = resolve;
        }),
    );
    const started = rememberOldWords(OLD_WORDS, null, deps);
    await vi.waitFor(() => {
      expect(sdk.connect).toHaveBeenCalled();
    });
    expect(view()).toEqual({ step: 'opening', waiting: false });
    open(old);
    await started;
    expect(view().step).toBe('found');
  });

  it.each([
    ['the SDK does not load', (): void => void deps.loadSdk.mockRejectedValueOnce(new Error('x'))],
    [
      'the words give no key',
      (): void => void sdk.identityPubkey.mockRejectedValueOnce(new Error('x')),
    ],
    [
      'the wallet does not connect',
      (): void => void sdk.connect.mockRejectedValueOnce(new Error('x')),
    ],
    [
      'the wallet does not connect in time',
      (): void => {
        sdk.connect.mockImplementationOnce(() => never());
        deps.sleep.mockImplementationOnce(() => Promise.resolve());
      },
    ],
  ])('a wallet that does not open (%s) offers Try again', async (_label, arrange) => {
    arrange();
    await rememberOldWords(OLD_WORDS, null, deps);
    expect(view()).toEqual({ step: 'retry', reason: 'wallet' });
    expect(startPasskeyRecovery).not.toHaveBeenCalled();
  });

  it('a lookup the old wallet cannot sign offers Try again', async () => {
    sdk.signAddressLookup.mockRejectedValueOnce(new Error('signer'));
    await toFound();
    expect(view()).toEqual({ step: 'retry', reason: 'wallet' });
    expect(startPasskeyRecovery).not.toHaveBeenCalled();
  });

  it('waits and asks again with a fresh lookup while the account cannot be looked up yet', async () => {
    vi.mocked(startPasskeyRecovery).mockRejectedValueOnce(new RecoveryError('unavailable'));
    const views: RecoveryView[] = [];
    const unsubscribe = useRecoveryStore.subscribe((state) => {
      views.push(state.view);
    });
    await toFound();
    unsubscribe();
    expect(views).toContainEqual({ step: 'opening', waiting: true });
    expect(deps.sleep).toHaveBeenCalledWith(RECOVERY_SETTLE_WAIT_MS);
    const calls = vi.mocked(startPasskeyRecovery).mock.calls;
    expect(calls).toHaveLength(2);
    expect(calls[0]![0].lookup.timestamp + RECOVERY_SETTLE_WAIT_MS / 1000).toBe(
      calls[1]![0].lookup.timestamp,
    );
    expect(calls[0]![0].lookup.signature).not.toBe(calls[1]![0].lookup.signature);
    expect(view().step).toBe('found');
  });

  it('after three unavailable answers offers Try again, which reuses the open wallet', async () => {
    vi.mocked(startPasskeyRecovery).mockRejectedValue(new RecoveryError('unavailable'));
    await toFound();
    expect(startPasskeyRecovery).toHaveBeenCalledTimes(RECOVERY_BEGIN_TRIES);
    expect(deps.sleep.mock.calls.filter(([ms]) => ms === RECOVERY_SETTLE_WAIT_MS)).toHaveLength(
      RECOVERY_BEGIN_TRIES - 1,
    );
    expect(view()).toEqual({ step: 'retry', reason: 'unavailable' });
    vi.mocked(startPasskeyRecovery).mockResolvedValue(BEGIN);
    await openAndBegin();
    expect(sdk.connect).toHaveBeenCalledTimes(1);
    expect(view().step).toBe('found');
    await openAndBegin();
    expect(startPasskeyRecovery).toHaveBeenCalledTimes(RECOVERY_BEGIN_TRIES + 1);
  });

  it.each([
    [new RecoveryError('not_found'), { step: 'refused', reason: 'not_found' }],
    [new RecoveryError('done'), { step: 'refused', reason: 'done' }],
    [new RecoveryError('operator'), { step: 'refused', reason: 'operator' }],
    [new RecoveryError('invalid'), { step: 'retry', reason: 'unavailable' }],
    [new TypeError('network'), { step: 'retry', reason: 'unavailable' }],
    [new LoginsClosedError(), { step: 'blocked', kind: 'closed' }],
    [new AppOutdatedError(), { step: 'blocked', kind: 'outdated' }],
    [new WrongAccountError(), { step: 'refused', reason: 'operator' }],
  ])('begin answer %s shows %j', async (error, expected) => {
    vi.mocked(startPasskeyRecovery).mockRejectedValueOnce(error);
    await toFound();
    expect(view()).toEqual(expected);
  });

  it('codes of another account are refused; codes of this account find it', async () => {
    await toFound('acc_other');
    expect(view()).toEqual({ step: 'refused', reason: 'otherAccount' });
    await toFound('acc_ada');
    expect(view().step).toBe('found');
  });

  it('a new recovery closes the wallets of the one before', async () => {
    await toTransfer();
    await toFound();
    await vi.waitFor(() => {
      expect(old.disconnect).toHaveBeenCalled();
      expect(neu.disconnect).toHaveBeenCalled();
    });
  });

  it('does nothing without a recovery', async () => {
    await openAndBegin();
    expect(view()).toEqual({ step: 'start' });
  });

  it('closes a wallet that opened after Start over', async () => {
    sdk.connect.mockImplementationOnce(async () => {
      await resetRecovery();
      return old;
    });
    await toFound();
    expect(old.disconnect).toHaveBeenCalled();
    expect(view()).toEqual({ step: 'start' });
    expect(startPasskeyRecovery).not.toHaveBeenCalled();
  });

  it('drops a lookup signed after Start over', async () => {
    sdk.signAddressLookup.mockImplementationOnce(async () => {
      await resetRecovery();
      return { pubkey: OLD_KEY, signature: '30' };
    });
    await toFound();
    expect(startPasskeyRecovery).not.toHaveBeenCalled();
    expect(view()).toEqual({ step: 'start' });
  });

  it('stops waiting after Start over', async () => {
    vi.mocked(startPasskeyRecovery).mockRejectedValueOnce(new RecoveryError('unavailable'));
    deps.sleep.mockImplementation(async (ms: number) => {
      if (ms === WALLET_CONNECT_TIMEOUT_MS) {
        return never();
      }
      await resetRecovery();
    });
    await toFound();
    expect(startPasskeyRecovery).toHaveBeenCalledTimes(1);
    expect(view()).toEqual({ step: 'start' });
  });
});

describe('createNewPasskey', () => {
  it('creates the passkey with the PRF request, opens its wallet, and shows the transfer', async () => {
    await toTransfer();
    expect(mergePrfExtension).toHaveBeenCalledWith({ ...BEGIN.options });
    expect(deps.createCredential).toHaveBeenCalledWith({
      publicKey: { ...BEGIN.options, merged: true },
    });
    expect(traceWallet).toHaveBeenCalledWith('wallet.passkey', expect.any(Function), {
      prompt: 'recovery',
    });
    expect(mnemonicFromPrfFirst).toHaveBeenCalledWith(PRF);
    expect(sdk.connect).toHaveBeenCalledWith(NEW_WORDS, 'breez-key', HOST);
    expect(sdk.identityPubkey).toHaveBeenCalledWith(NEW_WORDS);
    expect(neu.receiveSparkAddress).toHaveBeenCalled();
  });

  it('shows the busy button while the passkey is made', async () => {
    await toFound();
    let create: (credential: unknown) => void = () => undefined;
    deps.createCredential.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          create = resolve;
        }),
    );
    const pressed = createNewPasskey();
    await vi.waitFor(() => {
      expect(deps.createCredential).toHaveBeenCalled();
    });
    expect(view()).toEqual({
      step: 'found',
      username: 'ada',
      restart: false,
      error: null,
      busy: true,
    });
    await createNewPasskey();
    expect(deps.createCredential).toHaveBeenCalledTimes(1);
    create(newCredential());
    await pressed;
    expect(view().step).toBe('transfer');
  });

  it('does nothing without a found account', async () => {
    await createNewPasskey();
    deps.apiKey = () => null;
    await rememberOldWords(OLD_WORDS, null, deps);
    useRecoveryStore.getState().setView({
      step: 'found',
      username: 'ada',
      restart: false,
      error: null,
      busy: false,
    });
    await createNewPasskey();
    expect(deps.createCredential).not.toHaveBeenCalled();
  });

  it('does nothing before the account is found, or on another view', async () => {
    deps.apiKey = () => 'breez-key';
    vi.mocked(startPasskeyRecovery).mockRejectedValueOnce(new RecoveryError('invalid'));
    await toFound();
    useRecoveryStore.getState().setView({
      step: 'found',
      username: 'ada',
      restart: false,
      error: null,
      busy: false,
    });
    await createNewPasskey();
    expect(deps.createCredential).not.toHaveBeenCalled();
    vi.mocked(startPasskeyRecovery).mockResolvedValue(BEGIN);
    await openAndBegin();
    useRecoveryStore.getState().setView({ step: 'start' });
    await createNewPasskey();
    expect(deps.createCredential).not.toHaveBeenCalled();
  });

  it.each([
    [
      'no credential',
      (): void => void deps.createCredential.mockResolvedValueOnce(null),
      'cancelled',
    ],
    [
      'another kind of credential',
      (): void => void deps.createCredential.mockResolvedValueOnce({ id: 'x', type: 'password' }),
      'cancelled',
    ],
    [
      'a dismissed prompt',
      (): void =>
        void deps.createCredential.mockRejectedValueOnce(new DOMException('no', 'NotAllowedError')),
      'cancelled',
    ],
    [
      'a prompt that timed out',
      (): void =>
        void deps.createCredential.mockRejectedValueOnce(new DOMException('slow', 'TimeoutError')),
      'timeout',
    ],
    [
      'any other failure',
      (): void => void deps.createCredential.mockRejectedValueOnce(new Error('boom')),
      'cancelled',
    ],
    [
      'no PRF output',
      (): void => void vi.mocked(obtainPrfFirst).mockResolvedValueOnce(null),
      'prf',
    ],
    [
      'no words from the PRF output',
      (): void => void vi.mocked(mnemonicFromPrfFirst).mockRejectedValueOnce(new Error('x')),
      'wallet',
    ],
    [
      'a wallet that does not connect',
      (): void => void sdk.connect.mockRejectedValueOnce(new Error('x')),
      'wallet',
    ],
  ])('%s shows %s on found and keeps nothing', async (_label, arrange, error) => {
    await toFound();
    arrange();
    await createNewPasskey();
    expect(view()).toEqual({ step: 'found', username: 'ada', restart: false, error, busy: false });
    await transfer();
    expect(finishPasskeyRecovery).not.toHaveBeenCalled();
  });

  it('a new wallet that opens too late shows the wallet error and is closed', async () => {
    await toFound();
    let open: (connection: FakeConnection) => void = () => undefined;
    sdk.connect.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          open = resolve;
        }),
    );
    deps.sleep.mockImplementationOnce(() => Promise.resolve());
    await createNewPasskey();
    expect(view()).toMatchObject({ step: 'found', error: 'wallet' });
    open(neu);
    await vi.waitFor(() => {
      expect(neu.disconnect).toHaveBeenCalled();
    });
  });

  it.each([
    ['its key', (): void => void sdk.identityPubkey.mockRejectedValueOnce(new Error('x'))],
    ['its address', (): void => void neu.receiveSparkAddress.mockRejectedValueOnce(new Error('x'))],
  ])('a new wallet without %s is closed and shows the wallet error', async (_label, arrange) => {
    await toFound();
    arrange();
    await createNewPasskey();
    expect(neu.disconnect).toHaveBeenCalled();
    expect(view()).toMatchObject({ step: 'found', error: 'wallet', busy: false });
  });

  it('closes a new wallet that opened after Start over', async () => {
    await toFound();
    neu.receiveSparkAddress.mockImplementationOnce(async () => {
      await resetRecovery();
      return NEW_ADDRESS;
    });
    await createNewPasskey();
    expect(neu.disconnect).toHaveBeenCalled();
    expect(view()).toEqual({ step: 'start' });
  });
});

describe('transfer', () => {
  it('moves the account, the address, the sign-in, and the balance in one press', async () => {
    await toTransfer();
    await transfer();
    expect(old.signMessage).toHaveBeenCalledWith(
      ['21gifts-account-recovery-v1', 'acc_ada', 'Y2hhbGxlbmdlLTE', 'cred-new', NEW_KEY].join('\n'),
    );
    expect(finishPasskeyRecovery).toHaveBeenCalledWith({
      challengeId: 'challenge-1',
      credential: { id: 'cred-new', json: true },
      newSparkPubkey: NEW_KEY,
      signature: { pubkey: OLD_KEY, signature: 'f'.repeat(128) },
    });
    expect(old.authorizeAddressTransfer).toHaveBeenCalledWith(NEW_KEY);
    expect(neu.claimAddressTransfer).toHaveBeenCalledWith({ authorization: 'auth' });
    expect(traceWallet).toHaveBeenCalledWith('wallet.address.transfer', expect.any(Function));
    expect(neu.disconnect).toHaveBeenCalled();
    expect(neu.disconnect.mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(startPasskeyAuthentication).mock.invocationCallOrder[0]!,
    );
    expect(requestOptionsFromJSON).toHaveBeenCalledWith({
      challenge: 'YXV0aA',
      rpId: 'app.test',
      allowCredentials: [{ type: 'public-key', id: 'cred-new' }],
    });
    expect(deps.getCredential).toHaveBeenCalledWith({
      publicKey: {
        challenge: 'YXV0aA',
        rpId: 'app.test',
        allowCredentials: [{ type: 'public-key', id: 'cred-new' }],
      },
    });
    expect(traceWallet).toHaveBeenCalledWith('wallet.passkey', expect.any(Function), {
      prompt: 'recovery',
    });
    expect(finishPasskeyAuthentication).toHaveBeenCalledWith('auth-1', {
      id: 'cred-new',
      json: true,
    });
    expect(credentialToJSON).toHaveBeenCalled();
    expect(clearSessionPhrase).toHaveBeenCalled();
    expect(rememberPhraseFromPrf).toHaveBeenCalledWith({
      prfFirst: PRF,
      credentialId: 'cred-new',
      account: ACCOUNT,
      sessionToken: 'sess-new',
    });
    expect(useAuthStore.getState().session).toBe('sess-new');
    expect(vi.mocked(logInteraction).mock.calls).toEqual([['login'], ['recovery_done']]);
    expect(old.sendToSparkAddress).toHaveBeenCalledWith(
      NEW_ADDRESS,
      21_000,
      '00000000-0000-4000-8000-000000000001',
    );
    expect(traceWallet).toHaveBeenCalledWith('wallet.send', expect.any(Function), {
      route: 'spark',
    });
    expect(old.disconnect).toHaveBeenCalled();
    expect(view()).toEqual({ step: 'done', balanceMissing: false });
    await transfer();
    expect(finishPasskeyRecovery).toHaveBeenCalledTimes(1);
  });

  it('does nothing unless the transfer view is shown and idle', async () => {
    useRecoveryStore.getState().setView({
      step: 'transfer',
      done: { account: false, address: false, signedIn: false, balance: false },
      busy: false,
      waiting: false,
      error: null,
    });
    await transfer();
    deps.apiKey = () => null;
    await rememberOldWords(OLD_WORDS, null, deps);
    useRecoveryStore.getState().setView({
      step: 'transfer',
      done: { account: false, address: false, signedIn: false, balance: false },
      busy: false,
      waiting: false,
      error: null,
    });
    await transfer();
    deps.apiKey = () => 'breez-key';
    vi.mocked(startPasskeyRecovery).mockRejectedValueOnce(new RecoveryError('invalid'));
    await toFound();
    useRecoveryStore.getState().setView({
      step: 'transfer',
      done: { account: false, address: false, signedIn: false, balance: false },
      busy: false,
      waiting: false,
      error: null,
    });
    await transfer();
    await toFound();
    useRecoveryStore.getState().setView({
      step: 'transfer',
      done: { account: false, address: false, signedIn: false, balance: false },
      busy: false,
      waiting: false,
      error: null,
    });
    await transfer();
    useRecoveryStore.getState().setView({
      step: 'found',
      username: 'ada',
      restart: false,
      error: null,
      busy: false,
    });
    await createNewPasskey();
    expect(view().step).toBe('transfer');
    useRecoveryStore.getState().setView({ step: 'start' });
    await transfer();
    useRecoveryStore.getState().setView({
      step: 'transfer',
      done: { account: false, address: false, signedIn: false, balance: false },
      busy: true,
      waiting: false,
      error: null,
    });
    await transfer();
    expect(old.signMessage).not.toHaveBeenCalled();
  });

  describe('the account', () => {
    it.each([
      [
        'the old wallet does not sign',
        (): void => void old.signMessage.mockRejectedValueOnce(new Error('x')),
      ],
      [
        'another wallet signed',
        (): void =>
          void old.signMessage.mockResolvedValueOnce({
            pubkey: NEW_KEY,
            signature: 'f'.repeat(128),
          }),
      ],
      ...(['invalid', 'pending', 'key_in_use', 'unavailable'] as const).map(
        (kind): [string, () => void] => [
          `the api answers ${kind}`,
          (): void =>
            void vi.mocked(finishPasskeyRecovery).mockRejectedValueOnce(new RecoveryError(kind)),
        ],
      ),
    ])('%s ends the press with the generic error', async (_label, arrange) => {
      await toTransfer();
      arrange();
      await transfer();
      expect(view()).toEqual({
        step: 'transfer',
        done: { account: false, address: false, signedIn: false, balance: false },
        busy: false,
        waiting: false,
        error: 'generic',
      });
      expect(old.authorizeAddressTransfer).not.toHaveBeenCalled();
    });

    it.each([
      [new LoginsClosedError(), { step: 'blocked', kind: 'closed' }],
      [new AppOutdatedError(), { step: 'blocked', kind: 'outdated' }],
      [new WrongAccountError(), { step: 'refused', reason: 'operator' }],
    ])('finish answer %s shows %j', async (error, expected) => {
      await toTransfer();
      vi.mocked(finishPasskeyRecovery).mockRejectedValueOnce(error);
      await transfer();
      expect(view()).toEqual(expected);
    });

    it('a challenge the api no longer knows begins again at once and asks for the passkey again', async () => {
      await toTransfer();
      vi.mocked(finishPasskeyRecovery).mockRejectedValueOnce(new RecoveryError('challenge'));
      vi.mocked(startPasskeyRecovery).mockResolvedValueOnce(BEGIN_2);
      const sleeps = deps.sleep.mock.calls.length;
      await transfer();
      expect(deps.sleep.mock.calls.length).toBe(sleeps);
      expect(startPasskeyRecovery).toHaveBeenCalledTimes(2);
      expect(neu.disconnect).toHaveBeenCalled();
      expect(view()).toEqual({
        step: 'found',
        username: 'ada',
        restart: true,
        error: null,
        busy: false,
      });
      await transfer();
      expect(finishPasskeyRecovery).toHaveBeenCalledTimes(1);
      await createNewPasskey();
      expect(mergePrfExtension).toHaveBeenLastCalledWith({ ...BEGIN_2.options });
      await transfer();
      expect(finishPasskeyRecovery).toHaveBeenLastCalledWith(
        expect.objectContaining({ challengeId: 'challenge-2' }),
      );
      expect(old.sendToSparkAddress).toHaveBeenCalledWith(
        NEW_ADDRESS,
        21_000,
        '00000000-0000-4000-8000-000000000001',
      );
      expect(view()).toEqual({ step: 'done', balanceMissing: false });
    });

    it.each([
      [
        'a connect error',
        (): (() => Promise<void>) => {
          sdk.connect.mockRejectedValueOnce(new Error('x'));
          return () => Promise.resolve();
        },
      ],
      [
        'a connect timeout',
        (): (() => Promise<void>) => {
          const late = connectionOf();
          let open: (connection: FakeConnection) => void = () => undefined;
          sdk.connect.mockImplementationOnce(
            () =>
              new Promise((resolve) => {
                open = resolve;
              }),
          );
          deps.sleep.mockImplementationOnce(() => Promise.resolve());
          return async () => {
            open(late);
            await vi.waitFor(() => {
              expect(late.disconnect).toHaveBeenCalled();
            });
          };
        },
      ],
      [
        'an address that does not come',
        (): (() => Promise<void>) => {
          const half = connectionOf();
          half.receiveSparkAddress.mockRejectedValueOnce(new Error('x'));
          sdk.connect.mockImplementationOnce(async () => half);
          return () => {
            expect(half.disconnect).toHaveBeenCalled();
            return Promise.resolve();
          };
        },
      ],
    ])(
      'a new wallet that fails after a restart (%s) is closed and keeps the attempt cleared',
      async (_label, arrange) => {
        await toTransfer();
        vi.mocked(finishPasskeyRecovery).mockRejectedValueOnce(new RecoveryError('challenge'));
        vi.mocked(startPasskeyRecovery).mockResolvedValueOnce(BEGIN_2);
        await transfer();
        const closed = arrange();
        await createNewPasskey();
        expect(view()).toEqual({
          step: 'found',
          username: 'ada',
          restart: true,
          error: 'wallet',
          busy: false,
        });
        await closed();
        useRecoveryStore.getState().setView({
          step: 'transfer',
          done: { account: false, address: false, signedIn: false, balance: false },
          busy: false,
          waiting: false,
          error: null,
        });
        await transfer();
        expect(finishPasskeyRecovery).toHaveBeenCalledTimes(1);
      },
    );

    it('stops after Start over while the old wallet signs', async () => {
      await toTransfer();
      old.signMessage.mockImplementationOnce(async () => {
        await resetRecovery();
        return { pubkey: OLD_KEY, signature: 'f' };
      });
      await transfer();
      expect(finishPasskeyRecovery).not.toHaveBeenCalled();
      expect(view()).toEqual({ step: 'start' });
    });

    it.each([
      ['stores it', (): Promise<void> => Promise.resolve()],
      ['refuses it', (): Promise<void> => Promise.reject(new RecoveryError('challenge'))],
    ])('stops after Start over while the api %s', async (_label, answer) => {
      await toTransfer();
      vi.mocked(finishPasskeyRecovery).mockImplementationOnce(async () => {
        await resetRecovery();
        return answer();
      });
      await transfer();
      expect(old.hasAddress).not.toHaveBeenCalled();
      expect(startPasskeyRecovery).toHaveBeenCalledTimes(1);
      expect(view()).toEqual({ step: 'start' });
    });
  });

  describe('the address', () => {
    it('without an address there is nothing to move, and the sign-in follows', async () => {
      await toTransfer();
      old.hasAddress.mockResolvedValueOnce(false);
      await transfer();
      expect(old.authorizeAddressTransfer).not.toHaveBeenCalled();
      expect(view()).toEqual({ step: 'done', balanceMissing: false });
    });

    it.each([
      ['the lookup', (): void => void old.hasAddress.mockRejectedValueOnce(new Error('x'))],
      [
        'the authorization',
        (): void => void old.authorizeAddressTransfer.mockRejectedValueOnce(new Error('x')),
      ],
      [
        'the claim',
        (): void => void neu.claimAddressTransfer.mockRejectedValueOnce(new Error('x')),
      ],
    ])('a failure of %s leaves the address and goes on to the sign-in', async (_label, arrange) => {
      await toTransfer();
      arrange();
      vi.mocked(startPasskeyAuthentication).mockRejectedValueOnce(new Error('offline'));
      await transfer();
      expect(view()).toEqual({
        step: 'transfer',
        done: { account: true, address: false, signedIn: false, balance: false },
        busy: false,
        waiting: false,
        error: 'generic',
      });
    });

    it.each([
      [
        'no address',
        (settle: () => void): void =>
          void old.hasAddress.mockImplementationOnce(async () => {
            settle();
            return false;
          }),
      ],
      [
        'a lookup that throws',
        (settle: () => void): void =>
          void old.hasAddress.mockImplementationOnce(async () => {
            settle();
            throw new Error('x');
          }),
      ],
      [
        'an authorization that throws',
        (settle: () => void): void =>
          void old.authorizeAddressTransfer.mockImplementationOnce(async () => {
            settle();
            throw new Error('x');
          }),
      ],
      [
        'a claim that throws',
        (settle: () => void): void =>
          void neu.claimAddressTransfer.mockImplementationOnce(async () => {
            settle();
            throw new Error('x');
          }),
      ],
    ])(
      '%s still marks when the address step settled, and the settle wait counts from it',
      async (_label, arrange) => {
        await toTransfer();
        let settled: number | null = null;
        arrange(() => {
          clock += 4_000;
          settled = clock;
        });
        vi.mocked(finishPasskeyAuthentication).mockRejectedValueOnce(new RecoveryPendingError());
        vi.mocked(startPasskeyRecovery).mockRejectedValueOnce(new RecoveryError('done'));
        await transfer();
        expect(settled).not.toBeNull();
        expect(deps.sleep).toHaveBeenCalledWith(RECOVERY_SETTLE_WAIT_MS);
        expect(vi.mocked(startPasskeyRecovery).mock.calls[1]![0].lookup.timestamp).toBe(
          Math.floor((settled! + RECOVERY_SETTLE_WAIT_MS) / 1000),
        );
        expect(startPasskeyAuthentication).toHaveBeenCalledTimes(2);
        expect(view()).toEqual({ step: 'done', balanceMissing: false });
      },
    );

    it('a later press claims again with the new wallet opened again', async () => {
      await toTransfer();
      neu.claimAddressTransfer.mockRejectedValueOnce(new Error('x'));
      vi.mocked(startPasskeyAuthentication).mockRejectedValueOnce(new Error('offline'));
      await transfer();
      await transfer();
      expect(finishPasskeyRecovery).toHaveBeenCalledTimes(1);
      expect(newConnects).toHaveLength(2);
      expect(neu.claimAddressTransfer).toHaveBeenCalledTimes(2);
      expect(view()).toEqual({ step: 'done', balanceMissing: false });
    });

    it('a new wallet that does not open again leaves the address', async () => {
      await toTransfer();
      neu.claimAddressTransfer.mockRejectedValueOnce(new Error('x'));
      vi.mocked(startPasskeyAuthentication).mockRejectedValueOnce(new Error('offline'));
      await transfer();
      sdk.connect.mockRejectedValueOnce(new Error('x'));
      vi.mocked(startPasskeyAuthentication).mockRejectedValueOnce(new Error('offline'));
      await transfer();
      expect(view()).toMatchObject({ done: { address: false }, error: 'generic' });
    });

    it('a new wallet opened again after Start over is closed', async () => {
      await toTransfer();
      neu.claimAddressTransfer.mockRejectedValueOnce(new Error('x'));
      vi.mocked(startPasskeyAuthentication).mockRejectedValueOnce(new Error('offline'));
      await transfer();
      const reopened = connectionOf();
      sdk.connect.mockImplementationOnce(async () => {
        await resetRecovery();
        return reopened;
      });
      await transfer();
      expect(reopened.disconnect).toHaveBeenCalled();
      expect(reopened.claimAddressTransfer).not.toHaveBeenCalled();
      expect(view()).toEqual({ step: 'start' });
    });
  });

  describe('the sign-in', () => {
    it('a recovery not committed yet waits until the settle window after the claim, then signs in', async () => {
      await toTransfer();
      const started = clock;
      neu.claimAddressTransfer.mockImplementationOnce(async () => {
        clock += 3_000;
      });
      vi.mocked(finishPasskeyAuthentication).mockRejectedValueOnce(new RecoveryPendingError());
      vi.mocked(startPasskeyRecovery).mockRejectedValueOnce(new RecoveryError('done'));
      const views: RecoveryView[] = [];
      const unsubscribe = useRecoveryStore.subscribe((state) => {
        views.push(state.view);
      });
      await transfer();
      unsubscribe();
      expect(deps.sleep).toHaveBeenCalledWith(RECOVERY_SETTLE_WAIT_MS);
      expect(vi.mocked(startPasskeyRecovery).mock.calls[1]![0].lookup.timestamp).toBe(
        Math.floor((started + 3_000 + RECOVERY_SETTLE_WAIT_MS) / 1000),
      );
      expect(views).toContainEqual(
        expect.objectContaining({ step: 'transfer', busy: true, waiting: true }),
      );
      expect(startPasskeyAuthentication).toHaveBeenCalledTimes(2);
      expect(view()).toEqual({ step: 'done', balanceMissing: false });
    });

    it('waits only the rest of the window when time passed since the claim', async () => {
      await toTransfer();
      vi.mocked(startPasskeyAuthentication).mockImplementationOnce(async () => {
        clock += 10_000;
        return { challengeId: 'auth-1', options: { challenge: 'YXV0aA' } };
      });
      vi.mocked(finishPasskeyAuthentication).mockRejectedValueOnce(new RecoveryPendingError());
      vi.mocked(startPasskeyRecovery).mockRejectedValueOnce(new RecoveryError('done'));
      await transfer();
      expect(deps.sleep).toHaveBeenCalledWith(RECOVERY_SETTLE_WAIT_MS - 10_000);
    });

    it('asks again after one more window when begin is still unavailable', async () => {
      await toTransfer();
      vi.mocked(finishPasskeyAuthentication).mockRejectedValueOnce(new RecoveryPendingError());
      vi.mocked(startPasskeyRecovery)
        .mockRejectedValueOnce(new RecoveryError('unavailable'))
        .mockRejectedValueOnce(new RecoveryError('done'));
      await transfer();
      const waits = deps.sleep.mock.calls.filter(([ms]) => ms === RECOVERY_SETTLE_WAIT_MS);
      expect(waits).toHaveLength(2);
      const calls = vi.mocked(startPasskeyRecovery).mock.calls;
      expect(calls[1]![0].lookup.timestamp).not.toBe(calls[2]![0].lookup.timestamp);
      expect(view()).toEqual({ step: 'done', balanceMissing: false });
    });

    it('after three unavailable answers ends the press, and Start over is offered', async () => {
      await toTransfer();
      vi.mocked(finishPasskeyAuthentication).mockRejectedValueOnce(new RecoveryPendingError());
      vi.mocked(startPasskeyRecovery).mockRejectedValue(new RecoveryError('unavailable'));
      await transfer();
      expect(startPasskeyRecovery).toHaveBeenCalledTimes(1 + RECOVERY_BEGIN_TRIES);
      expect(view()).toEqual({
        step: 'transfer',
        done: { account: true, address: true, signedIn: false, balance: false },
        busy: false,
        waiting: false,
        error: 'generic',
      });
    });

    it('a passkey the api does not know begins again at once', async () => {
      await toTransfer();
      vi.mocked(finishPasskeyAuthentication).mockRejectedValueOnce(new UnknownCredentialError());
      vi.mocked(startPasskeyRecovery).mockResolvedValueOnce(BEGIN_2);
      const sleeps = deps.sleep.mock.calls.length;
      await transfer();
      expect(deps.sleep.mock.calls.length).toBe(sleeps);
      expect(view()).toEqual({
        step: 'found',
        username: 'ada',
        restart: true,
        error: null,
        busy: false,
      });
    });

    it('a recovered account whose sign-in does not know the passkey was recovered by someone else', async () => {
      await toTransfer();
      vi.mocked(finishPasskeyAuthentication)
        .mockRejectedValueOnce(new RecoveryPendingError())
        .mockRejectedValueOnce(new UnknownCredentialError());
      vi.mocked(startPasskeyRecovery).mockRejectedValueOnce(new RecoveryError('done'));
      await transfer();
      expect(view()).toEqual({ step: 'refused', reason: 'done' });
      expect(logInteraction).not.toHaveBeenCalled();
    });

    it.each([
      [new RecoveryPendingError(), 'generic'],
      [new Error('offline'), 'generic'],
    ])('a recovered account whose sign-in fails (%s) ends the press', async (error) => {
      await toTransfer();
      vi.mocked(finishPasskeyAuthentication)
        .mockRejectedValueOnce(new UnknownCredentialError())
        .mockRejectedValueOnce(error);
      vi.mocked(startPasskeyRecovery).mockRejectedValueOnce(new RecoveryError('done'));
      await transfer();
      expect(view()).toMatchObject({ step: 'transfer', error: 'generic', busy: false });
      await transfer();
      expect(view()).toEqual({ step: 'done', balanceMissing: false });
    });

    it('drops the sign-in of a recovered account after Start over', async () => {
      await toTransfer();
      vi.mocked(finishPasskeyAuthentication)
        .mockRejectedValueOnce(new UnknownCredentialError())
        .mockImplementationOnce(async () => {
          await resetRecovery();
          return { token: 's', account: ACCOUNT };
        });
      vi.mocked(startPasskeyRecovery).mockRejectedValueOnce(new RecoveryError('done'));
      await transfer();
      expect(useAuthStore.getState().session).toBeNull();
      expect(view()).toEqual({ step: 'start' });
    });

    it('a recovered account whose sign-in is blocked shows the notice', async () => {
      await toTransfer();
      vi.mocked(finishPasskeyAuthentication)
        .mockRejectedValueOnce(new UnknownCredentialError())
        .mockRejectedValueOnce(new AppOutdatedError());
      vi.mocked(startPasskeyRecovery).mockRejectedValueOnce(new RecoveryError('done'));
      await transfer();
      expect(view()).toEqual({ step: 'blocked', kind: 'outdated' });
    });

    it.each([
      [new RecoveryError('operator'), { step: 'refused', reason: 'operator' }],
      [new RecoveryError('not_found'), { step: 'refused', reason: 'not_found' }],
      [new LoginsClosedError(), { step: 'blocked', kind: 'closed' }],
      [new RecoveryError('invalid'), null],
    ])('a begin again that answers %s shows %j', async (error, expected) => {
      await toTransfer();
      vi.mocked(finishPasskeyAuthentication).mockRejectedValueOnce(new UnknownCredentialError());
      vi.mocked(startPasskeyRecovery).mockRejectedValueOnce(error);
      await transfer();
      if (expected === null) {
        expect(view()).toMatchObject({ step: 'transfer', error: 'generic' });
      } else {
        expect(view()).toEqual(expected);
      }
    });

    it.each([
      [
        'a dismissed prompt',
        (): void =>
          void deps.getCredential.mockRejectedValueOnce(new DOMException('no', 'NotAllowedError')),
      ],
      ['no credential', (): void => void deps.getCredential.mockResolvedValueOnce(null)],
      [
        'another kind of credential',
        (): void => void deps.getCredential.mockResolvedValueOnce({ id: 'x', type: 'password' }),
      ],
    ])(
      '%s ends the press with the generic error, and the next press signs in',
      async (_l, arrange) => {
        await toTransfer();
        arrange();
        await transfer();
        expect(view()).toEqual({
          step: 'transfer',
          done: { account: true, address: true, signedIn: false, balance: false },
          busy: false,
          waiting: false,
          error: 'generic',
        });
        expect(logInteraction).not.toHaveBeenCalled();
        await transfer();
        expect(finishPasskeyRecovery).toHaveBeenCalledTimes(1);
        expect(view()).toEqual({ step: 'done', balanceMissing: false });
      },
    );

    it.each([
      [
        'begin',
        startPasskeyAuthentication,
        new LoginsClosedError(),
        { step: 'blocked', kind: 'closed' },
      ],
      [
        'begin',
        startPasskeyAuthentication,
        new AppOutdatedError(),
        { step: 'blocked', kind: 'outdated' },
      ],
      [
        'finish',
        finishPasskeyAuthentication,
        new LoginsClosedError(),
        { step: 'blocked', kind: 'closed' },
      ],
      [
        'finish',
        finishPasskeyAuthentication,
        new AppOutdatedError(),
        { step: 'blocked', kind: 'outdated' },
      ],
      [
        'finish',
        finishPasskeyAuthentication,
        new WrongAccountError(),
        { step: 'refused', reason: 'operator' },
      ],
    ])('a refusal of the sign-in %s shows %j', async (_label, fn, error, expected) => {
      await toTransfer();
      vi.mocked(fn as typeof startPasskeyAuthentication).mockRejectedValueOnce(error);
      await transfer();
      expect(view()).toEqual(expected);
    });

    it('stops after Start over while the new wallet closes', async () => {
      await toTransfer();
      neu.disconnect.mockImplementationOnce(async () => {
        await resetRecovery();
      });
      await transfer();
      expect(startPasskeyAuthentication).not.toHaveBeenCalled();
      expect(view()).toEqual({ step: 'start' });
    });

    it.each([
      ['signs in', (): Promise<unknown> => Promise.resolve({ token: 's', account: ACCOUNT })],
      ['fails', (): Promise<unknown> => Promise.reject(new RecoveryPendingError())],
    ])('drops a sign-in that %s after Start over', async (_label, answer) => {
      await toTransfer();
      vi.mocked(finishPasskeyAuthentication).mockImplementationOnce(async () => {
        await resetRecovery();
        return answer() as ReturnType<typeof finishPasskeyAuthentication>;
      });
      await transfer();
      expect(useAuthStore.getState().session).toBeNull();
      expect(startPasskeyRecovery).toHaveBeenCalledTimes(1);
      expect(view()).toEqual({ step: 'start' });
    });

    it('stops waiting for the settle window after Start over', async () => {
      await toTransfer();
      vi.mocked(finishPasskeyAuthentication).mockRejectedValueOnce(new RecoveryPendingError());
      deps.sleep.mockImplementation(async (ms: number) => {
        if (ms === WALLET_CONNECT_TIMEOUT_MS) {
          return never();
        }
        await resetRecovery();
      });
      await transfer();
      expect(startPasskeyRecovery).toHaveBeenCalledTimes(1);
      expect(view()).toEqual({ step: 'start' });
    });

    it.each([
      ['answers a new begin', (): Promise<RecoveryBegin> => Promise.resolve(BEGIN_2)],
      ['refuses', (): Promise<RecoveryBegin> => Promise.reject(new RecoveryError('operator'))],
    ])('drops a begin again that %s after Start over', async (_label, answer) => {
      await toTransfer();
      vi.mocked(finishPasskeyAuthentication).mockRejectedValueOnce(new UnknownCredentialError());
      vi.mocked(startPasskeyRecovery).mockImplementationOnce(async () => {
        await resetRecovery();
        return answer();
      });
      await transfer();
      expect(view()).toEqual({ step: 'start' });
    });

    it('drops a begin again whose lookup was signed after Start over', async () => {
      await toTransfer();
      vi.mocked(finishPasskeyAuthentication).mockRejectedValueOnce(new UnknownCredentialError());
      sdk.signAddressLookup.mockImplementationOnce(async () => {
        await resetRecovery();
        return { pubkey: OLD_KEY, signature: '30' };
      });
      await transfer();
      expect(startPasskeyRecovery).toHaveBeenCalledTimes(1);
      expect(view()).toEqual({ step: 'start' });
    });
  });

  describe('the balance', () => {
    it('an empty old wallet sends nothing', async () => {
      old = connectionOf([0]);
      await toTransfer();
      await transfer();
      expect(old.sendToSparkAddress).not.toHaveBeenCalled();
      expect(view()).toEqual({ step: 'done', balanceMissing: false });
    });

    it('a send that throws keeps its key for the next press, which re-reads first', async () => {
      old = connectionOf([21_000, 21_000, 21_000, 0]);
      await toTransfer();
      const rejection = new Error('unknown outcome');
      old.sendToSparkAddress.mockRejectedValueOnce(rejection);
      await transfer();
      expect(reportPaymentFailure).toHaveBeenCalledWith(
        {
          stage: 'send',
          reason: 'sdk_error',
          method: 'spark',
          amountSats: 21_000,
          feeSats: null,
          error: rejection,
        },
        'recovery',
        { session: 'sess-new' },
      );
      expect(view()).toEqual({
        step: 'transfer',
        done: { account: true, address: true, signedIn: true, balance: false },
        busy: false,
        waiting: false,
        error: 'balance',
      });
      await transfer();
      expect(startPasskeyAuthentication).toHaveBeenCalledTimes(1);
      const keys = old.sendToSparkAddress.mock.calls.map((call) => call[2] as string);
      expect(keys).toEqual([
        '00000000-0000-4000-8000-000000000001',
        '00000000-0000-4000-8000-000000000001',
      ]);
      expect(view()).toEqual({ step: 'done', balanceMissing: false });
    });

    it('funds that arrived during a send get a second send with a new key', async () => {
      old = connectionOf([21_000, 21_000, 500, 0]);
      await toTransfer();
      await transfer();
      expect(old.sendToSparkAddress.mock.calls).toEqual([
        [NEW_ADDRESS, 21_000, '00000000-0000-4000-8000-000000000001'],
        [NEW_ADDRESS, 500, '00000000-0000-4000-8000-000000000002'],
      ]);
      expect(view()).toEqual({ step: 'done', balanceMissing: false });
    });

    it(`stops after ${RECOVERY_SEND_TRIES} sends while funds keep arriving`, async () => {
      old = connectionOf([100]);
      await toTransfer();
      await transfer();
      expect(old.sendToSparkAddress).toHaveBeenCalledTimes(RECOVERY_SEND_TRIES);
      expect(view()).toMatchObject({ step: 'transfer', error: 'balance' });
      // Every send went out; nothing is a failed payment.
      expect(reportPaymentFailure).not.toHaveBeenCalled();
    });

    it('a balance that cannot be read is the balance error', async () => {
      await toTransfer();
      old.getInfo.mockRejectedValueOnce(new Error('sync'));
      await transfer();
      expect(view()).toMatchObject({ step: 'transfer', error: 'balance' });
      expect(reportPaymentFailure).not.toHaveBeenCalled();
    });

    it('Move the balance later ends the recovery with the note', async () => {
      await toTransfer();
      old.sendToSparkAddress.mockRejectedValueOnce(new Error('x'));
      await transfer();
      await finishWithoutBalance();
      expect(old.disconnect).toHaveBeenCalled();
      expect(view()).toEqual({ step: 'done', balanceMissing: true });
    });

    it('Move the balance later does nothing on another view', async () => {
      await finishWithoutBalance();
      deps.apiKey = () => null;
      await rememberOldWords(OLD_WORDS, null, deps);
      const balanceError: RecoveryView = {
        step: 'transfer',
        done: { account: true, address: true, signedIn: true, balance: false },
        busy: false,
        waiting: false,
        error: 'balance',
      };
      useRecoveryStore.getState().setView(balanceError);
      await finishWithoutBalance();
      deps.apiKey = () => 'breez-key';
      await toTransfer();
      await finishWithoutBalance();
      useRecoveryStore.getState().setView({ ...balanceError, error: 'generic' });
      await finishWithoutBalance();
      useRecoveryStore.getState().setView({ ...balanceError, busy: true });
      await finishWithoutBalance();
      useRecoveryStore.getState().setView({ step: 'start' });
      await finishWithoutBalance();
      expect(old.disconnect).not.toHaveBeenCalled();
    });

    it('stops after Start over while the balance is read', async () => {
      await toTransfer();
      old.getInfo.mockImplementationOnce(async () => {
        await resetRecovery();
        return { balanceSats: 100, identityPubkey: OLD_KEY };
      });
      await transfer();
      expect(old.sendToSparkAddress).not.toHaveBeenCalled();
      expect(view()).toEqual({ step: 'start' });
    });

    it('stops after Start over when the balance reads 0', async () => {
      old = connectionOf([0]);
      await toTransfer();
      old.getInfo.mockImplementationOnce(async () => {
        await resetRecovery();
        return { balanceSats: 0, identityPubkey: OLD_KEY };
      });
      await transfer();
      expect(view()).toEqual({ step: 'start' });
    });

    it('does not show done after Start over while the old wallet closes', async () => {
      await toTransfer();
      old.disconnect.mockImplementationOnce(async () => {
        await resetRecovery();
      });
      await transfer();
      expect(view()).toEqual({ step: 'start' });
    });
  });
});

describe('resumeRecovery', () => {
  it('after closed logins at the begin, Try again begins again with the open old wallet', async () => {
    vi.mocked(startPasskeyRecovery).mockRejectedValueOnce(new LoginsClosedError());
    await toFound();
    expect(view()).toEqual({ step: 'blocked', kind: 'closed' });
    await resumeRecovery();
    expect(sdk.connect).toHaveBeenCalledTimes(1);
    expect(startPasskeyRecovery).toHaveBeenCalledTimes(2);
    expect(view()).toEqual({
      step: 'found',
      username: 'ada',
      restart: false,
      error: null,
      busy: false,
    });
  });

  it('logins still closed at the begin show the notice again', async () => {
    vi.mocked(startPasskeyRecovery).mockRejectedValue(new LoginsClosedError());
    await toFound();
    await resumeRecovery();
    expect(startPasskeyRecovery).toHaveBeenCalledTimes(2);
    expect(view()).toEqual({ step: 'blocked', kind: 'closed' });
  });

  it.each([
    ['the account', finishPasskeyRecovery, { account: false, address: false }, 2, 1],
    ['the sign-in', startPasskeyAuthentication, { account: true, address: true }, 1, 2],
  ])(
    'after closed logins at %s, Try again shows the transfer with its done parts, and the next press resumes',
    async (_label, fn, done, finishes, signIns) => {
      await toTransfer();
      vi.mocked(fn as typeof finishPasskeyRecovery).mockRejectedValueOnce(new LoginsClosedError());
      await transfer();
      expect(view()).toEqual({ step: 'blocked', kind: 'closed' });
      await resumeRecovery();
      expect(view()).toEqual({
        step: 'transfer',
        done: { ...done, signedIn: false, balance: false },
        busy: false,
        waiting: false,
        error: 'generic',
      });
      await transfer();
      expect(finishPasskeyRecovery).toHaveBeenCalledTimes(finishes);
      expect(startPasskeyAuthentication).toHaveBeenCalledTimes(signIns);
      expect(view()).toEqual({ step: 'done', balanceMissing: false });
    },
  );

  it('with a begin but no new passkey yet, Try again shows the found account', async () => {
    await toFound();
    useRecoveryStore.getState().setView({ step: 'blocked', kind: 'closed' });
    await resumeRecovery();
    expect(startPasskeyRecovery).toHaveBeenCalledTimes(1);
    expect(view()).toEqual({
      step: 'found',
      username: 'ada',
      restart: false,
      error: null,
      busy: false,
    });
  });

  it('does nothing without a recovery, for an outdated build, or on another view', async () => {
    useRecoveryStore.getState().setView({ step: 'blocked', kind: 'closed' });
    await resumeRecovery();
    expect(view()).toEqual({ step: 'blocked', kind: 'closed' });
    expect(deps.loadSdk).not.toHaveBeenCalled();
    vi.mocked(startPasskeyRecovery).mockRejectedValueOnce(new AppOutdatedError());
    await toFound();
    expect(view()).toEqual({ step: 'blocked', kind: 'outdated' });
    await resumeRecovery();
    expect(view()).toEqual({ step: 'blocked', kind: 'outdated' });
    useRecoveryStore.getState().setView({ step: 'retry', reason: 'unavailable' });
    await resumeRecovery();
    expect(view()).toEqual({ step: 'retry', reason: 'unavailable' });
    expect(startPasskeyRecovery).toHaveBeenCalledTimes(1);
  });
});

describe('resetRecovery', () => {
  it('closes both wallets, ignores a failed close, and shows the start', async () => {
    await toTransfer();
    old.disconnect.mockRejectedValueOnce(new Error('closed'));
    await resetRecovery();
    expect(old.disconnect).toHaveBeenCalled();
    expect(neu.disconnect).toHaveBeenCalled();
    expect(view()).toEqual({ step: 'start' });
    await transfer();
    expect(finishPasskeyRecovery).not.toHaveBeenCalled();
  });
});
