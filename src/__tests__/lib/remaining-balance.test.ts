import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RECOVERY_CONNECT_TIMEOUT_MS, RECOVERY_SEND_TRIES } from '@/lib/recovery-flow';
import {
  closePreviousWallet,
  openPreviousWallet,
  transferRemainingBalance,
  type RemainingBalanceDeps,
} from '@/lib/remaining-balance';
import { traceWallet } from '@/lib/sentry';
import { loadWalletSdk, type WalletConnection, type WalletSdk } from '@/lib/wallet/wallet-sdk';
import { receiveWalletSparkAddress } from '@/lib/wallet/wallet-service';

vi.mock('@/lib/sentry', () => ({
  traceWallet: vi.fn((_name: string, work: () => Promise<unknown>) => work()),
}));
vi.mock('@/lib/wallet/wallet-sdk', () => ({
  loadWalletSdk: vi.fn(),
}));
vi.mock('@/lib/wallet/wallet-service', () => ({
  appHost: vi.fn(() => 'app.test'),
  receiveWalletSparkAddress: vi.fn(),
}));

const WORDS = 'words of a previous wallet';
const KEY = `02${'c'.repeat(64)}`;
const OWN_ADDRESS = 'spark1mywallet';

/** A fake connection: the methods the move uses. */
interface FakeConnection {
  getInfo: ReturnType<typeof vi.fn>;
  sendToSparkAddress: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
}

/**
 * A fake previous wallet.
 *
 * @param balances - Synced balances in turn (the first is the open's read); the last repeats.
 * @returns The fake.
 */
function walletOf(balances: number[]): FakeConnection {
  let reads = 0;
  return {
    getInfo: vi.fn(async () => {
      const balanceSats = balances[Math.min(reads, balances.length - 1)]!;
      reads += 1;
      return { balanceSats, identityPubkey: KEY };
    }),
    sendToSparkAddress: vi.fn(async () => undefined),
    disconnect: vi.fn(async () => undefined),
  };
}

let wallet: FakeConnection;
let sdk: { connect: ReturnType<typeof vi.fn>; identityPubkey: ReturnType<typeof vi.fn> };
let deps: RemainingBalanceDeps & {
  loadSdk: ReturnType<typeof vi.fn>;
  sleep: ReturnType<typeof vi.fn>;
  randomUUID: ReturnType<typeof vi.fn>;
};
let uuids = 0;

beforeEach(async () => {
  await closePreviousWallet();
  vi.clearAllMocks();
  uuids = 0;
  wallet = walletOf([21_000, 21_000, 0]);
  sdk = {
    connect: vi.fn(async () => wallet as unknown as WalletConnection),
    identityPubkey: vi.fn(async () => KEY),
  };
  deps = {
    loadSdk: vi.fn(async () => sdk as unknown as WalletSdk),
    apiKey: () => 'breez-key',
    host: () => 'app.test',
    sleep: vi.fn(() => new Promise<void>(() => undefined)),
    randomUUID: vi.fn(() => {
      uuids += 1;
      return `key-${uuids}`;
    }),
  };
  vi.mocked(receiveWalletSparkAddress).mockResolvedValue(OWN_ADDRESS);
});

afterEach(async () => {
  await closePreviousWallet();
});

describe('openPreviousWallet', () => {
  it('words of another wallet are a mismatch, found before anything connects', async () => {
    sdk.identityPubkey.mockResolvedValueOnce(`03${'d'.repeat(64)}`);
    expect(await openPreviousWallet(WORDS, KEY, deps)).toBe('mismatch');
    sdk.identityPubkey.mockRejectedValueOnce(new Error('not a phrase'));
    expect(await openPreviousWallet(WORDS, KEY, deps)).toBe('mismatch');
    expect(sdk.connect).not.toHaveBeenCalled();
  });

  it('compares the keys without letter case', async () => {
    expect(await openPreviousWallet(WORDS, KEY.toUpperCase(), deps)).toEqual({
      balanceSats: 21_000,
    });
  });

  it('returns the synced balance and draws a fresh key for each wallet', async () => {
    expect(await openPreviousWallet(WORDS, KEY, deps)).toEqual({ balanceSats: 21_000 });
    expect(sdk.connect).toHaveBeenCalledWith(WORDS, 'breez-key', 'app.test');
    expect(wallet.getInfo).toHaveBeenCalledWith({ ensureSynced: true });
    expect(deps.sleep).toHaveBeenCalledWith(RECOVERY_CONNECT_TIMEOUT_MS);
    const first = wallet;
    wallet = walletOf([5_000, 5_000, 0]);
    expect(await openPreviousWallet(WORDS, KEY, deps)).toEqual({ balanceSats: 5_000 });
    expect(first.disconnect).toHaveBeenCalled();
    expect(await transferRemainingBalance()).toBe('sent');
    expect(wallet.sendToSparkAddress).toHaveBeenCalledWith(OWN_ADDRESS, 5_000, 'key-2');
  });

  it.each([
    ['without a wallet in this build', (): void => void (deps.apiKey = () => null)],
    [
      'when the SDK does not load',
      (): void => void deps.loadSdk.mockRejectedValueOnce(new Error('x')),
    ],
    [
      'when it does not connect',
      (): void => void sdk.connect.mockRejectedValueOnce(new Error('x')),
    ],
  ])('answers wallet %s', async (_label, arrange) => {
    arrange();
    expect(await openPreviousWallet(WORDS, KEY, deps)).toBe('wallet');
    expect(await transferRemainingBalance()).toBe('error');
  });

  it('closes a wallet that opened after the page closed it', async () => {
    sdk.connect.mockImplementationOnce(async () => {
      await closePreviousWallet();
      return wallet;
    });
    expect(await openPreviousWallet(WORDS, KEY, deps)).toBe('wallet');
    expect(wallet.disconnect).toHaveBeenCalled();
    expect(await transferRemainingBalance()).toBe('error');
  });

  it('uses the real effects by default', async () => {
    vi.mocked(loadWalletSdk).mockRejectedValueOnce(new Error('no download'));
    vi.stubEnv('NEXT_PUBLIC_BREEZ_API_KEY', 'build-key');
    expect(await openPreviousWallet(WORDS, KEY)).toBe('wallet');
    expect(loadWalletSdk).toHaveBeenCalled();
    vi.unstubAllEnvs();
  });
});

