import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Account } from '@/lib/api-types';
import { clearSessionPhrase, rememberSessionPhrase, SESSION_PHRASE_EVENT } from '@/lib/tab-phrase';
import type { WalletConnection, WalletSdk } from '@/lib/wallet/wallet-sdk';
import { disconnectWallet, type WalletSdkLoader } from '@/lib/wallet/wallet-service';
import {
  listenForWalletSetup,
  needsWalletSetup,
  retryWalletSetup,
  runWalletSetup,
  WALLET_SETUP_RETRY_DELAYS_MS,
} from '@/lib/wallet/wallet-setup';
import { useAuthStore } from '@/stores/auth-store';
import { useWalletStore } from '@/stores/wallet-store';

const MNEMONIC =
  'abandon ability able about above absent absorb abstract absurd abuse access accident';
const API_KEY = 'test-breez-api-key';
const IDENTITY = `02${'A'.repeat(64)}`;
const SESSION = 'sess-1';

const mocks = vi.hoisted(() => ({
  calls: [] as string[],
  putWallet: vi.fn(),
  fetchMe: vi.fn(),
  obtainPrfFirstFromGet: vi.fn(),
  settlePhraseDerivations: vi.fn(),
}));

// The setup flow is under test, not its trace spans: they only run the step.
vi.mock('@/lib/sentry', () => ({
  traceWallet: (_name: string, work: () => Promise<unknown>) => work(),
}));

vi.mock('@breeztech/breez-sdk-spark/ssr', () => ({
  default: () => {
    throw new Error('real SDK must not load');
  },
}));

vi.mock('@/lib/api', () => ({
  putWallet: (...args: unknown[]) => {
    mocks.calls.push('claim');
    return mocks.putWallet(...args);
  },
  fetchMe: (...args: unknown[]) => {
    mocks.calls.push('refresh');
    return mocks.fetchMe(...args);
  },
}));

vi.mock('@/lib/prf-mnemonic', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/prf-mnemonic')>();
  return { ...actual, obtainPrfFirstFromGet: mocks.obtainPrfFirstFromGet };
});

vi.mock('@/lib/wallet/wallet-phrase', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/wallet/wallet-phrase')>();
  return { ...actual, settlePhraseDerivations: mocks.settlePhraseDerivations };
});

const ORIGINAL_BREEZ = process.env.NEXT_PUBLIC_BREEZ_API_KEY;

function account(overrides: Partial<Account> = {}): Account {
  return {
    id: 'acc',
    linkingKey: null,
    role: 'basis',
    name: 'Ada',
    username: 'ada',
    location: null,
    lightningAddress: null,
    lightningAddressVerified: false,
    forumLawsDismissed: false,
    createdAt: 1,
    rulesAgreedAt: 1,
    viewKey: 'a'.repeat(64),
    aboutMe: null,
    aboutMeHasPhoto: false,
    setup: null,
    missing: [],
    walletRequired: true,
    passkeyCredentialId: 'AQID',
    sparkPubkey: null,
    sparkWalletVerified: false,
    ...overrides,
  };
}

function fakeSdk(overrides?: { connect?: () => Promise<WalletConnection> }): {
  loadSdk: WalletSdkLoader;
  connection: {
    getInfo: ReturnType<typeof vi.fn>;
    addEventListener: ReturnType<typeof vi.fn>;
    registerAddress: ReturnType<typeof vi.fn>;
    listPayments: ReturnType<typeof vi.fn>;
    disconnect: ReturnType<typeof vi.fn>;
  };
} {
  const connection = {
    getInfo: vi.fn(async () => ({ balanceSats: 0, identityPubkey: IDENTITY })),
    addEventListener: vi.fn(async () => 'listener'),
    registerAddress: vi.fn(async () => {
      mocks.calls.push('register');
    }),
    listPayments: vi.fn(async () => []),
    disconnect: vi.fn(async () => undefined),
  };
  const connect = vi.fn(
    overrides?.connect ??
      (async () => {
        mocks.calls.push('connect');
        return connection as unknown as WalletConnection;
      }),
  );
  const loadSdk: WalletSdkLoader = vi.fn(async () => ({
    connect: connect as WalletSdk['connect'],
  }));
  return { loadSdk, connection };
}

async function flush(): Promise<void> {
  for (let turn = 0; turn < 12; turn += 1) {
    await Promise.resolve();
  }
}

async function finishRetries<T>(promise: Promise<T>): Promise<T> {
  await vi.runAllTimersAsync();
  return promise;
}

