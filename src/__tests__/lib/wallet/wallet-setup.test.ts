import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Account } from '@/lib/api-types';
import { clearSessionPhrase, peekSessionPhrase, rememberSessionPhrase } from '@/lib/tab-phrase';
import type { WalletConnection, WalletSdk } from '@/lib/wallet/wallet-sdk';
import { disconnectWallet, type WalletSdkLoader } from '@/lib/wallet/wallet-service';
import {
  needsWalletSetup,
  runWalletSetup,
  walletSetupInFlight,
  type WalletSetupStep,
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
  putMyWallet: vi.fn(),
  fetchMe: vi.fn(),
  obtainPrfFirstFromGet: vi.fn(),
  rememberPhraseFromPrf: vi.fn(),
}));

vi.mock('@breeztech/breez-sdk-spark/ssr', () => ({
  default: () => {
    throw new Error('real SDK must not load');
  },
}));

vi.mock('@/lib/api', () => ({
  putMyWallet: (...args: unknown[]) => {
    mocks.calls.push('claim');
    return mocks.putMyWallet(...args);
  },
  fetchMe: (...args: unknown[]) => {
    mocks.calls.push('refresh');
    return mocks.fetchMe(...args);
  },
}));

vi.mock('@/lib/prf-mnemonic', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/prf-mnemonic')>();
  return {
    ...actual,
    obtainPrfFirstFromGet: (...args: unknown[]) => {
      mocks.calls.push('passkey');
      return mocks.obtainPrfFirstFromGet(...args);
    },
  };
});