describe('transferRemainingBalance', () => {
  it('without an open wallet is an error', async () => {
    expect(await transferRemainingBalance()).toBe('error');
    expect(receiveWalletSparkAddress).not.toHaveBeenCalled();
  });

  it('an empty wallet is sent without a send', async () => {
    wallet = walletOf([0]);
    await openPreviousWallet(WORDS, KEY, deps);
    expect(await transferRemainingBalance()).toBe('sent');
    expect(wallet.sendToSparkAddress).not.toHaveBeenCalled();
  });

  it('sends the whole synced balance to the member’s own wallet', async () => {
    await openPreviousWallet(WORDS, KEY, deps);
    expect(await transferRemainingBalance()).toBe('sent');
    expect(wallet.sendToSparkAddress).toHaveBeenCalledWith(OWN_ADDRESS, 21_000, 'key-1');
    expect(traceWallet).toHaveBeenCalledWith('wallet.send', expect.any(Function), {
      route: 'spark',
    });
    expect(wallet.getInfo).toHaveBeenCalledTimes(3);
  });

  it('a send that throws keeps its key for Try again', async () => {
    wallet = walletOf([21_000, 21_000, 21_000, 0]);
    await openPreviousWallet(WORDS, KEY, deps);
    wallet.sendToSparkAddress.mockRejectedValueOnce(new Error('unknown outcome'));
    expect(await transferRemainingBalance()).toBe('error');
    expect(await transferRemainingBalance()).toBe('sent');
    expect(wallet.sendToSparkAddress.mock.calls.map((call) => call[2])).toEqual(['key-1', 'key-1']);
  });

  it('funds that arrived during a send get a second send with a new key', async () => {
    wallet = walletOf([21_000, 21_000, 700, 0]);
    await openPreviousWallet(WORDS, KEY, deps);
    expect(await transferRemainingBalance()).toBe('sent');
    expect(wallet.sendToSparkAddress.mock.calls).toEqual([
      [OWN_ADDRESS, 21_000, 'key-1'],
      [OWN_ADDRESS, 700, 'key-2'],
    ]);
  });

  it(`gives up after ${RECOVERY_SEND_TRIES} sends while funds keep arriving`, async () => {
    wallet = walletOf([100]);
    await openPreviousWallet(WORDS, KEY, deps);
    expect(await transferRemainingBalance()).toBe('error');
    expect(wallet.sendToSparkAddress).toHaveBeenCalledTimes(RECOVERY_SEND_TRIES);
  });

  it('a member wallet that does not open is an error', async () => {
    await openPreviousWallet(WORDS, KEY, deps);
    vi.mocked(receiveWalletSparkAddress).mockRejectedValueOnce(new Error('wallet-connect'));
    expect(await transferRemainingBalance()).toBe('error');
    expect(wallet.sendToSparkAddress).not.toHaveBeenCalled();
  });
});

describe('closePreviousWallet', () => {
  it('closes the wallet, ignores a failed close, and drops its key', async () => {
    await openPreviousWallet(WORDS, KEY, deps);
    wallet.disconnect.mockRejectedValueOnce(new Error('closed'));
    await closePreviousWallet();
    expect(wallet.disconnect).toHaveBeenCalled();
    expect(await transferRemainingBalance()).toBe('error');
  });
});