beforeEach(() => {
  vi.useFakeTimers();
  process.env.NEXT_PUBLIC_BREEZ_API_KEY = API_KEY;
  mocks.calls.length = 0;
  mocks.putWallet.mockReset().mockResolvedValue(account({ sparkPubkey: IDENTITY.toLowerCase() }));
  mocks.fetchMe.mockReset().mockResolvedValue(account({ sparkWalletVerified: true }));
  mocks.obtainPrfFirstFromGet.mockReset();
  mocks.settlePhraseDerivations.mockReset().mockResolvedValue(undefined);
  clearSessionPhrase();
  useWalletStore.setState({ setupFailedSession: null });
  useWalletStore.getState().reset();
  useAuthStore.setState({ session: SESSION, account: account(), wrongAccount: false });
});

afterEach(async () => {
  await disconnectWallet();
  clearSessionPhrase();
  vi.useRealTimers();
  vi.restoreAllMocks();
  if (ORIGINAL_BREEZ === undefined) delete process.env.NEXT_PUBLIC_BREEZ_API_KEY;
  else process.env.NEXT_PUBLIC_BREEZ_API_KEY = ORIGINAL_BREEZ;
  useWalletStore.setState({ setupFailedSession: null });
  useWalletStore.getState().reset();
});

describe('needsWalletSetup', () => {
  it('requires the wallet feature, an unlockable unverified account, and a username', () => {
    expect(needsWalletSetup(account())).toBe(true);
    expect(needsWalletSetup(null)).toBe(false);
    expect(needsWalletSetup(account({ walletRequired: false }))).toBe(false);
    expect(needsWalletSetup(account({ passkeyCredentialId: null }))).toBe(false);
    expect(needsWalletSetup(account({ passkeyCredentialId: '' }))).toBe(false);
    expect(needsWalletSetup(account({ sparkWalletVerified: true }))).toBe(false);
    expect(needsWalletSetup(account({ username: null }))).toBe(false);
    expect(needsWalletSetup(account({ username: '' }))).toBe(false);
    const oldAccount = account();
    delete oldAccount.sparkWalletVerified;
    expect(needsWalletSetup(oldAccount)).toBe(false);
  });

  it('is false while the wallet feature is disabled', () => {
    delete process.env.NEXT_PUBLIC_BREEZ_API_KEY;
    expect(needsWalletSetup(account())).toBe(false);
  });
});