vi.mock('@/lib/wallet/wallet-phrase', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/wallet/wallet-phrase')>();
  return { ...actual, rememberPhraseFromPrf: mocks.rememberPhraseFromPrf };
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

beforeEach(() => {
  process.env.NEXT_PUBLIC_BREEZ_API_KEY = API_KEY;
  mocks.calls.length = 0;
  mocks.putMyWallet.mockReset().mockResolvedValue(account({ sparkPubkey: IDENTITY.toLowerCase() }));
  mocks.fetchMe.mockReset().mockResolvedValue(account({ sparkWalletVerified: true }));
  mocks.obtainPrfFirstFromGet.mockReset().mockResolvedValue(new Uint8Array([1, 2, 3]));
  mocks.rememberPhraseFromPrf.mockReset().mockImplementation(async () => {
    rememberSessionPhrase(MNEMONIC);
    return true;
  });
  clearSessionPhrase();
  useWalletStore.getState().reset();
  useAuthStore.setState({ session: SESSION, account: account(), wrongAccount: false });
});

afterEach(async () => {
  await disconnectWallet();
  clearSessionPhrase();
  if (ORIGINAL_BREEZ === undefined) {
    delete process.env.NEXT_PUBLIC_BREEZ_API_KEY;
  } else {
    process.env.NEXT_PUBLIC_BREEZ_API_KEY = ORIGINAL_BREEZ;
  }
  useWalletStore.getState().reset();
});

describe('needsWalletSetup', () => {
  it('is true for a wallet account with a username and an unverified wallet', () => {
    expect(needsWalletSetup(account())).toBe(true);
  });

  it('is false without the Breez key', () => {
    delete process.env.NEXT_PUBLIC_BREEZ_API_KEY;
    expect(needsWalletSetup(account())).toBe(false);
  });

  it('is false for a verified wallet, an older api body, or no account', () => {
    expect(needsWalletSetup(account({ sparkWalletVerified: true }))).toBe(false);
    const older = account();
    delete older.sparkWalletVerified;
    expect(needsWalletSetup(older)).toBe(false);
    expect(needsWalletSetup(null)).toBe(false);
  });

  it('is false without a required wallet, a seed passkey, or a username', () => {
    expect(needsWalletSetup(account({ walletRequired: false }))).toBe(false);
    expect(needsWalletSetup(account({ passkeyCredentialId: null }))).toBe(false);
    expect(needsWalletSetup(account({ username: null }))).toBe(false);
    expect(needsWalletSetup(account({ username: '' }))).toBe(false);
  });
});

describe('runWalletSetup', () => {
  it('prompts once, then connects, claims, registers, and refreshes in that order', async () => {
    const { loadSdk, connection } = fakeSdk();
    const steps: WalletSetupStep[] = [];
    await expect(runWalletSetup((step) => steps.push(step), loadSdk)).resolves.toBe('done');
    expect(steps).toEqual(['passkey', 'connecting', 'claiming', 'registering', 'refreshing']);
    expect(mocks.calls).toEqual(['passkey', 'connect', 'claim', 'register', 'refresh']);
    expect(mocks.putMyWallet).toHaveBeenCalledWith(SESSION, IDENTITY.toLowerCase());
    expect(connection.registerAddress).toHaveBeenCalledWith('ada');
    expect(mocks.fetchMe).toHaveBeenCalledWith(SESSION);
    expect(useAuthStore.getState().account?.sparkWalletVerified).toBe(true);
    expect(mocks.rememberPhraseFromPrf).toHaveBeenCalledWith(
      expect.objectContaining({ credentialId: 'AQID', sessionToken: SESSION }),
    );
  });

  it('a second call while a run is in progress joins it instead of starting another', async () => {
    const { loadSdk } = fakeSdk();
    const first: WalletSetupStep[] = [];
    const second: WalletSetupStep[] = [];
    expect(walletSetupInFlight()).toBe(false);
    const a = runWalletSetup((step) => first.push(step), loadSdk);
    expect(walletSetupInFlight()).toBe(true);
    const b = runWalletSetup((step) => second.push(step), loadSdk);
    expect(b).toBe(a);
    await expect(Promise.all([a, b])).resolves.toEqual(['done', 'done']);
    expect(mocks.calls).toEqual(['passkey', 'connect', 'claim', 'register', 'refresh']);
    expect(second).toEqual([]);
    expect(first).toEqual(['passkey', 'connecting', 'claiming', 'registering', 'refreshing']);
    expect(walletSetupInFlight()).toBe(false);
  });

  it('starts a fresh run after the previous one ended', async () => {
    const { loadSdk } = fakeSdk();
    mocks.putMyWallet.mockRejectedValueOnce(new Error('wallet-request'));
    await expect(runWalletSetup(() => undefined, loadSdk)).resolves.toBe('failed');
    expect(walletSetupInFlight()).toBe(false);
    await expect(runWalletSetup(() => undefined, loadSdk)).resolves.toBe('done');
  });

  it('skips the passkey prompt when the phrase is already in tab memory', async () => {
    rememberSessionPhrase(MNEMONIC);
    const { loadSdk } = fakeSdk();
    const steps: WalletSetupStep[] = [];
    await expect(runWalletSetup((step) => steps.push(step), loadSdk)).resolves.toBe('done');
    expect(steps[0]).toBe('connecting');
    expect(mocks.calls).toEqual(['connect', 'claim', 'register', 'refresh']);
    expect(mocks.obtainPrfFirstFromGet).not.toHaveBeenCalled();
  });

  it('never sends the phrase anywhere', async () => {
    const { loadSdk } = fakeSdk();
    await runWalletSetup(() => undefined, loadSdk);
    const sent = JSON.stringify([mocks.putMyWallet.mock.calls, mocks.fetchMe.mock.calls]);
    expect(sent).not.toContain('abandon');
  });

  it('fails without a session or an eligible account', async () => {
    const { loadSdk } = fakeSdk();
    useAuthStore.setState({ session: null });
    await expect(runWalletSetup(() => undefined, loadSdk)).resolves.toBe('failed');
    useAuthStore.setState({ session: SESSION, account: account({ sparkWalletVerified: true }) });
    await expect(runWalletSetup(() => undefined, loadSdk)).resolves.toBe('failed');
    expect(mocks.calls).toEqual([]);
  });

  it('returns noPrf when the passkey yields no PRF output', async () => {
    mocks.obtainPrfFirstFromGet.mockResolvedValueOnce(null);
    const { loadSdk } = fakeSdk();
    await expect(runWalletSetup(() => undefined, loadSdk)).resolves.toBe('noPrf');
    expect(mocks.calls).toEqual(['passkey']);
    expect(peekSessionPhrase()).toBeNull();
  });

  it('returns cancelled when the member dismisses the prompt', async () => {
    mocks.obtainPrfFirstFromGet.mockRejectedValueOnce(
      Object.assign(new Error('x'), { name: 'NotAllowedError' }),
    );
    const { loadSdk } = fakeSdk();
    await expect(runWalletSetup(() => undefined, loadSdk)).resolves.toBe('cancelled');
  });

  it('fails when the prompt errors otherwise', async () => {
    mocks.obtainPrfFirstFromGet.mockRejectedValueOnce(new Error('boom'));
    const { loadSdk } = fakeSdk();
    await expect(runWalletSetup(() => undefined, loadSdk)).resolves.toBe('failed');
  });

  it('fails when the phrase could not be remembered', async () => {
    mocks.rememberPhraseFromPrf.mockResolvedValueOnce(false);
    const { loadSdk } = fakeSdk();
    await expect(runWalletSetup(() => undefined, loadSdk)).resolves.toBe('failed');
    expect(mocks.calls).toEqual(['passkey']);
  });

  it('fails when the wallet cannot connect and does not claim', async () => {
    const { loadSdk } = fakeSdk({
      connect: async () => {
        throw new Error('down');
      },
    });
    await expect(runWalletSetup(() => undefined, loadSdk)).resolves.toBe('failed');
    expect(mocks.putMyWallet).not.toHaveBeenCalled();
  });

  it('fails when the claim fails and does not register', async () => {
    mocks.putMyWallet.mockRejectedValueOnce(new Error('wallet-request'));
    const { loadSdk, connection } = fakeSdk();
    await expect(runWalletSetup(() => undefined, loadSdk)).resolves.toBe('failed');
    expect(connection.registerAddress).not.toHaveBeenCalled();
  });

  it('fails on a non-Error claim rejection', async () => {
    mocks.putMyWallet.mockRejectedValueOnce('nope');
    const { loadSdk } = fakeSdk();
    await expect(runWalletSetup(() => undefined, loadSdk)).resolves.toBe('failed');
  });

  it('skips registration and refreshes when the wallet is already verified (409)', async () => {
    mocks.putMyWallet.mockRejectedValueOnce(new Error('wallet-verified'));
    const { loadSdk, connection } = fakeSdk();
    const steps: WalletSetupStep[] = [];
    await expect(runWalletSetup((step) => steps.push(step), loadSdk)).resolves.toBe('done');
    expect(connection.registerAddress).not.toHaveBeenCalled();
    expect(steps).toEqual(['passkey', 'connecting', 'claiming', 'refreshing']);
  });

  it('fails when registration fails and does not refresh', async () => {
    const { loadSdk, connection } = fakeSdk();
    connection.registerAddress.mockRejectedValueOnce(new Error('rejected'));
    await expect(runWalletSetup(() => undefined, loadSdk)).resolves.toBe('failed');
    expect(mocks.fetchMe).not.toHaveBeenCalled();
  });

  it('fails when the refresh returns no account or an unverified one', async () => {
    const { loadSdk } = fakeSdk();
    mocks.fetchMe.mockResolvedValueOnce(null);
    await expect(runWalletSetup(() => undefined, loadSdk)).resolves.toBe('failed');
    mocks.fetchMe.mockResolvedValueOnce(account());
    await expect(runWalletSetup(() => undefined, loadSdk)).resolves.toBe('failed');
    expect(useAuthStore.getState().account?.sparkWalletVerified).toBe(false);
  });

  it('fails when the refresh rejects', async () => {
    mocks.fetchMe.mockRejectedValueOnce(new Error('down'));
    const { loadSdk } = fakeSdk();
    await expect(runWalletSetup(() => undefined, loadSdk)).resolves.toBe('failed');
  });

  it('succeeds on a retry after a failed registration', async () => {
    const { loadSdk, connection } = fakeSdk();
    connection.registerAddress.mockRejectedValueOnce(new Error('rejected'));
    await expect(runWalletSetup(() => undefined, loadSdk)).resolves.toBe('failed');
    mocks.calls.length = 0;
    await expect(runWalletSetup(() => undefined, loadSdk)).resolves.toBe('done');
    expect(mocks.calls).toEqual(['claim', 'register', 'refresh']);
  });

  function swapSession(): void {
    useAuthStore.setState({ session: 'other' });
  }

  it('is superseded when the session changes during the passkey step', async () => {
    mocks.rememberPhraseFromPrf.mockImplementationOnce(async () => {
      rememberSessionPhrase(MNEMONIC);
      swapSession();
      return true;
    });
    const { loadSdk } = fakeSdk();
    const steps: WalletSetupStep[] = [];
    await expect(runWalletSetup((step) => steps.push(step), loadSdk)).resolves.toBe('superseded');
    expect(steps).toEqual(['passkey']);
  });

  it('is superseded when the session changes while connecting', async () => {
    const base = fakeSdk();
    const swapping = fakeSdk({
      connect: async () => {
        swapSession();
        return base.connection as unknown as WalletConnection;
      },
    });
    rememberSessionPhrase(MNEMONIC);
    const steps: WalletSetupStep[] = [];
    await expect(runWalletSetup((step) => steps.push(step), swapping.loadSdk)).resolves.toBe(
      'superseded',
    );
    expect(steps).toEqual(['connecting']);
    expect(mocks.putMyWallet).not.toHaveBeenCalled();
  });

  it('is superseded when the session changes while claiming', async () => {
    mocks.putMyWallet.mockImplementationOnce(async () => {
      swapSession();
      return account();
    });
    const { loadSdk, connection } = fakeSdk();
    await expect(runWalletSetup(() => undefined, loadSdk)).resolves.toBe('superseded');
    expect(connection.registerAddress).not.toHaveBeenCalled();
  });

  it('is superseded when the session changes while registering', async () => {
    const { loadSdk, connection } = fakeSdk();
    connection.registerAddress.mockImplementationOnce(async () => {
      swapSession();
    });
    await expect(runWalletSetup(() => undefined, loadSdk)).resolves.toBe('superseded');
    expect(mocks.fetchMe).not.toHaveBeenCalled();
  });

  it('is superseded when the session changes during the refresh', async () => {
    mocks.fetchMe.mockImplementationOnce(async () => {
      useAuthStore.setState({ session: 'other' });
      return account({ sparkWalletVerified: true });
    });
    const { loadSdk } = fakeSdk();
    await expect(runWalletSetup(() => undefined, loadSdk)).resolves.toBe('superseded');
    expect(useAuthStore.getState().account?.sparkWalletVerified).toBe(false);
  });
});