describe('runWalletSetup', () => {
  it('never prompts and stays locked when no phrase exists after derivations settle', async () => {
    const { loadSdk } = fakeSdk();
    await expect(runWalletSetup(loadSdk)).resolves.toBe('locked');
    expect(mocks.settlePhraseDerivations).toHaveBeenCalledTimes(1);
    expect(mocks.obtainPrfFirstFromGet).not.toHaveBeenCalled();
    expect(loadSdk).not.toHaveBeenCalled();
  });

  it('waits for a pending derivation and proceeds when it supplies the phrase', async () => {
    let release: (() => void) | undefined;
    mocks.settlePhraseDerivations.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          release = () => {
            rememberSessionPhrase(MNEMONIC);
            resolve();
          };
        }),
    );
    const { loadSdk } = fakeSdk();
    const run = runWalletSetup(loadSdk);
    await flush();
    expect(loadSdk).not.toHaveBeenCalled();
    release?.();
    await expect(run).resolves.toBe('done');
    expect(mocks.obtainPrfFirstFromGet).not.toHaveBeenCalled();
  });

  it('connects, claims, registers the claimed username, refreshes, and finishes', async () => {
    rememberSessionPhrase(MNEMONIC);
    mocks.putWallet.mockResolvedValueOnce(account({ username: 'ada-renamed' }));
    const { loadSdk, connection } = fakeSdk();
    await expect(runWalletSetup(loadSdk)).resolves.toBe('done');
    expect(mocks.calls).toEqual(['connect', 'claim', 'register', 'refresh']);
    expect(mocks.putWallet).toHaveBeenCalledWith(SESSION, IDENTITY.toLowerCase());
    expect(connection.registerAddress).toHaveBeenCalledWith('ada-renamed');
    expect(mocks.fetchMe).toHaveBeenCalledWith(SESSION);
    expect(useAuthStore.getState().account?.sparkWalletVerified).toBe(true);
  });

  it('skips registration for the wallet-verified response', async () => {
    rememberSessionPhrase(MNEMONIC);
    mocks.putWallet.mockRejectedValueOnce(new Error('wallet-verified'));
    const { loadSdk, connection } = fakeSdk();
    await expect(runWalletSetup(loadSdk)).resolves.toBe('done');
    expect(connection.registerAddress).not.toHaveBeenCalled();
    expect(mocks.fetchMe).toHaveBeenCalledWith(SESSION);
  });

  it.each([null, ''] as const)(
    'fails after all retries when a claim username is %s',
    async (username) => {
      rememberSessionPhrase(MNEMONIC);
      mocks.putWallet.mockResolvedValue(account({ username }));
      const { loadSdk, connection } = fakeSdk();
      await expect(finishRetries(runWalletSetup(loadSdk))).resolves.toBe('failed');
      expect(mocks.putWallet).toHaveBeenCalledTimes(4);
      expect(connection.registerAddress).not.toHaveBeenCalled();
    },
  );

  it('fails after all retries when refresh returns null', async () => {
    rememberSessionPhrase(MNEMONIC);
    mocks.fetchMe.mockResolvedValue(null);
    const { loadSdk } = fakeSdk();
    await expect(finishRetries(runWalletSetup(loadSdk))).resolves.toBe('failed');
    expect(mocks.fetchMe).toHaveBeenCalledTimes(4);
  });

  it('fails after all retries when refresh leaves the wallet unverified', async () => {
    rememberSessionPhrase(MNEMONIC);
    mocks.fetchMe.mockResolvedValue(account());
    const { loadSdk } = fakeSdk();
    await expect(finishRetries(runWalletSetup(loadSdk))).resolves.toBe('failed');
    expect(useAuthStore.getState().account?.sparkWalletVerified).toBe(false);
  });

  it('joins a run for the same session', async () => {
    rememberSessionPhrase(MNEMONIC);
    let release: ((value: Account) => void) | undefined;
    mocks.putWallet.mockImplementationOnce(
      () =>
        new Promise<Account>((resolve) => {
          release = resolve;
        }),
    );
    const { loadSdk } = fakeSdk();
    const first = runWalletSetup(loadSdk);
    const second = runWalletSetup(loadSdk);
    expect(second).toBe(first);
    await flush();
    release?.(account());
    await expect(Promise.all([first, second])).resolves.toEqual(['done', 'done']);
    expect(mocks.putWallet).toHaveBeenCalledTimes(1);
  });

  it('starts a separate run for a new session', async () => {
    rememberSessionPhrase(MNEMONIC);
    const releases: Array<(value: Account) => void> = [];
    mocks.putWallet.mockImplementation(
      () =>
        new Promise<Account>((resolve) => {
          releases.push(resolve);
        }),
    );
    const { loadSdk } = fakeSdk();
    const first = runWalletSetup(loadSdk);
    await flush();
    useAuthStore.setState({ session: 'sess-2' });
    const second = runWalletSetup(loadSdk);
    await flush();
    expect(second).not.toBe(first);
    expect(releases).toHaveLength(2);
    releases[0]?.(account());
    await expect(first).resolves.toBe('superseded');
    releases[1]?.(account());
    await expect(second).resolves.toBe('done');
  });

  it('retries a transient failure once and succeeds', async () => {
    rememberSessionPhrase(MNEMONIC);
    mocks.putWallet.mockRejectedValueOnce(new Error('temporary'));
    const { loadSdk } = fakeSdk();
    const run = runWalletSetup(loadSdk);
    await flush();
    expect(mocks.putWallet).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(WALLET_SETUP_RETRY_DELAYS_MS[0] ?? 0);
    await expect(run).resolves.toBe('done');
    expect(mocks.putWallet).toHaveBeenCalledTimes(2);
  });

  it('makes exactly four tries, then records the failed session', async () => {
    rememberSessionPhrase(MNEMONIC);
    mocks.putWallet.mockRejectedValue(new Error('down'));
    const { loadSdk } = fakeSdk();
    await expect(finishRetries(runWalletSetup(loadSdk))).resolves.toBe('failed');
    expect(mocks.putWallet).toHaveBeenCalledTimes(4);
    expect(useWalletStore.getState().setupFailedSession).toBe(SESSION);
  });

  it('is superseded during a retry pause without recording a failure', async () => {
    rememberSessionPhrase(MNEMONIC);
    mocks.putWallet.mockRejectedValue(new Error('down'));
    const { loadSdk } = fakeSdk();
    const run = runWalletSetup(loadSdk);
    await flush();
    useAuthStore.setState({ session: 'other' });
    await vi.advanceTimersByTimeAsync(WALLET_SETUP_RETRY_DELAYS_MS[0] ?? 0);
    await expect(run).resolves.toBe('superseded');
    expect(mocks.putWallet).toHaveBeenCalledTimes(1);
    expect(useWalletStore.getState().setupFailedSession).toBeNull();
  });

  it('is superseded immediately without a session', async () => {
    useAuthStore.setState({ session: null });
    const { loadSdk } = fakeSdk();
    await expect(runWalletSetup(loadSdk)).resolves.toBe('superseded');
    expect(loadSdk).not.toHaveBeenCalled();
  });

  it('finishes when the account becomes verified between tries', async () => {
    rememberSessionPhrase(MNEMONIC);
    mocks.putWallet.mockRejectedValueOnce(new Error('temporary'));
    const { loadSdk } = fakeSdk();
    const run = runWalletSetup(loadSdk);
    await flush();
    useAuthStore.setState({ account: account({ sparkWalletVerified: true }) });
    await vi.advanceTimersByTimeAsync(WALLET_SETUP_RETRY_DELAYS_MS[0] ?? 0);
    await expect(run).resolves.toBe('done');
    expect(mocks.putWallet).toHaveBeenCalledTimes(1);
  });

  it('fails when the account no longer needs setup but is not verified', async () => {
    rememberSessionPhrase(MNEMONIC);
    mocks.putWallet.mockRejectedValueOnce(new Error('temporary'));
    const { loadSdk } = fakeSdk();
    const run = runWalletSetup(loadSdk);
    await flush();
    useAuthStore.setState({ account: account({ username: null }) });
    await expect(finishRetries(run)).resolves.toBe('failed');
    expect(mocks.putWallet).toHaveBeenCalledTimes(1);
  });

  function changeSession(): void {
    useAuthStore.setState({ session: 'other' });
  }

  it('is superseded after phrase derivations settle', async () => {
    mocks.settlePhraseDerivations.mockImplementationOnce(async () => changeSession());
    await expect(runWalletSetup(fakeSdk().loadSdk)).resolves.toBe('superseded');
  });

  it('is superseded after connecting', async () => {
    rememberSessionPhrase(MNEMONIC);
    const base = fakeSdk();
    const changing = fakeSdk({
      connect: async () => {
        changeSession();
        return base.connection as unknown as WalletConnection;
      },
    });
    await expect(runWalletSetup(changing.loadSdk)).resolves.toBe('superseded');
    expect(mocks.putWallet).not.toHaveBeenCalled();
  });

  it('is superseded after claiming', async () => {
    rememberSessionPhrase(MNEMONIC);
    mocks.putWallet.mockImplementationOnce(async () => {
      changeSession();
      return account();
    });
    const { loadSdk, connection } = fakeSdk();
    await expect(runWalletSetup(loadSdk)).resolves.toBe('superseded');
    expect(connection.registerAddress).not.toHaveBeenCalled();
  });

  it('is superseded after an already-verified claim', async () => {
    rememberSessionPhrase(MNEMONIC);
    mocks.putWallet.mockImplementationOnce(async () => {
      changeSession();
      throw new Error('wallet-verified');
    });
    const { loadSdk } = fakeSdk();
    await expect(runWalletSetup(loadSdk)).resolves.toBe('superseded');
    expect(mocks.fetchMe).not.toHaveBeenCalled();
  });

  it('is superseded after registering', async () => {
    rememberSessionPhrase(MNEMONIC);
    const { loadSdk, connection } = fakeSdk();
    connection.registerAddress.mockImplementationOnce(async () => changeSession());
    await expect(runWalletSetup(loadSdk)).resolves.toBe('superseded');
    expect(mocks.fetchMe).not.toHaveBeenCalled();
  });

  it('is superseded after refreshing', async () => {
    rememberSessionPhrase(MNEMONIC);
    mocks.fetchMe.mockImplementationOnce(async () => {
      changeSession();
      return account({ sparkWalletVerified: true });
    });
    await expect(runWalletSetup(fakeSdk().loadSdk)).resolves.toBe('superseded');
  });

  it('turns a thrown step into superseded after a session change', async () => {
    rememberSessionPhrase(MNEMONIC);
    const { loadSdk, connection } = fakeSdk();
    connection.registerAddress.mockImplementationOnce(async () => {
      changeSession();
      throw new Error('stale');
    });
    await expect(runWalletSetup(loadSdk)).resolves.toBe('superseded');
  });

  it('retries ordinary errors as failures', async () => {
    rememberSessionPhrase(MNEMONIC);
    const { loadSdk } = fakeSdk({ connect: async () => Promise.reject(new Error('offline')) });
    await expect(finishRetries(runWalletSetup(loadSdk))).resolves.toBe('failed');
  });

  it('retries non-Error claim failures too', async () => {
    rememberSessionPhrase(MNEMONIC);
    mocks.putWallet.mockRejectedValue('offline');
    await expect(finishRetries(runWalletSetup(fakeSdk().loadSdk))).resolves.toBe('failed');
  });

  it('uses the default loader without loading it while locked', async () => {
    await expect(runWalletSetup()).resolves.toBe('locked');
  });
});

describe('retryWalletSetup', () => {
  it('clears the failed-session flag before running again', async () => {
    useWalletStore.setState({ setupFailedSession: SESSION });
    await expect(retryWalletSetup(fakeSdk().loadSdk)).resolves.toBe('locked');
    expect(useWalletStore.getState().setupFailedSession).toBeNull();
  });

  it('uses the default loader without loading it while locked', async () => {
    await expect(retryWalletSetup()).resolves.toBe('locked');
  });
});

describe('listenForWalletSetup', () => {
  it('does not add a listener when the wallet feature is disabled', () => {
    delete process.env.NEXT_PUBLIC_BREEZ_API_KEY;
    const add = vi.spyOn(window, 'addEventListener');
    const stop = listenForWalletSetup(fakeSdk().loadSdk);
    expect(add).not.toHaveBeenCalledWith(SESSION_PHRASE_EVENT, expect.any(Function));
    expect(stop()).toBeUndefined();
  });

  it('supports the default loader in the disabled no-op path', () => {
    delete process.env.NEXT_PUBLIC_BREEZ_API_KEY;
    expect(listenForWalletSetup()()).toBeUndefined();
  });

  it('checks once at subscribe time', async () => {
    rememberSessionPhrase(MNEMONIC);
    const { loadSdk } = fakeSdk();
    const stop = listenForWalletSetup(loadSdk);
    await flush();
    expect(loadSdk).toHaveBeenCalledTimes(1);
    stop();
  });

  it('starts on the phrase event', async () => {
    const { loadSdk } = fakeSdk();
    const stop = listenForWalletSetup(loadSdk);
    rememberSessionPhrase(MNEMONIC);
    await flush();
    expect(loadSdk).toHaveBeenCalledTimes(1);
    stop();
  });

  it('starts when an auth change supplies the username', async () => {
    rememberSessionPhrase(MNEMONIC);
    useAuthStore.setState({ account: account({ username: null }) });
    const { loadSdk } = fakeSdk();
    const stop = listenForWalletSetup(loadSdk);
    expect(loadSdk).not.toHaveBeenCalled();
    useAuthStore.setState({ account: account() });
    await flush();
    expect(loadSdk).toHaveBeenCalledTimes(1);
    stop();
  });

  it('does not start without a phrase, without need, or for the failed session', async () => {
    const first = fakeSdk();
    const stopFirst = listenForWalletSetup(first.loadSdk);
    await flush();
    expect(first.loadSdk).not.toHaveBeenCalled();
    stopFirst();

    rememberSessionPhrase(MNEMONIC);
    useAuthStore.setState({ account: account({ sparkWalletVerified: true }) });
    const second = fakeSdk();
    const stopSecond = listenForWalletSetup(second.loadSdk);
    expect(second.loadSdk).not.toHaveBeenCalled();
    stopSecond();

    useAuthStore.setState({ account: account() });
    useWalletStore.setState({ setupFailedSession: SESSION });
    const third = fakeSdk();
    const stopThird = listenForWalletSetup(third.loadSdk);
    expect(third.loadSdk).not.toHaveBeenCalled();
    stopThird();

    useAuthStore.setState({ session: null });
    useWalletStore.setState({ setupFailedSession: null });
    const fourth = fakeSdk();
    const stopFourth = listenForWalletSetup(fourth.loadSdk);
    expect(fourth.loadSdk).not.toHaveBeenCalled();
    stopFourth();
  });

  it('removes both listeners on unsubscribe', () => {
    const remove = vi.spyOn(window, 'removeEventListener');
    const unsubscribe = vi.fn();
    const subscribe = vi.spyOn(useAuthStore, 'subscribe').mockReturnValueOnce(unsubscribe);
    const stop = listenForWalletSetup(fakeSdk().loadSdk);
    const check = subscribe.mock.calls[0]?.[0];
    stop();
    expect(remove).toHaveBeenCalledWith(SESSION_PHRASE_EVENT, check);
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });
});
