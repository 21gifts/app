import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearSessionPhrase, peekSessionPhrase, rememberSessionPhrase } from '@/lib/tab-phrase';
import {
  announceReceivedForE2e,
  appHost,
  connectWallet,
  disconnectWallet,
  ensureWalletConnected,
  listenForWalletPhrase,
  getWalletPayment,
  listWalletPayments,
  listWalletReportPayments,
  onIncomingPayment,
  onPaymentReceived,
  parseWalletInput,
  payFromWallet,
  receiveWalletSparkAddress,
  refreshWallet,
  registerWalletAddress,
  WALLET_RETRY_BASE_MS,
  WALLET_RETRY_CAP_MS,
  WALLET_RETRY_DISCONNECT_WAIT_MS,
  WALLET_RETRY_JITTER,
  WALLET_SEND_TIMEOUT_MS,
  type WalletSdkLoader,
  WALLET_QUOTE_MARGIN_MS,
  WALLET_CONNECT_TIMEOUT_MS,
} from '@/lib/wallet/wallet-service';
import {
  type WalletConnection,
  type WalletPayment,
  type WalletPreparedPayment,
  type WalletSdk,
  type WalletTarget,
} from '@/lib/wallet/wallet-sdk';
import { captureMessage } from '@sentry/nextjs';
import { logInteraction } from '@/lib/interaction-log';
import { traceWallet } from '@/lib/sentry';
import { useAuthStore } from '@/stores/auth-store';

vi.mock('@/lib/interaction-log', () => ({ logInteraction: vi.fn() }));
vi.mock('@sentry/nextjs', () => ({ captureMessage: vi.fn() }));
vi.mock('@/lib/sentry', () => ({
  traceWallet: vi.fn((_name: string, work: () => Promise<unknown>) => work()),
}));
import { useWalletStore } from '@/stores/wallet-store';

const MNEMONIC =
  'abandon ability able about above absent absorb abstract absurd abuse access accident';
const API_KEY = 'test-breez-api-key';
const IDENTITY = `02${'a'.repeat(64)}`;
const SPARK_ADDRESS = 'spark1qexampleaddress';

const sdkImport = vi.hoisted(() =>
  vi.fn(async () => {
    throw new Error('real SDK must not load');
  }),
);

vi.mock('@breeztech/breez-sdk-spark/web', () => ({
  default: () => sdkImport(),
}));

const ORIGINAL_BREEZ = process.env.NEXT_PUBLIC_BREEZ_API_KEY;

/**
 * A wallet SDK around a fake `connect`; the offline signer is not used here.
 *
 * @param connect - The fake connect.
 * @returns The SDK.
 */
function sdkOf(connect: unknown): WalletSdk {
  return {
    connect: connect as WalletSdk['connect'],
    identityPubkey: vi.fn(),
    signAddressLookup: vi.fn(),
  };
}

function createFakeSdk(overrides?: {
  connect?: WalletSdk['connect'];
  getInfo?: WalletConnection['getInfo'];
  addEventListener?: WalletConnection['addEventListener'];
  disconnect?: WalletConnection['disconnect'];
}): {
  loadSdk: WalletSdkLoader;
  connection: {
    getInfo: ReturnType<typeof vi.fn>;
    addEventListener: ReturnType<typeof vi.fn>;
    registerAddress: ReturnType<typeof vi.fn>;
    listPayments: ReturnType<typeof vi.fn>;
    getPayment: ReturnType<typeof vi.fn>;
    listReportPayments: ReturnType<typeof vi.fn>;
    receiveSparkAddress: ReturnType<typeof vi.fn>;
    disconnect: ReturnType<typeof vi.fn>;
  };
  connect: ReturnType<typeof vi.fn>;
  listeners: Array<(event: { type: string }) => void>;
} {
  const listeners: Array<(event: { type: string }) => void> = [];
  const connection = {
    getInfo: vi.fn(
      overrides?.getInfo ??
        (async () => ({
          balanceSats: 21_000,
          identityPubkey: IDENTITY,
        })),
    ),
    addEventListener: vi.fn(
      overrides?.addEventListener ??
        (async (onEvent: (event: { type: string }) => void) => {
          listeners.push(onEvent);
          return 'listener-1';
        }),
    ),
    registerAddress: vi.fn(async () => undefined),
    listPayments: vi.fn(async () => []),
    getPayment: vi.fn(),
    listReportPayments: vi.fn(async () => []),
    receiveSparkAddress: vi.fn(async () => SPARK_ADDRESS),
    disconnect: vi.fn(overrides?.disconnect ?? (async () => undefined)),
  };
  const connect = vi.fn(
    overrides?.connect ?? (async () => connection as unknown as WalletConnection),
  );
  const loadSdk: WalletSdkLoader = vi.fn(async () => sdkOf(connect));
  return { loadSdk, connection, connect, listeners };
}

beforeEach(() => {
  process.env.NEXT_PUBLIC_BREEZ_API_KEY = API_KEY;
  clearSessionPhrase();
  useWalletStore.getState().reset();
  useAuthStore.setState({ session: null, account: null, wrongAccount: false });
  sdkImport.mockClear();
  vi.mocked(captureMessage).mockClear();
  vi.mocked(logInteraction).mockClear();
});

/**
 * Asserts that exactly one wallet-open failure was reported, with `reason`.
 *
 * @param reason - Expected reason.
 */
function expectWalletOpenReport(reason: 'timeout' | 'error'): void {
  expect(captureMessage).toHaveBeenCalledTimes(1);
  expect(captureMessage).toHaveBeenCalledWith('Wallet did not open', {
    level: 'error',
    fingerprint: ['wallet-open-failed', reason],
    tags: { wallet_open_reason: reason },
  });
  expect(logInteraction).toHaveBeenCalledWith('wallet_open_failed', { reason });
}

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

describe('connectWallet', () => {
  it('moves to connecting then ready with balance and identity', async () => {
    rememberSessionPhrase(MNEMONIC);
    const { loadSdk, connection } = createFakeSdk();
    const statuses: string[] = [];
    const unsub = useWalletStore.subscribe((state) => {
      statuses.push(state.status);
    });
    await expect(connectWallet(loadSdk)).resolves.toBeUndefined();
    unsub();
    expect(statuses).toContain('connecting');
    expect(useWalletStore.getState()).toMatchObject({
      status: 'ready',
      balanceSats: 21_000,
      identityPubkey: IDENTITY,
    });
    expect(connection.getInfo).toHaveBeenCalledWith({ ensureSynced: true });
  });

  it('stays connecting until the synchronized first read resolves', async () => {
    rememberSessionPhrase(MNEMONIC);
    let resolveInfo!: (info: { balanceSats: number; identityPubkey: string }) => void;
    const { loadSdk, connection } = createFakeSdk({
      getInfo: () =>
        new Promise<{ balanceSats: number; identityPubkey: string }>((resolve) => {
          resolveInfo = resolve;
        }),
    });
    const pending = connectWallet(loadSdk);
    await vi.waitFor(() => {
      expect(connection.getInfo).toHaveBeenCalledWith({ ensureSynced: true });
    });
    expect(useWalletStore.getState().status).toBe('connecting');
    resolveInfo({ balanceSats: 21_000, identityPubkey: IDENTITY });
    await expect(pending).resolves.toBeUndefined();
    expect(useWalletStore.getState().status).toBe('ready');
  });

  describe('connect attempt timeout', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('keeps a slow download connecting, with no deadline while it runs', async () => {
      rememberSessionPhrase(MNEMONIC);
      const loadSdk: WalletSdkLoader = vi.fn(() => new Promise<WalletSdk>(() => undefined));
      void connectWallet(loadSdk);
      await vi.advanceTimersByTimeAsync(0);
      expect(loadSdk).toHaveBeenCalledTimes(1);
      expect(useWalletStore.getState()).toMatchObject({ status: 'connecting', downloading: true });
      expect(vi.getTimerCount()).toBe(0);
      await vi.advanceTimersByTimeAsync(10 * WALLET_CONNECT_TIMEOUT_MS);
      expect(useWalletStore.getState()).toMatchObject({ status: 'connecting', downloading: true });
      expect(captureMessage).not.toHaveBeenCalled();
      expect(loadSdk).toHaveBeenCalledTimes(1);
    });

    it('starts the deadline once the download has finished', async () => {
      rememberSessionPhrase(MNEMONIC);
      let finishDownload!: (sdk: WalletSdk) => void;
      const loadSdk: WalletSdkLoader = vi.fn(
        () =>
          new Promise<WalletSdk>((resolve) => {
            finishDownload = resolve;
          }),
      );
      const connect = vi.fn(() => new Promise<WalletConnection>(() => undefined));
      const pending = connectWallet(loadSdk);
      await vi.advanceTimersByTimeAsync(5 * WALLET_CONNECT_TIMEOUT_MS);
      expect(connect).not.toHaveBeenCalled();
      finishDownload({ connect } as unknown as WalletSdk);
      await vi.advanceTimersByTimeAsync(0);
      expect(connect).toHaveBeenCalledTimes(1);
      expect(useWalletStore.getState()).toMatchObject({ status: 'connecting', downloading: false });
      await vi.advanceTimersByTimeAsync(WALLET_CONNECT_TIMEOUT_MS - 1);
      expect(useWalletStore.getState().status).toBe('connecting');
      await vi.advanceTimersByTimeAsync(1);
      await expect(pending).resolves.toBeUndefined();
      expect(useWalletStore.getState().status).toBe('error');
      expectWalletOpenReport('timeout');
    });

    it('sets error when connect never settles', async () => {
      rememberSessionPhrase(MNEMONIC);
      const { loadSdk } = createFakeSdk({
        connect: () => new Promise<WalletConnection>(() => undefined),
      });
      const pending = connectWallet(loadSdk);
      await vi.advanceTimersByTimeAsync(0);
      expect(useWalletStore.getState()).toMatchObject({ status: 'connecting', downloading: false });
      expect(captureMessage).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(WALLET_CONNECT_TIMEOUT_MS);
      await expect(pending).resolves.toBeUndefined();
      expect(useWalletStore.getState().status).toBe('error');
      expectWalletOpenReport('timeout');
    });

    it('shows no download once a loader has loaded the wallet code', async () => {
      rememberSessionPhrase(MNEMONIC);
      const { loadSdk } = createFakeSdk();
      await connectWallet(loadSdk);
      expect(useWalletStore.getState().status).toBe('ready');
      const downloading: boolean[] = [];
      const unsub = useWalletStore.subscribe((state) => {
        downloading.push(state.downloading);
      });
      await connectWallet(loadSdk);
      unsub();
      expect(downloading).not.toContain(true);
      expect(useWalletStore.getState().status).toBe('ready');
    });

    it('reports a failed download as an error and downloads again on the next attempt', async () => {
      rememberSessionPhrase(MNEMONIC);
      const sdk = createFakeSdk();
      const loadSdk: WalletSdkLoader = vi
        .fn<WalletSdkLoader>()
        .mockRejectedValueOnce(new Error('download failed'))
        .mockImplementation(sdk.loadSdk);
      await connectWallet(loadSdk);
      expect(useWalletStore.getState()).toMatchObject({
        status: 'error',
        downloading: false,
        retrying: true,
      });
      expectWalletOpenReport('error');
      await connectWallet(loadSdk);
      expect(loadSdk).toHaveBeenCalledTimes(2);
      expect(useWalletStore.getState().status).toBe('ready');
    });

    it('lets a superseded download finish without touching the newer attempt', async () => {
      rememberSessionPhrase(MNEMONIC);
      let finishDownload!: (sdk: WalletSdk) => void;
      const slow: WalletSdkLoader = vi.fn(
        () =>
          new Promise<WalletSdk>((resolve) => {
            finishDownload = resolve;
          }),
      );
      const fast = createFakeSdk();
      void connectWallet(slow);
      await vi.advanceTimersByTimeAsync(0);
      await connectWallet(fast.loadSdk);
      expect(useWalletStore.getState().status).toBe('ready');
      const stale = createFakeSdk();
      finishDownload({ connect: stale.connect } as unknown as WalletSdk);
      await vi.advanceTimersByTimeAsync(0);
      expect(stale.connect).not.toHaveBeenCalled();
      expect(useWalletStore.getState().status).toBe('ready');
    });

    it('ignores a superseded download that fails', async () => {
      rememberSessionPhrase(MNEMONIC);
      let failDownload!: (error: Error) => void;
      const slow: WalletSdkLoader = vi.fn(
        () =>
          new Promise<WalletSdk>((_resolve, reject) => {
            failDownload = reject;
          }),
      );
      const fast = createFakeSdk();
      void connectWallet(slow);
      await vi.advanceTimersByTimeAsync(0);
      await connectWallet(fast.loadSdk);
      failDownload(new Error('download failed'));
      await vi.advanceTimersByTimeAsync(0);
      expect(useWalletStore.getState().status).toBe('ready');
      expect(captureMessage).not.toHaveBeenCalled();
    });

    it('starts the deadline without waiting for the previous disconnect', async () => {
      rememberSessionPhrase(MNEMONIC);
      const first = createFakeSdk({
        disconnect: () => new Promise<never>(() => undefined),
      });
      await connectWallet(first.loadSdk);
      expect(useWalletStore.getState().status).toBe('ready');
      const second = createFakeSdk({
        connect: () => new Promise<WalletConnection>(() => undefined),
      });
      const pending = connectWallet(second.loadSdk);
      await vi.advanceTimersByTimeAsync(0);
      expect(second.connect).toHaveBeenCalled();
      expect(first.connection.disconnect).toHaveBeenCalledTimes(1);
      expect(useWalletStore.getState().status).toBe('connecting');
      await vi.advanceTimersByTimeAsync(30_000);
      await expect(pending).resolves.toBeUndefined();
      expect(useWalletStore.getState().status).toBe('error');
    });

    it('connects a healthy replacement without waiting for the previous disconnect', async () => {
      rememberSessionPhrase(MNEMONIC);
      const first = createFakeSdk({
        disconnect: () => new Promise<never>(() => undefined),
      });
      await connectWallet(first.loadSdk);
      const second = createFakeSdk({
        getInfo: async () => ({ balanceSats: 99_000, identityPubkey: IDENTITY }),
      });
      const pending = connectWallet(second.loadSdk);
      await vi.advanceTimersByTimeAsync(0);
      await expect(pending).resolves.toBeUndefined();
      expect(first.connection.disconnect).toHaveBeenCalledTimes(1);
      expect(useWalletStore.getState()).toMatchObject({
        status: 'ready',
        balanceSats: 99_000,
      });
    });

    it('sets error and disconnects a connection that resolves after the deadline', async () => {
      rememberSessionPhrase(MNEMONIC);
      let resolveConnect!: (connection: WalletConnection) => void;
      const { loadSdk, connection, connect } = createFakeSdk({
        connect: () =>
          new Promise<WalletConnection>((resolve) => {
            resolveConnect = resolve;
          }),
      });
      const pending = connectWallet(loadSdk);
      await vi.advanceTimersByTimeAsync(0);
      expect(connect).toHaveBeenCalled();
      expect(useWalletStore.getState().status).toBe('connecting');
      await vi.advanceTimersByTimeAsync(30_000);
      await expect(pending).resolves.toBeUndefined();
      expect(useWalletStore.getState().status).toBe('error');
      resolveConnect(connection as unknown as WalletConnection);
      await vi.advanceTimersByTimeAsync(0);
      expect(connection.disconnect).toHaveBeenCalled();
      expect(useWalletStore.getState().status).toBe('error');
    });

    it('sets error and disconnects when the first synchronized read never settles', async () => {
      rememberSessionPhrase(MNEMONIC);
      const { loadSdk, connection } = createFakeSdk({
        getInfo: () => new Promise<never>(() => undefined),
      });
      const pending = connectWallet(loadSdk);
      await vi.advanceTimersByTimeAsync(0);
      expect(connection.getInfo).toHaveBeenCalledWith({ ensureSynced: true });
      expect(useWalletStore.getState().status).toBe('connecting');
      await vi.advanceTimersByTimeAsync(30_000);
      await expect(pending).resolves.toBeUndefined();
      expect(useWalletStore.getState().status).toBe('error');
      expect(connection.disconnect).toHaveBeenCalled();
    });

    it('keeps the deadline after a stale first read leaves the wallet connecting', async () => {
      rememberSessionPhrase(MNEMONIC);
      let resolveFirst!: (info: { balanceSats: number; identityPubkey: string }) => void;
      const { loadSdk, connection, listeners } = createFakeSdk();
      connection.getInfo
        .mockImplementationOnce(
          () =>
            new Promise<{ balanceSats: number; identityPubkey: string }>((resolve) => {
              resolveFirst = resolve;
            }),
        )
        .mockImplementationOnce(() => new Promise<never>(() => undefined));
      const pending = connectWallet(loadSdk);
      await vi.advanceTimersByTimeAsync(0);
      expect(connection.getInfo).toHaveBeenCalledWith({ ensureSynced: true });
      listeners[0]?.({ type: 'synced' });
      await vi.advanceTimersByTimeAsync(0);
      expect(connection.getInfo.mock.calls).toEqual([[{ ensureSynced: true }], []]);
      resolveFirst({ balanceSats: 21_000, identityPubkey: IDENTITY });
      await vi.advanceTimersByTimeAsync(0);
      expect(useWalletStore.getState().status).toBe('connecting');
      await vi.advanceTimersByTimeAsync(30_000);
      await expect(pending).resolves.toBeUndefined();
      expect(useWalletStore.getState().status).toBe('error');
      expect(connection.disconnect).toHaveBeenCalled();
    });

    it('resolves at the deadline while disconnect remains pending', async () => {
      rememberSessionPhrase(MNEMONIC);
      const { loadSdk, connection } = createFakeSdk({
        getInfo: () => new Promise<never>(() => undefined),
        disconnect: () => new Promise<never>(() => undefined),
      });
      const pending = connectWallet(loadSdk);
      await vi.advanceTimersByTimeAsync(0);
      expect(connection.getInfo).toHaveBeenCalledWith({ ensureSynced: true });
      expect(useWalletStore.getState().status).toBe('connecting');
      await vi.advanceTimersByTimeAsync(30_000);
      await expect(pending).resolves.toBeUndefined();
      expect(useWalletStore.getState().status).toBe('error');
      expect(connection.disconnect).toHaveBeenCalled();
    });

    it('stays ready after the attempt finishes before the deadline', async () => {
      rememberSessionPhrase(MNEMONIC);
      const { loadSdk, connection } = createFakeSdk();
      const pending = connectWallet(loadSdk);
      await vi.advanceTimersByTimeAsync(0);
      await expect(pending).resolves.toBeUndefined();
      expect(useWalletStore.getState().status).toBe('ready');
      await vi.advanceTimersByTimeAsync(30_001);
      expect(useWalletStore.getState().status).toBe('ready');
      expect(connection.disconnect).not.toHaveBeenCalled();
    });

    it('leaves a wallet made ready by a synced refresh unchanged at the deadline', async () => {
      rememberSessionPhrase(MNEMONIC);
      const { loadSdk, connection, listeners } = createFakeSdk();
      connection.getInfo
        .mockImplementationOnce(() => new Promise<never>(() => undefined))
        .mockResolvedValueOnce({ balanceSats: 42_000, identityPubkey: IDENTITY });
      const pending = connectWallet(loadSdk);
      await vi.advanceTimersByTimeAsync(0);
      expect(connection.getInfo).toHaveBeenCalledWith({ ensureSynced: true });
      listeners[0]?.({ type: 'synced' });
      await vi.advanceTimersByTimeAsync(0);
      expect(useWalletStore.getState()).toMatchObject({
        status: 'ready',
        balanceSats: 42_000,
      });
      await vi.advanceTimersByTimeAsync(30_000);
      await expect(pending).resolves.toBeUndefined();
      expect(useWalletStore.getState()).toMatchObject({
        status: 'ready',
        balanceSats: 42_000,
      });
      expect(connection.disconnect).not.toHaveBeenCalled();
    });
  });

  it('lets a synced refresh win while the synchronized first read is pending', async () => {
    rememberSessionPhrase(MNEMONIC);
    let resolveFirst!: (info: { balanceSats: number; identityPubkey: string }) => void;
    const { loadSdk, connection, listeners } = createFakeSdk();
    connection.getInfo
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveFirst = resolve;
          }),
      )
      .mockResolvedValueOnce({ balanceSats: 42_000, identityPubkey: IDENTITY });
    const pending = connectWallet(loadSdk);
    await vi.waitFor(() => {
      expect(connection.getInfo).toHaveBeenCalledWith({ ensureSynced: true });
    });
    expect(useWalletStore.getState().status).toBe('connecting');
    listeners[0]?.({ type: 'synced' });
    await vi.waitFor(() => {
      expect(useWalletStore.getState()).toMatchObject({
        status: 'ready',
        balanceSats: 42_000,
      });
    });
    resolveFirst({ balanceSats: 21_000, identityPubkey: IDENTITY });
    await expect(pending).resolves.toBeUndefined();
    expect(useWalletStore.getState().balanceSats).toBe(42_000);
    expect(connection.getInfo.mock.calls).toEqual([[{ ensureSynced: true }], []]);
  });

  it('refreshes balance on synced and ignores other events', async () => {
    rememberSessionPhrase(MNEMONIC);
    const { loadSdk, connection, listeners } = createFakeSdk();
    connection.getInfo
      .mockResolvedValueOnce({ balanceSats: 21_000, identityPubkey: IDENTITY })
      .mockResolvedValueOnce({ balanceSats: 42_000, identityPubkey: IDENTITY });
    await connectWallet(loadSdk);
    expect(listeners).toHaveLength(1);
    listeners[0]?.({ type: 'paymentSucceeded' });
    await Promise.resolve();
    expect(connection.getInfo).toHaveBeenCalledTimes(1);
    listeners[0]?.({ type: 'synced' });
    await vi.waitFor(() => {
      expect(useWalletStore.getState().balanceSats).toBe(42_000);
    });
    expect(connection.getInfo).toHaveBeenCalledTimes(2);
    expect(connection.getInfo.mock.calls).toEqual([[{ ensureSynced: true }], []]);
  });

  it('ignores synced events from a replaced connection', async () => {
    rememberSessionPhrase(MNEMONIC);
    const first = createFakeSdk();
    const second = createFakeSdk();
    second.connection.getInfo
      .mockResolvedValueOnce({ balanceSats: 42_000, identityPubkey: IDENTITY })
      .mockResolvedValueOnce({ balanceSats: 84_000, identityPubkey: IDENTITY });
    await connectWallet(first.loadSdk);
    await connectWallet(second.loadSdk);
    expect(useWalletStore.getState().balanceSats).toBe(42_000);
    const stateBeforeStaleEvent = useWalletStore.getState();
    first.listeners[0]?.({ type: 'synced' });
    await Promise.resolve();
    expect(second.connection.getInfo).toHaveBeenCalledTimes(1);
    expect(useWalletStore.getState()).toBe(stateBeforeStaleEvent);
    second.listeners[0]?.({ type: 'synced' });
    await vi.waitFor(() => {
      expect(useWalletStore.getState().balanceSats).toBe(84_000);
    });
    expect(second.connection.getInfo).toHaveBeenCalledTimes(2);
  });

  it('passes the app host as the address domain', async () => {
    rememberSessionPhrase(MNEMONIC);
    const { loadSdk, connect } = createFakeSdk();
    await connectWallet(loadSdk);
    expect(connect).toHaveBeenCalledWith(MNEMONIC, API_KEY, window.location.host);
  });

  it('advances syncCount after connect and after each synced event', async () => {
    rememberSessionPhrase(MNEMONIC);
    const { loadSdk, listeners } = createFakeSdk();
    const before = useWalletStore.getState().syncCount;
    await connectWallet(loadSdk);
    expect(useWalletStore.getState().syncCount).toBe(before + 1);
    listeners[0]?.({ type: 'synced' });
    await vi.waitFor(() => {
      expect(useWalletStore.getState().syncCount).toBe(before + 2);
    });
  });

  it('refreshWallet without a connection does nothing', async () => {
    await expect(refreshWallet()).resolves.toBeUndefined();
    expect(useWalletStore.getState().status).toBe('locked');
  });

  it('refreshWallet reads plainly by default and after a sync when asked', async () => {
    rememberSessionPhrase(MNEMONIC);
    const { loadSdk, connection } = createFakeSdk();
    await connectWallet(loadSdk);
    connection.getInfo.mockClear();
    connection.getInfo.mockResolvedValueOnce({ balanceSats: 40, identityPubkey: IDENTITY });
    await refreshWallet();
    expect(connection.getInfo).toHaveBeenLastCalledWith();
    expect(useWalletStore.getState().balanceSats).toBe(40);
    connection.getInfo.mockResolvedValueOnce({ balanceSats: 45, identityPubkey: IDENTITY });
    await refreshWallet({ ensureSynced: true });
    expect(connection.getInfo).toHaveBeenLastCalledWith({ ensureSynced: true });
    expect(useWalletStore.getState().balanceSats).toBe(45);
  });

  it('refreshWallet with ignoreFailure keeps the wallet ready after a failed read, and the next read writes', async () => {
    rememberSessionPhrase(MNEMONIC);
    const { loadSdk, connection } = createFakeSdk();
    await connectWallet(loadSdk);
    const before = useWalletStore.getState().balanceSats;
    connection.getInfo.mockRejectedValueOnce(new Error('sync failed'));
    await expect(
      refreshWallet({ ensureSynced: true, ignoreFailure: true }),
    ).resolves.toBeUndefined();
    expect(useWalletStore.getState().status).toBe('ready');
    expect(useWalletStore.getState().balanceSats).toBe(before);
    expect(connection.disconnect).not.toHaveBeenCalled();
    connection.getInfo.mockResolvedValueOnce({ balanceSats: 99, identityPubkey: IDENTITY });
    await refreshWallet({ ensureSynced: true, ignoreFailure: true });
    expect(useWalletStore.getState().balanceSats).toBe(99);
  });

  it('refresh rejection sets error and disconnects', async () => {
    rememberSessionPhrase(MNEMONIC);
    const { loadSdk, connection } = createFakeSdk();
    await connectWallet(loadSdk);
    connection.getInfo.mockRejectedValueOnce(new Error('refresh failed'));
    await expect(refreshWallet()).resolves.toBeUndefined();
    expect(useWalletStore.getState().status).toBe('error');
    expect(connection.disconnect).toHaveBeenCalled();
  });

  it("a logout during a failed refresh's disconnect keeps the store locked", async () => {
    rememberSessionPhrase(MNEMONIC);
    let releaseDisconnect!: () => void;
    const hangingDisconnect = new Promise<void>((resolve) => {
      releaseDisconnect = resolve;
    });
    const { loadSdk, connection } = createFakeSdk({
      disconnect: () => hangingDisconnect,
    });
    await connectWallet(loadSdk);
    connection.getInfo.mockRejectedValueOnce(new Error('refresh failed'));
    const refresh = refreshWallet();
    await vi.waitFor(() => expect(connection.disconnect).toHaveBeenCalled());
    await expect(disconnectWallet()).resolves.toBeUndefined();
    expect(useWalletStore.getState().status).toBe('locked');
    releaseDisconnect();
    await expect(refresh).resolves.toBeUndefined();
    expect(useWalletStore.getState().status).toBe('locked');
  });

  it("a reconnect during a failed refresh's disconnect stays ready", async () => {
    rememberSessionPhrase(MNEMONIC);
    let releaseDisconnect!: () => void;
    const hangingDisconnect = new Promise<void>((resolve) => {
      releaseDisconnect = resolve;
    });
    const { loadSdk, connection } = createFakeSdk({
      disconnect: () => hangingDisconnect,
    });
    await connectWallet(loadSdk);
    connection.getInfo.mockRejectedValueOnce(new Error('refresh failed'));
    const refresh = refreshWallet();
    await vi.waitFor(() => expect(connection.disconnect).toHaveBeenCalled());
    const second = createFakeSdk({
      getInfo: async () => ({ balanceSats: 99_000, identityPubkey: IDENTITY }),
    });
    await connectWallet(second.loadSdk);
    expect(useWalletStore.getState()).toMatchObject({
      status: 'ready',
      balanceSats: 99_000,
    });
    releaseDisconnect();
    await expect(refresh).resolves.toBeUndefined();
    expect(useWalletStore.getState().status).toBe('ready');
    expect(useWalletStore.getState().balanceSats).toBe(99_000);
    expect(second.connection.disconnect).not.toHaveBeenCalled();
  });

  it('connect loader rejection sets error', async () => {
    rememberSessionPhrase(MNEMONIC);
    const loadSdk = vi.fn(async () => {
      throw new Error('load failed');
    });
    await expect(connectWallet(loadSdk)).resolves.toBeUndefined();
    expect(useWalletStore.getState().status).toBe('error');
    expectWalletOpenReport('error');
  });

  it('does not report a failed attempt that a newer one replaced', async () => {
    rememberSessionPhrase(MNEMONIC);
    let reject: (err: Error) => void = () => undefined;
    const stale = connectWallet(
      () =>
        new Promise<WalletSdk>((_, fail) => {
          reject = fail;
        }),
    );
    await vi.waitFor(() => {
      expect(useWalletStore.getState().status).toBe('connecting');
    });
    await connectWallet(createFakeSdk().loadSdk);
    reject(new Error('load failed'));
    await stale;
    expect(useWalletStore.getState().status).toBe('ready');
    expect(captureMessage).not.toHaveBeenCalled();
    expect(logInteraction).not.toHaveBeenCalledWith('wallet_open_failed', expect.anything());
  });

  it('connect rejection sets error', async () => {
    rememberSessionPhrase(MNEMONIC);
    const { loadSdk, connect } = createFakeSdk({
      connect: async () => {
        throw new Error('connect failed');
      },
    });
    connect.mockRejectedValue(new Error('connect failed'));
    await expect(connectWallet(loadSdk)).resolves.toBeUndefined();
    expect(useWalletStore.getState().status).toBe('error');
  });

  it('getInfo rejection during connect sets error', async () => {
    rememberSessionPhrase(MNEMONIC);
    const { loadSdk } = createFakeSdk({
      getInfo: async () => {
        throw new Error('info failed');
      },
    });
    await expect(connectWallet(loadSdk)).resolves.toBeUndefined();
    expect(useWalletStore.getState().status).toBe('error');
  });

  it('addEventListener rejection sets error', async () => {
    rememberSessionPhrase(MNEMONIC);
    const { loadSdk } = createFakeSdk({
      addEventListener: async () => {
        throw new Error('listener failed');
      },
    });
    await expect(connectWallet(loadSdk)).resolves.toBeUndefined();
    expect(useWalletStore.getState().status).toBe('error');
  });

  it('disconnectWallet resets to locked and calls disconnect', async () => {
    rememberSessionPhrase(MNEMONIC);
    const { loadSdk, connection } = createFakeSdk();
    await connectWallet(loadSdk);
    await expect(disconnectWallet()).resolves.toBeUndefined();
    expect(useWalletStore.getState().status).toBe('locked');
    expect(connection.disconnect).toHaveBeenCalled();
  });

  it('disconnectWallet still resolves when disconnect rejects', async () => {
    rememberSessionPhrase(MNEMONIC);
    const { loadSdk, connection } = createFakeSdk({
      disconnect: async () => {
        throw new Error('disconnect failed');
      },
    });
    await connectWallet(loadSdk);
    connection.disconnect.mockRejectedValue(new Error('disconnect failed'));
    await expect(disconnectWallet()).resolves.toBeUndefined();
    expect(useWalletStore.getState().status).toBe('locked');
  });

  it('a second connect while the first is pending wins', async () => {
    rememberSessionPhrase(MNEMONIC);
    let releaseFirst!: (connection: WalletConnection) => void;
    const firstConnection = {
      getInfo: vi.fn(async () => ({ balanceSats: 1, identityPubkey: IDENTITY })),
      addEventListener: vi.fn(async () => 'l1'),
      disconnect: vi.fn(async () => undefined),
    };
    const secondConnection = {
      getInfo: vi.fn(async () => ({ balanceSats: 2, identityPubkey: IDENTITY })),
      addEventListener: vi.fn(async () => 'l2'),
      disconnect: vi.fn(async () => undefined),
    };
    const connect = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<WalletConnection>((resolve) => {
            releaseFirst = resolve;
          }),
      )
      .mockResolvedValueOnce(secondConnection as unknown as WalletConnection);
    const loadSdk: WalletSdkLoader = async () => sdkOf(connect);
    const first = connectWallet(loadSdk);
    await vi.waitFor(() => expect(connect).toHaveBeenCalledTimes(1));
    const second = connectWallet(loadSdk);
    await vi.waitFor(() => expect(connect).toHaveBeenCalledTimes(2));
    releaseFirst(firstConnection as unknown as WalletConnection);
    await expect(first).resolves.toBeUndefined();
    await expect(second).resolves.toBeUndefined();
    expect(firstConnection.disconnect).toHaveBeenCalled();
    expect(useWalletStore.getState().balanceSats).toBe(2);
  });

  it('disconnectWallet while connect is pending leaves the store locked', async () => {
    rememberSessionPhrase(MNEMONIC);
    let releaseConnect!: (connection: WalletConnection) => void;
    const lateConnection = {
      getInfo: vi.fn(async () => ({ balanceSats: 99, identityPubkey: IDENTITY })),
      addEventListener: vi.fn(async () => 'l'),
      disconnect: vi.fn(async () => undefined),
    };
    const connect = vi.fn(
      () =>
        new Promise<WalletConnection>((resolve) => {
          releaseConnect = resolve;
        }),
    );
    const loadSdk: WalletSdkLoader = async () => sdkOf(connect);
    const pending = connectWallet(loadSdk);
    await vi.waitFor(() => expect(connect).toHaveBeenCalledTimes(1));
    await disconnectWallet();
    expect(useWalletStore.getState().status).toBe('locked');
    releaseConnect(lateConnection as unknown as WalletConnection);
    await expect(pending).resolves.toBeUndefined();
    expect(lateConnection.disconnect).toHaveBeenCalled();
    expect(useWalletStore.getState().status).toBe('locked');
    expect(useWalletStore.getState().balanceSats).toBeNull();
  });

  it('a stale run rejection leaves the store untouched', async () => {
    rememberSessionPhrase(MNEMONIC);
    let rejectFirst!: (err: Error) => void;
    const connect = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<WalletConnection>((_resolve, reject) => {
            rejectFirst = reject;
          }),
      )
      .mockResolvedValueOnce({
        getInfo: vi.fn(async () => ({ balanceSats: 7, identityPubkey: IDENTITY })),
        addEventListener: vi.fn(async () => 'l'),
        disconnect: vi.fn(async () => undefined),
      } as unknown as WalletConnection);
    const loadSdk: WalletSdkLoader = async () => sdkOf(connect);
    const first = connectWallet(loadSdk);
    await vi.waitFor(() => expect(connect).toHaveBeenCalledTimes(1));
    const second = connectWallet(loadSdk);
    await expect(second).resolves.toBeUndefined();
    expect(useWalletStore.getState().balanceSats).toBe(7);
    rejectFirst(new Error('stale'));
    await expect(first).resolves.toBeUndefined();
    expect(useWalletStore.getState().status).toBe('ready');
    expect(useWalletStore.getState().balanceSats).toBe(7);
  });

  it('an older failed read does not override a newer successful one', async () => {
    rememberSessionPhrase(MNEMONIC);
    const { loadSdk, connection } = createFakeSdk();
    await connectWallet(loadSdk);
    connection.disconnect.mockClear();
    let resolveSecond!: (info: { balanceSats: number; identityPubkey: string }) => void;
    let rejectFirst!: (err: Error) => void;
    connection.getInfo
      .mockImplementationOnce(
        () =>
          new Promise((_resolve, reject) => {
            rejectFirst = reject;
          }),
      )
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveSecond = resolve;
          }),
      );
    const first = refreshWallet();
    const second = refreshWallet();
    resolveSecond({ balanceSats: 99_000, identityPubkey: IDENTITY });
    await expect(second).resolves.toBeUndefined();
    expect(useWalletStore.getState()).toMatchObject({
      status: 'ready',
      balanceSats: 99_000,
    });
    rejectFirst(new Error('first failed'));
    await expect(first).resolves.toBeUndefined();
    expect(useWalletStore.getState()).toMatchObject({
      status: 'ready',
      balanceSats: 99_000,
    });
    expect(connection.disconnect).not.toHaveBeenCalled();
  });

  it('a getInfo rejection after disconnect during refresh leaves the store locked', async () => {
    rememberSessionPhrase(MNEMONIC);
    const { loadSdk, connection } = createFakeSdk();
    await connectWallet(loadSdk);
    let rejectInfo!: (err: Error) => void;
    connection.getInfo.mockImplementationOnce(
      () =>
        new Promise((_resolve, reject) => {
          rejectInfo = reject;
        }),
    );
    const refresh = refreshWallet();
    await expect(disconnectWallet()).resolves.toBeUndefined();
    expect(useWalletStore.getState().status).toBe('locked');
    rejectInfo(new Error('stale refresh'));
    await expect(refresh).resolves.toBeUndefined();
    expect(useWalletStore.getState().status).toBe('locked');
  });

  it('overlapping refresh keeps the later balance when both succeed out of order', async () => {
    rememberSessionPhrase(MNEMONIC);
    const { loadSdk, connection } = createFakeSdk();
    await connectWallet(loadSdk);
    let resolveFirst!: (info: { balanceSats: number; identityPubkey: string }) => void;
    let resolveSecond!: (info: { balanceSats: number; identityPubkey: string }) => void;
    connection.getInfo
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveFirst = resolve;
          }),
      )
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveSecond = resolve;
          }),
      );
    const first = refreshWallet();
    const second = refreshWallet();
    resolveSecond({ balanceSats: 2, identityPubkey: IDENTITY });
    await expect(second).resolves.toBeUndefined();
    expect(useWalletStore.getState().balanceSats).toBe(2);
    resolveFirst({ balanceSats: 1, identityPubkey: IDENTITY });
    await expect(first).resolves.toBeUndefined();
    expect(useWalletStore.getState().balanceSats).toBe(2);
  });

  it('does nothing when the key is set but there is no phrase', async () => {
    const { loadSdk } = createFakeSdk();
    expect(peekSessionPhrase()).toBeNull();
    await expect(connectWallet(loadSdk)).resolves.toBeUndefined();
    expect(loadSdk).not.toHaveBeenCalled();
    expect(useWalletStore.getState().status).toBe('locked');
  });

  it('returns early when superseded after loadSdk', async () => {
    rememberSessionPhrase(MNEMONIC);
    let releaseLoad!: (sdk: WalletSdk) => void;
    const connect = vi.fn(async () => {
      throw new Error('should not connect');
    });
    const loadSdk: WalletSdkLoader = vi.fn(
      () =>
        new Promise<WalletSdk>((resolve) => {
          releaseLoad = resolve;
        }),
    );
    const pending = connectWallet(loadSdk);
    await vi.waitFor(() => expect(loadSdk).toHaveBeenCalled());
    await disconnectWallet();
    releaseLoad(sdkOf(connect));
    await expect(pending).resolves.toBeUndefined();
    expect(connect).not.toHaveBeenCalled();
    expect(useWalletStore.getState().status).toBe('locked');
  });

  it('disconnects a superseded connection even when disconnect rejects', async () => {
    rememberSessionPhrase(MNEMONIC);
    let releaseConnect!: (connection: WalletConnection) => void;
    const lateConnection = {
      getInfo: vi.fn(async () => ({ balanceSats: 1, identityPubkey: IDENTITY })),
      addEventListener: vi.fn(async () => 'l'),
      disconnect: vi.fn(async () => {
        throw new Error('late disconnect');
      }),
    };
    const connect = vi.fn(
      () =>
        new Promise<WalletConnection>((resolve) => {
          releaseConnect = resolve;
        }),
    );
    const loadSdk: WalletSdkLoader = async () => sdkOf(connect);
    const pending = connectWallet(loadSdk);
    await vi.waitFor(() => expect(connect).toHaveBeenCalled());
    await disconnectWallet();
    releaseConnect(lateConnection as unknown as WalletConnection);
    await expect(pending).resolves.toBeUndefined();
    expect(lateConnection.disconnect).toHaveBeenCalled();
    expect(useWalletStore.getState().status).toBe('locked');
  });

  it('returns early when superseded after addEventListener', async () => {
    rememberSessionPhrase(MNEMONIC);
    let releaseListener!: () => void;
    const connection = {
      getInfo: vi.fn(async () => ({ balanceSats: 5, identityPubkey: IDENTITY })),
      addEventListener: vi.fn(
        () =>
          new Promise<string>((resolve) => {
            releaseListener = () => {
              resolve('l');
            };
          }),
      ),
      disconnect: vi.fn(async () => undefined),
    };
    const loadSdk: WalletSdkLoader = async () =>
      sdkOf(vi.fn(async () => connection as unknown as WalletConnection));
    const pending = connectWallet(loadSdk);
    await vi.waitFor(() => expect(connection.addEventListener).toHaveBeenCalled());
    await disconnectWallet();
    releaseListener();
    await expect(pending).resolves.toBeUndefined();
    expect(connection.getInfo).not.toHaveBeenCalled();
    expect(useWalletStore.getState().status).toBe('locked');
  });
});

describe('automatic retries after a failed open', () => {
  /** Nominal pauses of the first retries: doubling from the base, then the cap. */
  const NOMINAL_MS = [2_000, 4_000, 8_000, 16_000, 32_000, 60_000, 60_000];
  let random: ReturnType<typeof vi.spyOn>;

  /** A loader whose every connect is refused, so each attempt fails at once. */
  function refusingSdk(): ReturnType<typeof createFakeSdk> {
    return createFakeSdk({
      connect: async () => {
        throw new Error('unreachable');
      },
    });
  }

  function setOnline(online: boolean): void {
    Object.defineProperty(window.navigator, 'onLine', { configurable: true, get: () => online });
  }

  function setVisibility(state: 'visible' | 'hidden'): void {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state });
  }

  beforeEach(() => {
    vi.useFakeTimers();
    // No jitter unless a test asks for it: every pause is the nominal one.
    random = vi.spyOn(Math, 'random').mockReturnValue(0);
    rememberSessionPhrase(MNEMONIC);
  });

  afterEach(async () => {
    await disconnectWallet();
    random.mockRestore();
    Reflect.deleteProperty(window.navigator, 'onLine');
    Reflect.deleteProperty(document, 'visibilityState');
    vi.useRealTimers();
  });

  it('states the backoff values', () => {
    expect(WALLET_RETRY_BASE_MS).toBe(2_000);
    expect(WALLET_RETRY_CAP_MS).toBe(60_000);
    expect(WALLET_RETRY_JITTER).toBe(0.2);
  });

  it('retries with doubling pauses up to the cap and keeps the error state', async () => {
    const { loadSdk } = refusingSdk();
    await connectWallet(loadSdk);
    expect(loadSdk).toHaveBeenCalledTimes(1);
    expect(useWalletStore.getState()).toMatchObject({ status: 'error', retrying: true });
    const statuses: string[] = [];
    const unsub = useWalletStore.subscribe((state) => {
      statuses.push(state.status);
    });
    let attempts = 1;
    for (const pause of NOMINAL_MS) {
      await vi.advanceTimersByTimeAsync(pause - 1);
      expect(loadSdk).toHaveBeenCalledTimes(attempts);
      await vi.advanceTimersByTimeAsync(1);
      attempts += 1;
      expect(loadSdk).toHaveBeenCalledTimes(attempts);
      expect(useWalletStore.getState()).toMatchObject({ status: 'error', retrying: true });
    }
    unsub();
    expect(statuses.every((status) => status === 'error')).toBe(true);
    expectWalletOpenReport('error');
    expect(logInteraction).toHaveBeenCalledTimes(1);
  });

  it('shortens each pause by the jitter and never exceeds the cap', async () => {
    random.mockReturnValue(1);
    const { loadSdk } = refusingSdk();
    await connectWallet(loadSdk);
    await vi.advanceTimersByTimeAsync(1_599);
    expect(loadSdk).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(loadSdk).toHaveBeenCalledTimes(2);
    // 3 200, 6 400, 12 800, 25 600, then the capped pause of 48 000.
    await vi.advanceTimersByTimeAsync(3_200 + 6_400 + 12_800 + 25_600);
    expect(loadSdk).toHaveBeenCalledTimes(6);
    await vi.advanceTimersByTimeAsync(47_999);
    expect(loadSdk).toHaveBeenCalledTimes(6);
    await vi.advanceTimersByTimeAsync(1);
    expect(loadSdk).toHaveBeenCalledTimes(7);
  });

  it('becomes ready by itself, ends the cycle, and reports the next failed open again', async () => {
    const sdk = createFakeSdk();
    sdk.connect.mockRejectedValueOnce(new Error('unreachable'));
    sdk.connect.mockRejectedValueOnce(new Error('unreachable'));
    const removeWindow = vi.spyOn(window, 'removeEventListener');
    const removeDocument = vi.spyOn(document, 'removeEventListener');
    await connectWallet(sdk.loadSdk);
    await vi.advanceTimersByTimeAsync(2_000);
    expect(useWalletStore.getState()).toMatchObject({ status: 'error', retrying: true });
    await vi.advanceTimersByTimeAsync(4_000);
    expect(useWalletStore.getState()).toMatchObject({
      status: 'ready',
      balanceSats: 21_000,
      retrying: false,
    });
    expect(sdk.connect).toHaveBeenCalledTimes(3);
    expect(vi.getTimerCount()).toBe(0);
    expect(removeWindow).toHaveBeenCalledWith('online', expect.any(Function));
    expect(removeDocument).toHaveBeenCalledWith('visibilitychange', expect.any(Function));
    expect(captureMessage).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(600_000);
    expect(sdk.connect).toHaveBeenCalledTimes(3);
    removeWindow.mockRestore();
    removeDocument.mockRestore();

    await connectWallet(refusingSdk().loadSdk);
    expect(captureMessage).toHaveBeenCalledTimes(2);
    expect(logInteraction).toHaveBeenCalledTimes(2);
  });

  it('reports a timeout once and stays silent while later retries time out', async () => {
    const { loadSdk } = createFakeSdk({
      connect: () => new Promise<WalletConnection>(() => undefined),
    });
    const pending = connectWallet(loadSdk);
    await vi.advanceTimersByTimeAsync(30_000);
    await pending;
    expectWalletOpenReport('timeout');
    await vi.advanceTimersByTimeAsync(2_000);
    expect(loadSdk).toHaveBeenCalledTimes(2);
    // The retry runs into its own 30 s deadline, then waits 4 s for the next one.
    await vi.advanceTimersByTimeAsync(30_000);
    expect(useWalletStore.getState()).toMatchObject({ status: 'error', retrying: true });
    await vi.advanceTimersByTimeAsync(3_999);
    expect(loadSdk).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(loadSdk).toHaveBeenCalledTimes(3);
    expect(captureMessage).toHaveBeenCalledTimes(1);
    expect(logInteraction).toHaveBeenCalledTimes(1);
  });

  it('does not report again after Try again while the wallet was never ready', async () => {
    const { loadSdk } = refusingSdk();
    await connectWallet(loadSdk);
    await connectWallet(loadSdk);
    await connectWallet(loadSdk);
    expect(captureMessage).toHaveBeenCalledTimes(1);
    expect(logInteraction).toHaveBeenCalledTimes(1);
  });

  it('reports the first failed open of the next sign-in', async () => {
    const { loadSdk } = refusingSdk();
    await connectWallet(loadSdk);
    await disconnectWallet();
    await connectWallet(loadSdk);
    expect(captureMessage).toHaveBeenCalledTimes(2);
  });

  it('retries at once and starts the backoff again when the browser is online again', async () => {
    const { loadSdk } = refusingSdk();
    await connectWallet(loadSdk);
    await vi.advanceTimersByTimeAsync(2_000 + 4_000);
    expect(loadSdk).toHaveBeenCalledTimes(3);
    // The next retry would follow after 8 s.
    await vi.advanceTimersByTimeAsync(1_000);
    window.dispatchEvent(new Event('online'));
    await vi.advanceTimersByTimeAsync(0);
    expect(loadSdk).toHaveBeenCalledTimes(4);
    await vi.advanceTimersByTimeAsync(1_999);
    expect(loadSdk).toHaveBeenCalledTimes(4);
    await vi.advanceTimersByTimeAsync(1);
    expect(loadSdk).toHaveBeenCalledTimes(5);
  });

  it('waits while the browser is offline and continues on the online event', async () => {
    const { loadSdk } = refusingSdk();
    await connectWallet(loadSdk);
    setOnline(false);
    await vi.advanceTimersByTimeAsync(600_000);
    expect(loadSdk).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
    expect(useWalletStore.getState()).toMatchObject({ status: 'error', retrying: true });
    window.dispatchEvent(new Event('online'));
    await vi.advanceTimersByTimeAsync(0);
    expect(loadSdk).toHaveBeenCalledTimes(1);
    setOnline(true);
    window.dispatchEvent(new Event('online'));
    await vi.advanceTimersByTimeAsync(0);
    expect(loadSdk).toHaveBeenCalledTimes(2);
  });

  it('waits while the tab is hidden and retries at once when it is visible again', async () => {
    const { loadSdk } = refusingSdk();
    await connectWallet(loadSdk);
    await vi.advanceTimersByTimeAsync(2_000 + 4_000);
    expect(loadSdk).toHaveBeenCalledTimes(3);
    setVisibility('hidden');
    document.dispatchEvent(new Event('visibilitychange'));
    await vi.advanceTimersByTimeAsync(600_000);
    expect(loadSdk).toHaveBeenCalledTimes(3);
    expect(vi.getTimerCount()).toBe(0);
    setVisibility('visible');
    document.dispatchEvent(new Event('visibilitychange'));
    await vi.advanceTimersByTimeAsync(0);
    expect(loadSdk).toHaveBeenCalledTimes(4);
    // The backoff started again: the next retry follows after 2 s, not 8 s.
    await vi.advanceTimersByTimeAsync(2_000);
    expect(loadSdk).toHaveBeenCalledTimes(5);
  });

  it('does not start a second attempt when a trigger arrives while a retry runs', async () => {
    let refuse!: (reason: Error) => void;
    const sdk = createFakeSdk();
    sdk.connect.mockRejectedValueOnce(new Error('unreachable'));
    sdk.connect.mockRejectedValueOnce(new Error('unreachable'));
    sdk.connect.mockImplementationOnce(
      () =>
        new Promise<WalletConnection>((_resolve, reject) => {
          refuse = reject;
        }),
    );
    sdk.connect.mockRejectedValue(new Error('unreachable'));
    await connectWallet(sdk.loadSdk);
    await vi.advanceTimersByTimeAsync(2_000 + 4_000);
    expect(sdk.connect).toHaveBeenCalledTimes(3);
    window.dispatchEvent(new Event('online'));
    document.dispatchEvent(new Event('visibilitychange'));
    await vi.advanceTimersByTimeAsync(0);
    expect(sdk.connect).toHaveBeenCalledTimes(3);
    refuse(new Error('unreachable'));
    await vi.advanceTimersByTimeAsync(0);
    // The trigger reset the backoff, so the retry after this failure follows after 2 s.
    await vi.advanceTimersByTimeAsync(1_999);
    expect(sdk.connect).toHaveBeenCalledTimes(3);
    await vi.advanceTimersByTimeAsync(1);
    expect(sdk.connect).toHaveBeenCalledTimes(4);
  });

  it('stops on sign-out: no timer, no listener, no further attempt', async () => {
    const { loadSdk } = refusingSdk();
    await connectWallet(loadSdk);
    expect(vi.getTimerCount()).toBe(1);
    await disconnectWallet();
    expect(vi.getTimerCount()).toBe(0);
    expect(useWalletStore.getState()).toMatchObject({ status: 'locked', retrying: false });
    window.dispatchEvent(new Event('online'));
    document.dispatchEvent(new Event('visibilitychange'));
    await vi.advanceTimersByTimeAsync(600_000);
    expect(loadSdk).toHaveBeenCalledTimes(1);
  });

  it('closes the connection of a retry that was still running at sign-out', async () => {
    let open!: (connection: WalletConnection) => void;
    const sdk = createFakeSdk();
    sdk.connect.mockRejectedValueOnce(new Error('unreachable'));
    sdk.connect.mockImplementationOnce(
      () =>
        new Promise<WalletConnection>((resolve) => {
          open = resolve;
        }),
    );
    await connectWallet(sdk.loadSdk);
    await vi.advanceTimersByTimeAsync(2_000);
    expect(sdk.connect).toHaveBeenCalledTimes(2);
    await disconnectWallet();
    open(sdk.connection as unknown as WalletConnection);
    await vi.advanceTimersByTimeAsync(0);
    expect(sdk.connection.disconnect).toHaveBeenCalledTimes(1);
    expect(sdk.connection.getInfo).not.toHaveBeenCalled();
    expect(useWalletStore.getState()).toMatchObject({ status: 'locked', retrying: false });
    // Only the deadline of that closed attempt is left; it starts nothing.
    await vi.advanceTimersByTimeAsync(600_000);
    expect(sdk.connect).toHaveBeenCalledTimes(2);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('Try again supersedes a waiting retry and starts the cycle over', async () => {
    const { loadSdk } = refusingSdk();
    await connectWallet(loadSdk);
    await vi.advanceTimersByTimeAsync(2_000 + 4_000);
    expect(loadSdk).toHaveBeenCalledTimes(3);
    const statuses: string[] = [];
    const unsub = useWalletStore.subscribe((state) => {
      statuses.push(`${state.status}:${String(state.retrying)}`);
    });
    await connectWallet(loadSdk);
    unsub();
    expect(statuses).toContain('connecting:false');
    expect(loadSdk).toHaveBeenCalledTimes(4);
    expect(vi.getTimerCount()).toBe(1);
    await vi.advanceTimersByTimeAsync(1_999);
    expect(loadSdk).toHaveBeenCalledTimes(4);
    await vi.advanceTimersByTimeAsync(1);
    expect(loadSdk).toHaveBeenCalledTimes(5);
  });

  it('a newer run supersedes a running retry, whose late connection is closed', async () => {
    let open!: (connection: WalletConnection) => void;
    const stale = createFakeSdk();
    stale.connect.mockRejectedValueOnce(new Error('unreachable'));
    stale.connect.mockImplementationOnce(
      () =>
        new Promise<WalletConnection>((resolve) => {
          open = resolve;
        }),
    );
    await connectWallet(stale.loadSdk);
    await vi.advanceTimersByTimeAsync(2_000);
    expect(stale.connect).toHaveBeenCalledTimes(2);
    const fresh = createFakeSdk({
      getInfo: async () => ({ balanceSats: 99_000, identityPubkey: IDENTITY }),
    });
    await connectWallet(fresh.loadSdk);
    expect(useWalletStore.getState()).toMatchObject({ status: 'ready', balanceSats: 99_000 });
    open(stale.connection as unknown as WalletConnection);
    await vi.advanceTimersByTimeAsync(0);
    expect(stale.connection.disconnect).toHaveBeenCalledTimes(1);
    expect(fresh.connection.disconnect).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(600_000);
    expect(stale.connect).toHaveBeenCalledTimes(2);
    expect(fresh.connect).toHaveBeenCalledTimes(1);
    expect(useWalletStore.getState()).toMatchObject({ status: 'ready', balanceSats: 99_000 });
    expect(captureMessage).toHaveBeenCalledTimes(1);
  });

  it('ends the cycle when the phrase or the key is gone at the next retry', async () => {
    const { loadSdk } = refusingSdk();
    await connectWallet(loadSdk);
    clearSessionPhrase();
    await vi.advanceTimersByTimeAsync(2_000);
    expect(loadSdk).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
    expect(useWalletStore.getState().retrying).toBe(false);

    rememberSessionPhrase(MNEMONIC);
    await connectWallet(loadSdk);
    expect(useWalletStore.getState().retrying).toBe(true);
    delete process.env.NEXT_PUBLIC_BREEZ_API_KEY;
    await vi.advanceTimersByTimeAsync(2_000);
    expect(loadSdk).toHaveBeenCalledTimes(2);
    expect(vi.getTimerCount()).toBe(0);
    expect(useWalletStore.getState().retrying).toBe(false);
  });

  it('plans no retry when the phrase or the key is gone at the failure', async () => {
    for (const remove of [
      (): void => clearSessionPhrase(),
      (): void => {
        delete process.env.NEXT_PUBLIC_BREEZ_API_KEY;
      },
    ]) {
      process.env.NEXT_PUBLIC_BREEZ_API_KEY = API_KEY;
      rememberSessionPhrase(MNEMONIC);
      let refuse!: (reason: Error) => void;
      const sdk = createFakeSdk({
        connect: () =>
          new Promise<WalletConnection>((_resolve, reject) => {
            refuse = reject;
          }),
      });
      const pending = connectWallet(sdk.loadSdk);
      await vi.advanceTimersByTimeAsync(0);
      remove();
      refuse(new Error('unreachable'));
      await pending;
      expect(useWalletStore.getState()).toMatchObject({ status: 'error', retrying: false });
      expect(vi.getTimerCount()).toBe(0);
    }
  });

  it('opens the wallet again after a balance read failed', async () => {
    const sdk = createFakeSdk();
    await connectWallet(sdk.loadSdk);
    expect(useWalletStore.getState().status).toBe('ready');
    sdk.connection.getInfo.mockRejectedValueOnce(new Error('read failed'));
    await refreshWallet();
    expect(useWalletStore.getState()).toMatchObject({ status: 'error', retrying: true });
    expect(captureMessage).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(2_000);
    expect(sdk.connect).toHaveBeenCalledTimes(2);
    expect(useWalletStore.getState()).toMatchObject({ status: 'ready', retrying: false });
    expect(captureMessage).not.toHaveBeenCalled();
  });

  /**
   * A wallet that connects but whose first balance read fails, and whose
   * disconnect only finishes when the test says so.
   */
  function slowClosingSdk(): ReturnType<typeof createFakeSdk> & { finishDisconnect: () => void } {
    const pending: Array<() => void> = [];
    const sdk = createFakeSdk({
      getInfo: async () => {
        throw new Error('read failed');
      },
      disconnect: () =>
        new Promise<void>((resolve) => {
          pending.push(resolve);
        }),
    });
    return {
      ...sdk,
      finishDisconnect: () => {
        for (const resolve of pending.splice(0)) {
          resolve();
        }
      },
    };
  }

  it('plans no retry and lets no trigger open a connection while the failed one is still disconnecting', async () => {
    const sdk = slowClosingSdk();
    void connectWallet(sdk.loadSdk);
    await vi.advanceTimersByTimeAsync(0);
    expect(sdk.connect).toHaveBeenCalledTimes(1);
    expect(sdk.connection.disconnect).toHaveBeenCalledTimes(1);
    expect(useWalletStore.getState()).toMatchObject({ status: 'error', retrying: true });
    // The disconnect is still running: longer than the first pause, and no retry has started.
    await vi.advanceTimersByTimeAsync(3_000);
    expect(sdk.connect).toHaveBeenCalledTimes(1);
    window.dispatchEvent(new Event('online'));
    document.dispatchEvent(new Event('visibilitychange'));
    await vi.advanceTimersByTimeAsync(1_000);
    expect(sdk.connect).toHaveBeenCalledTimes(1);
    expect(sdk.loadSdk).toHaveBeenCalledTimes(1);
    expect(useWalletStore.getState()).toMatchObject({ status: 'error', retrying: true });
    // Once it has finished, the first pause starts from there.
    sdk.finishDisconnect();
    await vi.advanceTimersByTimeAsync(1_999);
    expect(sdk.connect).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(sdk.connect).toHaveBeenCalledTimes(2);
    // The retry failed the same way: its trigger waits for its own disconnect too.
    expect(sdk.connection.disconnect).toHaveBeenCalledTimes(2);
    window.dispatchEvent(new Event('online'));
    await vi.advanceTimersByTimeAsync(4_000);
    expect(sdk.connect).toHaveBeenCalledTimes(2);
    sdk.finishDisconnect();
    await vi.advanceTimersByTimeAsync(2_000);
    expect(sdk.connect).toHaveBeenCalledTimes(3);
  });

  it('goes on after 5 s when the disconnect never settles', async () => {
    expect(WALLET_RETRY_DISCONNECT_WAIT_MS).toBe(5_000);
    const sdk = slowClosingSdk();
    void connectWallet(sdk.loadSdk);
    await vi.advanceTimersByTimeAsync(0);
    expect(sdk.connection.disconnect).toHaveBeenCalledTimes(1);
    // Until the wait is over nothing starts, not even on a trigger.
    await vi.advanceTimersByTimeAsync(4_999);
    window.dispatchEvent(new Event('online'));
    await vi.advanceTimersByTimeAsync(0);
    expect(sdk.connect).toHaveBeenCalledTimes(1);
    // At 5 s the first pause of 2 s starts as if the disconnect had finished.
    await vi.advanceTimersByTimeAsync(1 + 1_999);
    expect(sdk.connect).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(sdk.connect).toHaveBeenCalledTimes(2);
    expect(useWalletStore.getState()).toMatchObject({ status: 'error', retrying: true });
    // The retry failed the same way; its disconnect hangs too. The next pause is 4 s after its 5 s wait.
    expect(sdk.connection.disconnect).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(5_000 + 3_999);
    expect(sdk.connect).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(sdk.connect).toHaveBeenCalledTimes(3);
    // It keeps going without a limit, never held back for more than the wait.
    await vi.advanceTimersByTimeAsync(5_000 + 8_000);
    expect(sdk.connect).toHaveBeenCalledTimes(4);
  });

  it('retries at once on a trigger after the wait for a hanging disconnect is over, and a late end of that disconnect changes nothing', async () => {
    const sdk = slowClosingSdk();
    void connectWallet(sdk.loadSdk);
    await vi.advanceTimersByTimeAsync(5_000);
    expect(sdk.connect).toHaveBeenCalledTimes(1);
    // The pause is running now; the old disconnect finishing late must not plan a second retry.
    sdk.finishDisconnect();
    await vi.advanceTimersByTimeAsync(500);
    expect(sdk.connect).toHaveBeenCalledTimes(1);
    window.dispatchEvent(new Event('online'));
    await vi.advanceTimersByTimeAsync(0);
    expect(sdk.connect).toHaveBeenCalledTimes(2);
    // Only that one retry ran: the timer of the replaced pause is gone.
    sdk.finishDisconnect();
    await vi.advanceTimersByTimeAsync(1_999);
    expect(sdk.connect).toHaveBeenCalledTimes(2);
  });

  it('retries at once on a trigger that arrives after the disconnect has finished', async () => {
    const sdk = slowClosingSdk();
    void connectWallet(sdk.loadSdk);
    await vi.advanceTimersByTimeAsync(0);
    sdk.finishDisconnect();
    await vi.advanceTimersByTimeAsync(1_000);
    expect(sdk.connect).toHaveBeenCalledTimes(1);
    window.dispatchEvent(new Event('online'));
    await vi.advanceTimersByTimeAsync(0);
    expect(sdk.connect).toHaveBeenCalledTimes(2);
  });

  it('plans no retry when the member signs out while the failed connection is still disconnecting', async () => {
    const sdk = slowClosingSdk();
    void connectWallet(sdk.loadSdk);
    await vi.advanceTimersByTimeAsync(0);
    await disconnectWallet();
    expect(useWalletStore.getState()).toMatchObject({ status: 'locked', retrying: false });
    sdk.finishDisconnect();
    await vi.advanceTimersByTimeAsync(600_000);
    expect(sdk.connect).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
    expect(useWalletStore.getState()).toMatchObject({ status: 'locked', retrying: false });
  });

  it('Try again does not wait for that disconnect, and the old plan is dropped', async () => {
    const sdk = slowClosingSdk();
    void connectWallet(sdk.loadSdk);
    await vi.advanceTimersByTimeAsync(0);
    const fresh = createFakeSdk({
      getInfo: async () => ({ balanceSats: 99_000, identityPubkey: IDENTITY }),
    });
    await connectWallet(fresh.loadSdk);
    expect(useWalletStore.getState()).toMatchObject({
      status: 'ready',
      balanceSats: 99_000,
      retrying: false,
    });
    sdk.finishDisconnect();
    await vi.advanceTimersByTimeAsync(600_000);
    expect(sdk.connect).toHaveBeenCalledTimes(1);
    expect(fresh.connect).toHaveBeenCalledTimes(1);
    expect(fresh.connection.disconnect).not.toHaveBeenCalled();
    expect(useWalletStore.getState().status).toBe('ready');
  });

  it('lets ensureWalletConnected open the wallet itself while a retry is waiting', async () => {
    const sdk = createFakeSdk();
    sdk.connect.mockRejectedValueOnce(new Error('unreachable'));
    await connectWallet(sdk.loadSdk);
    expect(useWalletStore.getState()).toMatchObject({ status: 'error', retrying: true });
    await expect(ensureWalletConnected(sdk.loadSdk)).resolves.toBe(IDENTITY);
    expect(sdk.connect).toHaveBeenCalledTimes(2);
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe('listenForWalletPhrase', () => {
  it('connects when a phrase is remembered and disconnects when cleared', async () => {
    const { loadSdk } = createFakeSdk();
    const unsub = listenForWalletPhrase(loadSdk);
    rememberSessionPhrase(MNEMONIC);
    await vi.waitFor(() => {
      expect(useWalletStore.getState().status).toBe('ready');
    });
    clearSessionPhrase();
    await vi.waitFor(() => {
      expect(useWalletStore.getState().status).toBe('locked');
    });
    unsub();
  });

  it('disconnects on logout via clearAuth', async () => {
    const { loadSdk } = createFakeSdk();
    rememberSessionPhrase(MNEMONIC);
    const unsub = listenForWalletPhrase(loadSdk);
    await vi.waitFor(() => {
      expect(useWalletStore.getState().status).toBe('ready');
    });
    useAuthStore.getState().clearAuth();
    await vi.waitFor(() => {
      expect(useWalletStore.getState().status).toBe('locked');
    });
    unsub();
  });

  it('connects immediately when a phrase is already present', async () => {
    rememberSessionPhrase(MNEMONIC);
    const { loadSdk } = createFakeSdk();
    const unsub = listenForWalletPhrase(loadSdk);
    await vi.waitFor(() => {
      expect(useWalletStore.getState().status).toBe('ready');
    });
    unsub();
  });

  it('unsubscribe stops reacting to phrase changes', async () => {
    const { loadSdk } = createFakeSdk();
    const unsub = listenForWalletPhrase(loadSdk);
    unsub();
    rememberSessionPhrase(MNEMONIC);
    await Promise.resolve();
    expect(loadSdk).not.toHaveBeenCalled();
    expect(useWalletStore.getState().status).toBe('locked');
  });
});

describe('disabled wallet path', () => {
  it('never loads the SDK or adds a window listener when the key is unset', async () => {
    delete process.env.NEXT_PUBLIC_BREEZ_API_KEY;
    useWalletStore.getState().reset();
    const { loadSdk } = createFakeSdk();
    const addSpy = vi.spyOn(window, 'addEventListener');
    await expect(connectWallet(loadSdk)).resolves.toBeUndefined();
    const unsub = listenForWalletPhrase(loadSdk);
    rememberSessionPhrase(MNEMONIC);
    await Promise.resolve();
    expect(loadSdk).not.toHaveBeenCalled();
    expect(sdkImport).not.toHaveBeenCalled();
    expect(addSpy).not.toHaveBeenCalledWith('21gifts:wallet-phrase', expect.any(Function));
    expect(useWalletStore.getState().status).toBe('disabled');
    await expect(ensureWalletConnected(loadSdk)).rejects.toThrow('wallet-connect');
    expect(loadSdk).not.toHaveBeenCalled();
    unsub();
    addSpy.mockRestore();
  });
});

describe('ensureWalletConnected', () => {
  it('connects from the tab phrase and returns the identity key', async () => {
    rememberSessionPhrase(MNEMONIC);
    const { loadSdk, connect } = createFakeSdk();
    await expect(ensureWalletConnected(loadSdk)).resolves.toBe(IDENTITY);
    expect(connect).toHaveBeenCalledTimes(1);
  });

  it('reuses a ready connection without connecting again', async () => {
    rememberSessionPhrase(MNEMONIC);
    const { loadSdk, connect } = createFakeSdk();
    await connectWallet(loadSdk);
    await expect(ensureWalletConnected(loadSdk)).resolves.toBe(IDENTITY);
    expect(connect).toHaveBeenCalledTimes(1);
  });

  it('waits for an in-flight connection', async () => {
    rememberSessionPhrase(MNEMONIC);
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const { loadSdk, connect, connection } = createFakeSdk({
      connect: async () => {
        await gate;
        return connection as unknown as WalletConnection;
      },
    });
    const first = connectWallet(loadSdk);
    await vi.waitFor(() => {
      expect(useWalletStore.getState().status).toBe('connecting');
    });
    const ensured = ensureWalletConnected(loadSdk);
    release();
    await first;
    await expect(ensured).resolves.toBe(IDENTITY);
    expect(connect).toHaveBeenCalledTimes(1);
  });

  it('rejects when the connection fails', async () => {
    rememberSessionPhrase(MNEMONIC);
    const { loadSdk } = createFakeSdk({
      connect: async () => {
        throw new Error('boom');
      },
    });
    await expect(ensureWalletConnected(loadSdk)).rejects.toThrow('wallet-connect');
    expect(useWalletStore.getState().status).toBe('error');
  });

  it('rejects without a tab phrase', async () => {
    const { loadSdk } = createFakeSdk();
    await expect(ensureWalletConnected(loadSdk)).rejects.toThrow('wallet-connect');
    expect(loadSdk).not.toHaveBeenCalled();
  });

  it('rejects when the store is ready but the connection was dropped', async () => {
    useWalletStore.getState().setReady(1, IDENTITY);
    const { loadSdk } = createFakeSdk();
    await expect(ensureWalletConnected(loadSdk)).rejects.toThrow('wallet-connect');
  });
});

describe('appHost', () => {
  it('is the host the page is served from', () => {
    expect(appHost()).toBe(window.location.host);
    expect(appHost()).not.toBe('');
  });
});

describe('receiveWalletSparkAddress', () => {
  it('opens the wallet from the tab phrase on the app host and reads its Spark address', async () => {
    rememberSessionPhrase(MNEMONIC);
    const { loadSdk, connect, connection } = createFakeSdk();
    await expect(receiveWalletSparkAddress(loadSdk)).resolves.toBe(SPARK_ADDRESS);
    expect(connect).toHaveBeenCalledWith(MNEMONIC, API_KEY, window.location.host);
    expect(connection.receiveSparkAddress).toHaveBeenCalledTimes(1);
  });

  it('reuses the open wallet', async () => {
    rememberSessionPhrase(MNEMONIC);
    const { loadSdk, connect } = createFakeSdk();
    await connectWallet(loadSdk);
    await expect(receiveWalletSparkAddress()).resolves.toBe(SPARK_ADDRESS);
    expect(connect).toHaveBeenCalledTimes(1);
  });

  it('rejects when the wallet cannot be opened', async () => {
    const { loadSdk, connect } = createFakeSdk();
    await expect(receiveWalletSparkAddress(loadSdk)).rejects.toThrow('wallet-connect');
    expect(connect).not.toHaveBeenCalled();
  });

  it('rejects when the wallet closes before the address is read', async () => {
    rememberSessionPhrase(MNEMONIC);
    const { loadSdk, connection } = createFakeSdk();
    await connectWallet(loadSdk);
    const pending = receiveWalletSparkAddress(loadSdk);
    // The wallet check has passed one tick later; the address is read on the next.
    await Promise.resolve();
    void disconnectWallet();
    await expect(pending).rejects.toThrow('wallet-connect');
    expect(connection.receiveSparkAddress).not.toHaveBeenCalled();
  });

  it('passes an SDK error on', async () => {
    rememberSessionPhrase(MNEMONIC);
    const { loadSdk, connection } = createFakeSdk();
    connection.receiveSparkAddress.mockRejectedValueOnce(new Error('sdk failed'));
    await expect(receiveWalletSparkAddress(loadSdk)).rejects.toThrow('sdk failed');
  });
});

describe('registerWalletAddress', () => {
  it('rejects without a connection', async () => {
    await expect(registerWalletAddress('ada')).rejects.toThrow('wallet-connect');
  });

  it('registers the username on the connection', async () => {
    rememberSessionPhrase(MNEMONIC);
    const { loadSdk, connection } = createFakeSdk();
    await connectWallet(loadSdk);
    await expect(registerWalletAddress('ada')).resolves.toBeUndefined();
    expect(connection.registerAddress).toHaveBeenCalledWith('ada');
  });
});

describe('listWalletPayments', () => {
  it('rejects without a connection', async () => {
    await expect(listWalletPayments({ offset: 0, limit: 20 })).rejects.toThrow('wallet-connect');
  });

  it('forwards the page to the connection', async () => {
    rememberSessionPhrase(MNEMONIC);
    const { loadSdk, connection } = createFakeSdk();
    const row = {
      id: 'p1',
      direction: 'received',
      amountSats: 1,
      timestamp: 1,
      status: 'completed',
      senderComment: null,
    };
    await connectWallet(loadSdk);
    connection.listPayments.mockResolvedValueOnce([row]);
    await expect(listWalletPayments({ offset: 20, limit: 20 })).resolves.toEqual([row]);
    expect(connection.listPayments).toHaveBeenCalledWith({ offset: 20, limit: 20 });
  });
});

describe('getWalletPayment', () => {
  it('rejects without a connection', async () => {
    await expect(getWalletPayment('p1')).rejects.toThrow('wallet-connect');
  });

  it('reads the payment from the connection', async () => {
    rememberSessionPhrase(MNEMONIC);
    const { loadSdk, connection } = createFakeSdk();
    const row = { id: 'p1', direction: 'sent' };
    connection.getPayment.mockResolvedValueOnce(row);
    await connectWallet(loadSdk);
    await expect(getWalletPayment('p1')).resolves.toBe(row);
    expect(connection.getPayment).toHaveBeenCalledWith('p1');
  });
});

describe('listWalletReportPayments', () => {
  it('rejects without a connection', async () => {
    await expect(listWalletReportPayments({ offset: 0, limit: 200 })).rejects.toThrow(
      'wallet-connect',
    );
  });

  it('forwards the page to the connection', async () => {
    rememberSessionPhrase(MNEMONIC);
    const { loadSdk, connection } = createFakeSdk();
    const row = { id: 'p1', direction: 'in', amountSats: 1 };
    connection.listReportPayments.mockResolvedValueOnce([row]);
    await connectWallet(loadSdk);
    await expect(listWalletReportPayments({ offset: 200, limit: 200 })).resolves.toEqual([row]);
    expect(connection.listReportPayments).toHaveBeenCalledWith({ offset: 200, limit: 200 });
  });
});

/**
 * Connects a fake wallet whose connection also parses and prepares payments.
 */
const ONCHAIN_TARGET: WalletTarget = {
  type: 'onchain',
  address: 'bc1q',
  amountSats: null,
  recipient: 'bc1q',
};

/**
 * Wait until the next `getInfo` call reads after the wallet has synced. The
 * connect read already made a synced call, so this waits for a new one.
 *
 * @param getInfo - The connection's `getInfo` mock.
 * @returns Resolves once that call was made.
 */
async function waitForSyncedRead(getInfo: ReturnType<typeof vi.fn>): Promise<void> {
  const before = getInfo.mock.calls.length;
  await vi.waitFor(() => {
    expect(getInfo.mock.calls.length).toBeGreaterThan(before);
  });
  expect(getInfo).toHaveBeenLastCalledWith({ ensureSynced: true });
}

async function connectPaying(options: {
  balanceSats?: number;
  parse?: WalletConnection['parse'];
  prepare?: WalletConnection['prepare'];
}): Promise<{
  getInfo: ReturnType<typeof vi.fn>;
  parse: ReturnType<typeof vi.fn>;
  prepare: ReturnType<typeof vi.fn>;
}> {
  const getInfo = vi.fn(async () => ({
    balanceSats: options.balanceSats ?? 21_000,
    identityPubkey: IDENTITY,
  }));
  const parse = vi.fn(options.parse ?? (async () => ({ type: 'unsupported' as const })));
  const prepare = vi.fn(
    options.prepare ??
      (async () => ({ amountSats: 2_100, feeSats: 0, send: async () => undefined })),
  );
  const conn = {
    getInfo,
    addEventListener: vi.fn(async () => 'listener-1'),
    disconnect: vi.fn(async () => undefined),
    parse,
    prepare,
  };
  rememberSessionPhrase(MNEMONIC);
  const { loadSdk } = createFakeSdk({ connect: async () => conn as unknown as WalletConnection });
  await connectWallet(loadSdk);
  expect(useWalletStore.getState().status).toBe('ready');
  return { getInfo, parse, prepare };
}

describe('payFromWallet', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('asks to unlock without a connection', async () => {
    await expect(payFromWallet({ type: 'input', input: 'spark1x' })).resolves.toEqual({
      kind: 'unlock',
      failure: {
        stage: 'prepare',
        reason: 'unlock',
        method: 'spark',
        amountSats: null,
        feeSats: null,
      },
    });
  });

  it('returns amount and fee, then pays once and refreshes the balance', async () => {
    const send = vi.fn(async () => undefined);
    const { getInfo, prepare } = await connectPaying({
      prepare: async () => ({ amountSats: 2_100, feeSats: 0, send }),
    });
    const result = await payFromWallet({ type: 'input', input: 'spark1x' });
    expect(prepare).toHaveBeenCalledWith({ type: 'input', input: 'spark1x' });
    expect(getInfo).toHaveBeenLastCalledWith({ ensureSynced: true });
    expect(result).toMatchObject({
      kind: 'confirm',
      amountSats: 2_100,
      feeSats: 0,
      method: 'spark',
    });
    if (result.kind !== 'confirm') {
      throw new Error('expected confirm');
    }
    const readsBefore = getInfo.mock.calls.length;
    vi.mocked(logInteraction).mockClear();
    useAuthStore.setState({ session: 'sess' });
    await expect(result.send()).resolves.toEqual({ kind: 'paid' });
    expect(logInteraction).toHaveBeenCalledWith(
      'payment_sent',
      { amountSats: 2_100, feeSats: 0, onchain: false },
      'sess',
    );
    await vi.waitFor(() => {
      expect(getInfo.mock.calls.length).toBeGreaterThan(readsBefore);
    });
    expect(send).toHaveBeenCalledTimes(1);
    await expect(result.send()).resolves.toEqual({
      kind: 'failed',
      failure: {
        stage: 'confirm',
        reason: 'already_sent',
        method: 'spark',
        amountSats: 2_100,
        feeSats: 0,
      },
    });
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('reports insufficient balance when amount and fee exceed it', async () => {
    await connectPaying({
      balanceSats: 2_100,
      prepare: async () => ({ amountSats: 2_100, feeSats: 1, send: async () => undefined }),
    });
    await expect(payFromWallet({ type: 'input', input: 'spark1x' })).resolves.toEqual({
      kind: 'insufficient',
      feeSats: 1,
      failure: {
        stage: 'prepare',
        reason: 'insufficient',
        method: 'spark',
        amountSats: 2_100,
        feeSats: 1,
      },
    });
  });

  it('writes the synced balance read to the store', async () => {
    const { getInfo } = await connectPaying({});
    getInfo.mockResolvedValueOnce({ balanceSats: 50, identityPubkey: IDENTITY });
    await expect(payFromWallet({ type: 'input', input: 'a' })).resolves.toMatchObject({
      kind: 'insufficient',
      feeSats: 0,
      failure: { stage: 'prepare', reason: 'insufficient', method: 'unknown' },
    });
    expect(useWalletStore.getState().balanceSats).toBe(50);
  });

  it('checks an overtaken synced read against a newer written balance, not a pending one, and fails after a disconnect', async () => {
    const { getInfo } = await connectPaying({});
    let finish: (value: { balanceSats: number; identityPubkey: string }) => void = () => undefined;
    getInfo.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const overtaken = payFromWallet({ type: 'input', input: 'a' });
    await waitForSyncedRead(getInfo);
    getInfo.mockResolvedValueOnce({ balanceSats: 30_000, identityPubkey: IDENTITY });
    await refreshWallet();
    finish({ balanceSats: 50, identityPubkey: IDENTITY });
    await expect(overtaken).resolves.toMatchObject({ kind: 'confirm', amountSats: 2_100 });
    expect(useWalletStore.getState().balanceSats).toBe(30_000);

    getInfo.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const pending = payFromWallet({ type: 'input', input: 'a' });
    await waitForSyncedRead(getInfo);
    const payFinish = finish;
    getInfo.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const pendingRefresh = refreshWallet();
    payFinish({ balanceSats: 50, identityPubkey: IDENTITY });
    expect(useWalletStore.getState().balanceSats).toBe(30_000);
    await expect(pending).resolves.toMatchObject({ kind: 'insufficient', feeSats: 0 });
    finish({ balanceSats: 50, identityPubkey: IDENTITY });
    await pendingRefresh;

    getInfo.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const dropped = payFromWallet({ type: 'input', input: 'a' });
    await waitForSyncedRead(getInfo);
    await disconnectWallet();
    finish({ balanceSats: 50, identityPubkey: IDENTITY });
    await expect(dropped).resolves.toEqual({
      kind: 'failed',
      failure: {
        stage: 'prepare',
        reason: 'disconnected',
        method: 'unknown',
        amountSats: 2_100,
        feeSats: 0,
      },
    });
    expect(useWalletStore.getState().balanceSats).toBeNull();
  });

  it('fails a prepare that rejects after the connection changed, even for low funds', async () => {
    let reject: (err: Error) => void = () => undefined;
    await connectPaying({
      prepare: () =>
        new Promise((_, fail) => {
          reject = fail;
        }),
    });
    const pending = payFromWallet({ type: 'input', input: 'a' });
    await disconnectWallet();
    const error = new Error('Insufficient funds');
    reject(error);
    await expect(pending).resolves.toEqual({
      kind: 'failed',
      failure: {
        stage: 'prepare',
        reason: 'disconnected',
        method: 'unknown',
        amountSats: null,
        feeSats: null,
        error,
      },
    });
  });

  it('maps a prepare rejection to failed, or to insufficient when the SDK says so', async () => {
    let calls = 0;
    await connectPaying({
      prepare: async () => {
        calls += 1;
        if (calls === 1) {
          throw new Error('network');
        }
        if (calls === 2) {
          throw new Error('Insufficient funds');
        }
        throw 'insufficientFunds';
      },
    });
    await expect(payFromWallet({ type: 'input', input: 'a' })).resolves.toMatchObject({
      kind: 'failed',
      failure: { stage: 'prepare', reason: 'sdk_error', error: new Error('network') },
    });
    await expect(payFromWallet({ type: 'input', input: 'a' })).resolves.toMatchObject({
      kind: 'insufficient',
      failure: { stage: 'prepare', reason: 'insufficient' },
    });
    await expect(payFromWallet({ type: 'input', input: 'a', amountSats: 5 })).resolves.toEqual({
      kind: 'insufficient',
      failure: {
        stage: 'prepare',
        reason: 'insufficient',
        method: 'unknown',
        amountSats: 5,
        feeSats: null,
        error: 'insufficientFunds',
      },
    });
  });

  it('fails without reading the balance when the connection changed during prepare', async () => {
    let finish: () => void = () => undefined;
    const { getInfo } = await connectPaying({
      prepare: () =>
        new Promise((resolve) => {
          finish = () => {
            resolve({ amountSats: 1, feeSats: 0, send: async () => undefined });
          };
        }),
    });
    const reads = getInfo.mock.calls.length;
    const pending = payFromWallet({ type: 'input', input: 'a' });
    await disconnectWallet();
    finish();
    await expect(pending).resolves.toEqual({
      kind: 'failed',
      failure: {
        stage: 'prepare',
        reason: 'disconnected',
        method: 'unknown',
        amountSats: 1,
        feeSats: 0,
      },
    });
    expect(getInfo.mock.calls.length).toBe(reads);
  });

  it('fails as disconnected when the balance read rejects after the connection changed', async () => {
    const { getInfo } = await connectPaying({});
    let reject: (err: Error) => void = () => undefined;
    getInfo.mockImplementationOnce(
      () =>
        new Promise((_, fail) => {
          reject = fail;
        }),
    );
    const pending = payFromWallet({ type: 'input', input: 'a' });
    await vi.waitFor(() => {
      expect(getInfo).toHaveBeenLastCalledWith({ ensureSynced: true });
    });
    await disconnectWallet();
    reject(new Error('offline'));
    await expect(pending).resolves.toMatchObject({
      kind: 'failed',
      failure: { stage: 'prepare', reason: 'disconnected' },
    });
  });

  it('fails when the balance cannot be read before confirmation', async () => {
    const { getInfo } = await connectPaying({});
    getInfo.mockRejectedValueOnce(new Error('offline'));
    await expect(payFromWallet({ type: 'input', input: 'a' })).resolves.toEqual({
      kind: 'failed',
      failure: {
        stage: 'prepare',
        reason: 'balance_read',
        method: 'unknown',
        amountSats: 2_100,
        feeSats: 0,
        error: new Error('offline'),
      },
    });
  });

  it('does not refresh a newer connection after a send on a replaced one', async () => {
    let finishSend: () => void = () => undefined;
    await connectPaying({
      prepare: async () => ({
        amountSats: 1,
        feeSats: 0,
        send: () =>
          new Promise<void>((resolve) => {
            finishSend = resolve;
          }),
      }),
    });
    const result = await payFromWallet({ type: 'input', input: 'a' });
    if (result.kind !== 'confirm') {
      throw new Error('expected confirm');
    }
    const sending = result.send();
    const next = createFakeSdk({
      getInfo: () => new Promise(() => undefined),
    });
    void connectWallet(next.loadSdk);
    await vi.waitFor(() => {
      expect(next.connection.getInfo).toHaveBeenCalledWith({ ensureSynced: true });
    });
    finishSend();
    await expect(sending).resolves.toEqual({ kind: 'paid' });
    expect(next.connection.getInfo).toHaveBeenCalledTimes(1);
    expect(useWalletStore.getState().status).toBe('connecting');
  });

  it('maps a send rejection to failed or insufficient', async () => {
    let calls = 0;
    await connectPaying({
      prepare: async () => ({
        amountSats: 1,
        feeSats: 0,
        send: async () => {
          calls += 1;
          throw new Error(calls === 1 ? 'route not found' : 'insufficient funds');
        },
      }),
    });
    const first = await payFromWallet({ type: 'input', input: 'a' });
    const second = await payFromWallet({ type: 'input', input: 'a' });
    if (first.kind !== 'confirm' || second.kind !== 'confirm') {
      throw new Error('expected confirm');
    }
    await expect(first.send()).resolves.toMatchObject({
      kind: 'failed',
      failure: { stage: 'send', reason: 'no_route', method: 'unknown', amountSats: 1, feeSats: 0 },
    });
    await expect(second.send()).resolves.toMatchObject({
      kind: 'insufficient',
      failure: { stage: 'send', reason: 'insufficient' },
    });
  });

  it('stops waiting for a send after the time limit', async () => {
    await connectPaying({
      prepare: async () => ({
        amountSats: 1,
        feeSats: 0,
        send: () => new Promise<void>(() => undefined),
      }),
    });
    const result = await payFromWallet({ type: 'input', input: 'a' });
    if (result.kind !== 'confirm') {
      throw new Error('expected confirm');
    }
    vi.useFakeTimers();
    const pending = result.send();
    await vi.advanceTimersByTimeAsync(WALLET_SEND_TIMEOUT_MS);
    await expect(pending).resolves.toMatchObject({
      kind: 'failed',
      failure: { stage: 'send', reason: 'timeout', amountSats: 1, feeSats: 0 },
    });
  });

  it('records a send that the SDK finishes after the time limit, under the session of the send', async () => {
    let finish: (fail?: boolean) => void = () => undefined;
    await connectPaying({
      prepare: async () => ({
        amountSats: 7,
        feeSats: 1,
        send: () =>
          new Promise<void>((resolve, reject) => {
            finish = (fail) => {
              if (fail === true) {
                reject(new Error('send failed'));
              } else {
                resolve();
              }
            };
          }),
      }),
    });
    useAuthStore.setState({ session: 'sess' });
    const result = await payFromWallet({ type: 'input', input: 'a' });
    if (result.kind !== 'confirm') {
      throw new Error('expected confirm');
    }
    vi.useFakeTimers();
    const pending = result.send();
    await vi.advanceTimersByTimeAsync(WALLET_SEND_TIMEOUT_MS);
    const failed = await pending;
    if (failed.kind !== 'failed' || failed.sentLate === undefined) {
      throw new Error('expected a late send');
    }
    vi.mocked(logInteraction).mockClear();
    finish();
    await expect(failed.sentLate).resolves.toBe(true);
    expect(logInteraction).toHaveBeenCalledWith(
      'payment_sent',
      { amountSats: 7, feeSats: 1, onchain: false },
      'sess',
    );
  });

  it('reports a send that fails after the time limit as not sent late', async () => {
    let fail: () => void = () => undefined;
    await connectPaying({
      prepare: async () => ({
        amountSats: 7,
        feeSats: 1,
        send: () =>
          new Promise<void>((_resolve, reject) => {
            fail = () => {
              reject(new Error('send failed'));
            };
          }),
      }),
    });
    const result = await payFromWallet({ type: 'input', input: 'a' });
    if (result.kind !== 'confirm') {
      throw new Error('expected confirm');
    }
    vi.useFakeTimers();
    const pending = result.send();
    await vi.advanceTimersByTimeAsync(WALLET_SEND_TIMEOUT_MS);
    const failed = await pending;
    if (failed.kind !== 'failed' || failed.sentLate === undefined) {
      throw new Error('expected a late send');
    }
    vi.mocked(logInteraction).mockClear();
    fail();
    await expect(failed.sentLate).resolves.toBe(false);
    expect(logInteraction).not.toHaveBeenCalled();
  });

  it('refuses to send after the wallet was disconnected', async () => {
    const send = vi.fn(async () => undefined);
    await connectPaying({ prepare: async () => ({ amountSats: 1, feeSats: 0, send }) });
    const result = await payFromWallet({ type: 'input', input: 'a' });
    if (result.kind !== 'confirm') {
      throw new Error('expected confirm');
    }
    await disconnectWallet();
    await expect(result.send()).resolves.toEqual({
      kind: 'failed',
      failure: {
        stage: 'confirm',
        reason: 'disconnected',
        method: 'unknown',
        amountSats: 1,
        feeSats: 0,
      },
    });
    expect(send).not.toHaveBeenCalled();
  });
});

describe('payFromWallet failure details', () => {
  it.each([
    ['lnbc10u1pjexample', 'lightning'],
    ['LIGHTNING:LNTB10U1PJEXAMPLE', 'lightning'],
    ['spark1pgssexample', 'spark'],
    ['sparkrt1pgssexample', 'spark'],
    [
      'bitcoin:bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq?amount=0.001&lightning=lnbc1x',
      'lightning',
    ],
    ['bitcoin:bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq?amount=0.001', 'onchain'],
    ['bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq', 'onchain'],
    ['1BoatSLRHtKNngkdXEeobR76b53LETtpyT', 'onchain'],
    ['hello there', 'unknown'],
  ])('reads %s as %s before the SDK prepares it', async (input, method) => {
    await expect(payFromWallet({ type: 'input', input })).resolves.toMatchObject({
      kind: 'unlock',
      failure: { method },
    });
  });

  it('reads an LNURL receiver as lnurl, with the amount asked for', async () => {
    await expect(
      payFromWallet({ type: 'lnurl', request: { details: {} }, amountSats: 21 }),
    ).resolves.toMatchObject({
      kind: 'unlock',
      failure: { stage: 'prepare', reason: 'unlock', method: 'lnurl', amountSats: 21 },
    });
  });

  it.each([
    [new Error('Invoice has expired at 1700000000'), 'expired'],
    [new Error('Spark error: no route found to destination'), 'no_route'],
    [new Error('Timeout error: operation timed out'), 'timeout'],
    [new Error('Network error: connection reset'), 'network'],
    [new TypeError('Failed to fetch'), 'network'],
    [new Error('Lnurl error: callback refused'), 'lnurl_error'],
    [new Error('Generic error: something else'), 'sdk_error'],
  ])('maps the prepare rejection %s to the reason %s', async (error, reason) => {
    await connectPaying({
      prepare: async () => {
        throw error;
      },
    });
    await expect(payFromWallet({ type: 'input', input: 'lnbc10u1pjexample' })).resolves.toEqual({
      kind: 'failed',
      failure: {
        stage: 'prepare',
        reason,
        method: 'lightning',
        amountSats: null,
        feeSats: null,
        error,
      },
    });
  });

  /** Rejections that cannot be read: a throwing `message` getter, a throwing `toString`. */
  const unreadable = (): Array<[string, unknown]> => [
    [
      'an Error whose message getter throws',
      Object.defineProperty(new Error(), 'message', {
        get(): never {
          throw new Error('no message');
        },
      }),
    ],
    [
      'an object whose toString throws',
      {
        toString(): never {
          throw new Error('no text');
        },
      },
    ],
  ];

  it.each(unreadable())(
    'classifies a prepare rejecting with %s as sdk_error instead of throwing',
    async (_label, error) => {
      await connectPaying({
        prepare: async () => {
          throw error;
        },
      });
      const result = await payFromWallet({ type: 'input', input: 'lnbc10u1pjexample' });
      if (result.kind !== 'failed') {
        throw new Error('expected failed');
      }
      // Compared by identity: a deep comparison would read the throwing getter itself.
      expect(result.failure.error).toBe(error);
      expect({ ...result.failure, error: undefined }).toEqual({
        stage: 'prepare',
        reason: 'sdk_error',
        method: 'lightning',
        amountSats: null,
        feeSats: null,
        error: undefined,
      });
    },
  );

  it.each(unreadable())(
    'classifies a send rejecting with %s as sdk_error instead of throwing, also with a base-chain quote',
    async (_label, error) => {
      const fees = { fast: 3, medium: 2, slow: 1 };
      await connectPaying({
        prepare: async () => ({
          amountSats: 1,
          feeSats: 2,
          onchain: { fees, expiresAtMs: Date.now() + 600_000 },
          send: async () => {
            throw error;
          },
        }),
      });
      const result = await payFromWallet({ type: 'input', input: 'a', amountSats: 1 });
      if (result.kind !== 'confirm') {
        throw new Error('expected confirm');
      }
      const sent = await result.send();
      if (sent.kind !== 'failed') {
        throw new Error('expected failed');
      }
      expect(sent.failure.error).toBe(error);
      expect([sent.failure.stage, sent.failure.reason, sent.failure.method]).toEqual([
        'send',
        'sdk_error',
        'onchain',
      ]);
    },
  );
});

describe('payFromWallet to a base-chain address', () => {
  const FEES = { fast: 2_840, medium: 1_420, slow: 710 };
  const REQUEST = { type: 'input' as const, input: 'bc1q', amountSats: 50_000 };

  function onchainPrepared(
    send: WalletPreparedPayment['send'],
    expiresAtMs = Date.now() + 600_000,
  ): WalletConnection['prepare'] {
    return async () => ({
      amountSats: 50_000,
      feeSats: FEES.medium,
      onchain: { fees: FEES, expiresAtMs },
      send,
    });
  }

  it('returns the fee of each speed and what the balance covers, then sends with the chosen speed', async () => {
    const send = vi.fn(async () => undefined);
    await connectPaying({ balanceSats: 60_000, prepare: onchainPrepared(send) });
    const result = await payFromWallet(REQUEST);
    expect(result).toMatchObject({
      kind: 'confirm',
      amountSats: 50_000,
      feeSats: 1_420,
      onchain: { fees: FEES, spendableFeeSats: 10_000 },
    });
    if (result.kind !== 'confirm') {
      throw new Error('expected confirm');
    }
    await expect(result.send('fast')).resolves.toEqual({ kind: 'paid' });
    expect(send).toHaveBeenCalledWith('fast');
    expect(logInteraction).toHaveBeenCalledWith(
      'payment_sent',
      { amountSats: 50_000, feeSats: 2_840, onchain: true },
      null,
    );
  });

  it('sends with the medium speed when none is chosen', async () => {
    const send = vi.fn(async () => undefined);
    await connectPaying({ balanceSats: 60_000, prepare: onchainPrepared(send) });
    const result = await payFromWallet(REQUEST);
    if (result.kind !== 'confirm') {
      throw new Error('expected confirm');
    }
    await expect(result.send()).resolves.toEqual({ kind: 'paid' });
    expect(send).toHaveBeenCalledWith('medium');
  });

  it('is insufficient when the balance does not cover the amount and the lowest fee', async () => {
    await connectPaying({ balanceSats: 50_709, prepare: onchainPrepared(async () => undefined) });
    await expect(payFromWallet(REQUEST)).resolves.toEqual({
      kind: 'insufficient',
      feeSats: FEES.slow,
      failure: {
        stage: 'prepare',
        reason: 'insufficient',
        method: 'onchain',
        amountSats: 50_000,
        feeSats: FEES.slow,
        onchainFees: FEES,
      },
    });
  });

  it('refuses a speed the balance does not cover without sending, and still sends a covered one', async () => {
    const send = vi.fn(async () => undefined);
    await connectPaying({ balanceSats: 51_000, prepare: onchainPrepared(send) });
    const result = await payFromWallet(REQUEST);
    if (result.kind !== 'confirm') {
      throw new Error('expected confirm');
    }
    expect(result.onchain?.spendableFeeSats).toBe(1_000);
    await expect(result.send('fast')).resolves.toEqual({
      kind: 'insufficient',
      failure: {
        stage: 'confirm',
        reason: 'insufficient',
        method: 'onchain',
        amountSats: 50_000,
        feeSats: FEES.fast,
        onchainFees: FEES,
      },
    });
    expect(send).not.toHaveBeenCalled();
    await expect(result.send('slow')).resolves.toEqual({ kind: 'paid' });
    expect(send).toHaveBeenCalledWith('slow');
  });

  it('refuses a quote within the margin of its expiry without sending', async () => {
    const send = vi.fn(async () => undefined);
    await connectPaying({
      balanceSats: 60_000,
      prepare: onchainPrepared(send, Date.now() + WALLET_QUOTE_MARGIN_MS - 1_000),
    });
    const result = await payFromWallet(REQUEST);
    if (result.kind !== 'confirm') {
      throw new Error('expected confirm');
    }
    await expect(result.send()).resolves.toEqual({
      kind: 'expired',
      failure: {
        stage: 'confirm',
        reason: 'expired',
        method: 'onchain',
        amountSats: 50_000,
        feeSats: FEES.medium,
        onchainFees: FEES,
      },
    });
    expect(send).not.toHaveBeenCalled();
  });

  it.each([
    [new Error('Fee quote expired'), 'expired', 'expired'],
    ['quote has expired', 'expired', 'expired'],
    [
      new Error('Insufficient funds for withdrawal: amount 50000 sats, fee 1420 sats'),
      'insufficient',
      'insufficient',
    ],
    [new Error('service unavailable'), 'failed', 'sdk_error'],
    [new Error('Insufficient funds: the fee quote expired'), 'expired', 'expired'],
  ])('maps the send rejection %s to %s (%s)', async (error, kind, reason) => {
    await connectPaying({
      balanceSats: 60_000,
      prepare: onchainPrepared(async () => {
        throw error;
      }),
    });
    const result = await payFromWallet(REQUEST);
    if (result.kind !== 'confirm') {
      throw new Error('expected confirm');
    }
    await expect(result.send()).resolves.toEqual({
      kind,
      failure: {
        stage: 'send',
        reason,
        method: 'onchain',
        amountSats: 50_000,
        feeSats: FEES.medium,
        onchainFees: FEES,
        error,
      },
    });
  });

  it('does not read an expired quote into a payment without one', async () => {
    await connectPaying({
      prepare: async () => ({
        amountSats: 2_100,
        feeSats: 0,
        send: async () => {
          throw new Error('quote expired');
        },
      }),
    });
    const result = await payFromWallet({ type: 'input', input: 'spark1x' });
    if (result.kind !== 'confirm') {
      throw new Error('expected confirm');
    }
    expect(result.onchain).toBeUndefined();
    await expect(result.send()).resolves.toMatchObject({
      kind: 'failed',
      failure: { stage: 'send', reason: 'expired', method: 'spark' },
    });
  });

  it.each([
    new Error('Amount is below the minimum of 294 sats required for this address'),
    'Amount is below the minimum of 294 sats required for this address after lowest fees of 710 sats',
  ])('reads the SDK minimum from a refused amount: %s', async (error) => {
    await connectPaying({
      prepare: async () => {
        throw error;
      },
    });
    await expect(payFromWallet({ ...REQUEST, amountSats: 100 })).resolves.toEqual({
      kind: 'belowMinimum',
      minSats: 294,
      failure: {
        stage: 'prepare',
        reason: 'below_minimum',
        // `bc1q` is too short to read as an address before the SDK prepares it.
        method: 'unknown',
        amountSats: 100,
        feeSats: null,
        error,
      },
    });
  });
});

describe('parseWalletInput', () => {
  it('treats blank text as invalid', async () => {
    await expect(parseWalletInput('   ')).resolves.toEqual({ kind: 'invalid' });
  });

  it('asks to unlock without a connection', async () => {
    await expect(parseWalletInput('lnbc1')).resolves.toEqual({ kind: 'unlock' });
  });

  it('returns the parsed target for trimmed text', async () => {
    const { parse } = await connectPaying({ parse: async () => ONCHAIN_TARGET });
    await expect(parseWalletInput('  bc1q  ')).resolves.toEqual({
      kind: 'target',
      target: ONCHAIN_TARGET,
    });
    expect(parse).toHaveBeenCalledWith('bc1q');
  });

  it('reports an address or LNURL that cannot be read as unreachable, other text as invalid', async () => {
    await connectPaying({
      parse: async () => {
        throw new Error('fetch failed');
      },
    });
    await expect(parseWalletInput('bob@pay.example')).resolves.toEqual({ kind: 'unreachable' });
    await expect(parseWalletInput('lightning:LNURL1DP68GURN')).resolves.toEqual({
      kind: 'unreachable',
    });
    await expect(parseWalletInput('hello world')).resolves.toEqual({ kind: 'invalid' });
  });

  it('asks to unlock when the connection changed while the text was read', async () => {
    let settle: { resolve: (t: WalletTarget) => void; reject: (e: Error) => void } = {
      resolve: () => undefined,
      reject: () => undefined,
    };
    await connectPaying({
      parse: () =>
        new Promise((resolve, reject) => {
          settle = { resolve, reject };
        }),
    });
    const read = parseWalletInput('bc1q');
    await disconnectWallet();
    settle.resolve(ONCHAIN_TARGET);
    await expect(read).resolves.toEqual({ kind: 'unlock' });

    await connectPaying({
      parse: () =>
        new Promise((resolve, reject) => {
          settle = { resolve, reject };
        }),
    });
    const failed = parseWalletInput('bob@pay.example');
    await disconnectWallet();
    settle.reject(new Error('fetch failed'));
    await expect(failed).resolves.toEqual({ kind: 'unlock' });
  });
});

describe('onIncomingPayment', () => {
  function payment(id: string, overrides?: Partial<WalletPayment>): WalletPayment {
    return {
      id,
      direction: 'received',
      amountSats: 500,
      feesSats: 0,
      timestamp: 1,
      status: 'completed',
      method: 'lightning',
      senderComment: null,
      info: {},
      ...overrides,
    };
  }

  /** Lets the balance read behind an announcement settle. */
  async function settle(): Promise<void> {
    for (let i = 0; i < 10; i += 1) {
      await Promise.resolve();
    }
  }

  async function connected(known: WalletPayment[] = []): Promise<{
    emit: (event: { type: string; payment?: WalletPayment }) => void;
    connection: ReturnType<typeof createFakeSdk>['connection'];
  }> {
    rememberSessionPhrase(MNEMONIC);
    const { loadSdk, connection, listeners } = createFakeSdk();
    connection.listPayments.mockResolvedValueOnce(known);
    await connectWallet(loadSdk);
    await vi.waitFor(() => expect(connection.listPayments).toHaveBeenCalled());
    // Let the known-payments read settle.
    await Promise.resolve();
    await Promise.resolve();
    return {
      emit: (event) => {
        for (const listener of listeners) {
          (listener as (event: { type: string; payment?: WalletPayment }) => void)(event);
        }
      },
      connection,
    };
  }

  it('announces a received payment that completes after connect, once, and reads the balance', async () => {
    const { emit, connection } = await connected([payment('old')]);
    expect(connection.listPayments).toHaveBeenCalledWith({ offset: 0, limit: 100 });
    const seen: string[] = [];
    const unsubscribe = onIncomingPayment((p) => {
      seen.push(p.id);
    });
    const reads = connection.getInfo.mock.calls.length;
    emit({ type: 'paymentSucceeded', payment: payment('new') });
    emit({ type: 'paymentSucceeded', payment: payment('new') });
    await vi.waitFor(() => expect(seen).toEqual(['new']));
    expect(connection.getInfo.mock.calls.length).toBe(reads + 1);
    unsubscribe();
    emit({ type: 'paymentSucceeded', payment: payment('later') });
    await settle();
    expect(seen).toEqual(['new']);
  });

  it('tells the listeners only once the balance was read again, and not when the wallet closed meanwhile', async () => {
    const { emit, connection } = await connected();
    const seen: Array<[string, number | null]> = [];
    const unsubscribe = onIncomingPayment((p) => {
      seen.push([p.id, useWalletStore.getState().balanceSats]);
    });
    let answer!: () => void;
    connection.getInfo.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          answer = () => {
            resolve({ balanceSats: 21_500, identityPubkey: IDENTITY });
          };
        }),
    );
    emit({ type: 'paymentSucceeded', payment: payment('new') });
    await settle();
    expect(seen).toEqual([]);
    answer();
    await vi.waitFor(() => expect(seen).toEqual([['new', 21_500]]));
    connection.getInfo.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          answer = () => {
            resolve({ balanceSats: 22_000, identityPubkey: IDENTITY });
          };
        }),
    );
    emit({ type: 'paymentSucceeded', payment: payment('closing') });
    await settle();
    await disconnectWallet();
    answer();
    await settle();
    expect(seen).toEqual([['new', 21_500]]);
    unsubscribe();
  });

  it('tells an onPaymentReceived listener at once, before the balance read, once per payment', async () => {
    const { emit, connection } = await connected([payment('old')]);
    const now: string[] = [];
    const later: string[] = [];
    const unsubscribeNow = onPaymentReceived((p) => {
      now.push(p.id);
    });
    const unsubscribeLater = onIncomingPayment((p) => {
      later.push(p.id);
    });
    let answer!: () => void;
    connection.getInfo.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          answer = () => {
            resolve({ balanceSats: 21_500, identityPubkey: IDENTITY });
          };
        }),
    );
    // The listed payment first, as it subscribed after the list was read.
    expect(now).toEqual(['old']);
    emit({ type: 'paymentSucceeded', payment: payment('old') });
    emit({ type: 'paymentSucceeded', payment: payment('new') });
    emit({ type: 'paymentSucceeded', payment: payment('new') });
    expect(now).toEqual(['old', 'new']);
    expect(later).toEqual([]);
    answer();
    await vi.waitFor(() => expect(later).toEqual(['new']));
    unsubscribeNow();
    unsubscribeLater();
    emit({ type: 'paymentSucceeded', payment: payment('after') });
    await settle();
    expect(now).toEqual(['old', 'new']);
  });

  it('lets only a Playwright build announce a received payment for e2e', () => {
    const seen: string[] = [];
    const unsubscribe = onPaymentReceived((p) => {
      seen.push(p.id);
    });
    const before = process.env.NEXT_PUBLIC_E2E_NOW;
    try {
      delete process.env.NEXT_PUBLIC_E2E_NOW;
      announceReceivedForE2e(payment('production'));
      expect(seen).toEqual([]);
      process.env.NEXT_PUBLIC_E2E_NOW = '2026-09-20T12:00:00.000Z';
      announceReceivedForE2e(payment('playwright'));
      expect(seen).toEqual(['playwright']);
    } finally {
      if (before === undefined) {
        delete process.env.NEXT_PUBLIC_E2E_NOW;
      } else {
        process.env.NEXT_PUBLIC_E2E_NOW = before;
      }
      unsubscribe();
    }
  });

  it('tells the listeners of two payments close together only once the newest balance is in', async () => {
    const { emit, connection } = await connected();
    const seen: Array<[string, number | null]> = [];
    const unsubscribe = onIncomingPayment((p) => {
      seen.push([p.id, useWalletStore.getState().balanceSats]);
    });
    const answers: Array<(balanceSats: number) => void> = [];
    const held = (): Promise<{ balanceSats: number; identityPubkey: string }> =>
      new Promise((resolve) => {
        answers.push((balanceSats) => {
          resolve({ balanceSats, identityPubkey: IDENTITY });
        });
      });
    connection.getInfo.mockImplementationOnce(held).mockImplementationOnce(held);
    emit({ type: 'paymentSucceeded', payment: payment('first') });
    emit({ type: 'paymentSucceeded', payment: payment('second') });
    await settle();
    const [answerFirst, answerSecond] = answers;
    if (answerFirst === undefined || answerSecond === undefined) {
      throw new Error('expected two balance reads');
    }
    // The first read answers but is stale: the second one writes.
    answerFirst(21_500);
    await settle();
    expect(seen).toEqual([]);
    answerSecond(22_000);
    await vi.waitFor(() =>
      expect(seen).toEqual([
        ['first', 22_000],
        ['second', 22_000],
      ]),
    );
    unsubscribe();
  });

  it('never announces a payment the wallet held at connect, a send, a pending one, or another event', async () => {
    const { emit } = await connected([
      payment('old'),
      payment('sent-old', { direction: 'sent' }),
      payment('pending-old', { status: 'pending' }),
    ]);
    const seen: string[] = [];
    const unsubscribe = onIncomingPayment((p) => {
      seen.push(p.id);
    });
    emit({ type: 'paymentSucceeded', payment: payment('old') });
    emit({ type: 'paymentSucceeded', payment: payment('out', { direction: 'sent' }) });
    emit({ type: 'paymentSucceeded', payment: payment('wait', { status: 'pending' }) });
    emit({ type: 'paymentPending', payment: payment('pending') });
    emit({ type: 'paymentSucceeded' });
    emit({ type: 'claimedDeposits' });
    await settle();
    expect(seen).toEqual([]);
    emit({ type: 'paymentSucceeded', payment: payment('pending-old') });
    await vi.waitFor(() => expect(seen).toEqual(['pending-old']));
    unsubscribe();
  });

  it('holds a payment that completes while the known payments are read, then announces it unless known', async () => {
    rememberSessionPhrase(MNEMONIC);
    const { loadSdk, connection, listeners } = createFakeSdk();
    let resolveList!: (payments: WalletPayment[]) => void;
    connection.listPayments.mockImplementationOnce(
      () =>
        new Promise<WalletPayment[]>((resolve) => {
          resolveList = resolve;
        }),
    );
    await connectWallet(loadSdk);
    const seen: string[] = [];
    const unsubscribe = onIncomingPayment((p) => {
      seen.push(p.id);
    });
    const emit = (event: { type: string; payment?: WalletPayment }): void => {
      for (const listener of listeners) {
        (listener as (event: { type: string; payment?: WalletPayment }) => void)(event);
      }
    };
    emit({ type: 'paymentSucceeded', payment: payment('early') });
    emit({ type: 'paymentSucceeded', payment: payment('listed') });
    emit({ type: 'paymentSucceeded', payment: payment('early') });
    expect(seen).toEqual([]);
    resolveList([payment('listed')]);
    await vi.waitFor(() => expect(seen).toEqual(['early']));
    emit({ type: 'paymentSucceeded', payment: payment('after') });
    await vi.waitFor(() => expect(seen).toEqual(['early', 'after']));
    unsubscribe();
  });

  it('tells onPaymentReceived a payment reported while the known payments are read, even when listed', async () => {
    rememberSessionPhrase(MNEMONIC);
    const { loadSdk, connection, listeners } = createFakeSdk();
    let resolveList!: (payments: WalletPayment[]) => void;
    connection.listPayments.mockImplementationOnce(
      () =>
        new Promise<WalletPayment[]>((resolve) => {
          resolveList = resolve;
        }),
    );
    await connectWallet(loadSdk);
    const received: string[] = [];
    const unsubscribe = onPaymentReceived((p) => {
      received.push(p.id);
    });
    const emit = (event: { type: string; payment?: WalletPayment }): void => {
      for (const listener of listeners) {
        (listener as (event: { type: string; payment?: WalletPayment }) => void)(event);
      }
    };
    // Reported live while the list is read; the list then already holds it.
    emit({ type: 'paymentSucceeded', payment: payment('listed') });
    emit({ type: 'paymentSucceeded', payment: payment('listed') });
    resolveList([payment('listed'), payment('old')]);
    await vi.waitFor(() => expect(received).toEqual(['listed']));
    unsubscribe();
  });

  it('tells onPaymentReceived a payment reported twice while the known payments are read, once', async () => {
    rememberSessionPhrase(MNEMONIC);
    const { loadSdk, connection, listeners } = createFakeSdk();
    let resolveList!: (payments: WalletPayment[]) => void;
    connection.listPayments.mockImplementationOnce(
      () =>
        new Promise<WalletPayment[]>((resolve) => {
          resolveList = resolve;
        }),
    );
    await connectWallet(loadSdk);
    const received: string[] = [];
    const unsubscribe = onPaymentReceived((p) => {
      received.push(p.id);
    });
    for (const listener of listeners) {
      (listener as (event: { type: string; payment?: WalletPayment }) => void)({
        type: 'paymentSucceeded',
        payment: payment('new'),
      });
      (listener as (event: { type: string; payment?: WalletPayment }) => void)({
        type: 'paymentSucceeded',
        payment: payment('new'),
      });
    }
    resolveList([]);
    await vi.waitFor(() => expect(received).toEqual(['new']));
    await Promise.resolve();
    expect(received).toEqual(['new']);
    unsubscribe();
  });

  it('tells onPaymentReceived each listed payment once, oldest first, also those that completed while the wallet reconnected', async () => {
    rememberSessionPhrase(MNEMONIC);
    const { loadSdk, connection } = createFakeSdk();
    connection.listPayments.mockResolvedValueOnce([payment('old')]);
    await connectWallet(loadSdk);
    await vi.waitFor(() => expect(connection.listPayments).toHaveBeenCalledTimes(1));
    await Promise.resolve();
    const received: string[] = [];
    const incoming: string[] = [];
    const unsubscribe = onPaymentReceived((p) => {
      received.push(p.id);
    });
    const unsubscribeIncoming = onIncomingPayment((p) => {
      incoming.push(p.id);
    });
    // Newest first, as the wallet lists them.
    connection.listPayments.mockResolvedValueOnce([
      payment('newer'),
      payment('missed'),
      payment('sent', { direction: 'sent' }),
      payment('old'),
    ]);
    await connectWallet(loadSdk);
    await vi.waitFor(() => expect(received).toEqual(['old', 'missed', 'newer']));
    expect(incoming).toEqual([]);
    unsubscribe();
    unsubscribeIncoming();
  });

  it('starts onPaymentReceived over after a sign-out and hears only the wallet signed in now', async () => {
    rememberSessionPhrase(MNEMONIC);
    const { loadSdk, connection } = createFakeSdk();
    const received: string[] = [];
    const unsubscribe = onPaymentReceived((p) => {
      received.push(p.id);
    });
    const opened = async (list: () => Promise<WalletPayment[]>): Promise<void> => {
      const calls = connection.listPayments.mock.calls.length;
      connection.listPayments.mockImplementationOnce(list);
      await connectWallet(loadSdk);
      await vi.waitFor(() => expect(connection.listPayments.mock.calls.length).toBe(calls + 1));
      await Promise.resolve();
      await Promise.resolve();
    };
    await opened(async () => [payment('a')]);
    // A failed list tells nothing; the next one tells only what is new to this phrase.
    await opened(async () => {
      throw new Error('list failed');
    });
    await opened(async () => [payment('b'), payment('a')]);
    expect(received).toEqual(['a', 'b']);
    // A listener that subscribes now hears them first.
    const late: string[] = [];
    const unsubscribeLate = onPaymentReceived((p) => {
      late.push(p.id);
    });
    expect(late).toEqual(['a', 'b']);
    unsubscribeLate();
    // Another wallet signed in: a new listener hears none of the first one's payments.
    rememberSessionPhrase(`${MNEMONIC} other`);
    const other: string[] = [];
    const unsubscribeOther = onPaymentReceived((p) => {
      other.push(p.id);
    });
    expect(other).toEqual([]);
    unsubscribeOther();
    // Signed out and in again: it starts over.
    await disconnectWallet();
    rememberSessionPhrase(MNEMONIC);
    await opened(async () => [payment('a')]);
    expect(received).toEqual(['a', 'b', 'a']);
    unsubscribe();
  });

  it('keeps payments a sign-in told while the previous sign-out was still closing', async () => {
    rememberSessionPhrase(MNEMONIC);
    let releaseDisconnect!: () => void;
    const hanging = {
      getInfo: vi.fn(async () => ({ balanceSats: 21_000, identityPubkey: IDENTITY })),
      addEventListener: vi.fn(async () => 'hang'),
      listPayments: vi.fn(async () => [] as WalletPayment[]),
      disconnect: vi.fn(
        () =>
          new Promise<void>((resolve) => {
            releaseDisconnect = resolve;
          }),
      ),
    };
    const next = {
      getInfo: vi.fn(async () => ({ balanceSats: 21_000, identityPubkey: IDENTITY })),
      addEventListener: vi.fn(async () => 'next'),
      listPayments: vi.fn(async () => [payment('kept')]),
      disconnect: vi.fn(async () => undefined),
    };
    const connect = vi
      .fn()
      .mockResolvedValueOnce(hanging as unknown as WalletConnection)
      .mockResolvedValueOnce(next as unknown as WalletConnection);
    const loadSdk: WalletSdkLoader = async () => sdkOf(connect);
    await connectWallet(loadSdk);
    await vi.waitFor(() => expect(hanging.listPayments).toHaveBeenCalled());
    await Promise.resolve();

    const signingOut = disconnectWallet();
    await vi.waitFor(() => expect(hanging.disconnect).toHaveBeenCalled());

    await connectWallet(loadSdk);
    await vi.waitFor(() => expect(next.listPayments).toHaveBeenCalled());
    for (let i = 0; i < 10; i += 1) {
      await Promise.resolve();
    }

    // The sign-in has already told the payment. A listener hears it from the buffer.
    const during: string[] = [];
    const unsubscribeDuring = onPaymentReceived((heard) => {
      during.push(heard.id);
    });
    expect(during).toEqual(['kept']);
    unsubscribeDuring();

    releaseDisconnect();
    await signingOut;

    // The late sign-out must not wipe what that sign-in told.
    const late: string[] = [];
    const unsubscribe = onPaymentReceived((heard) => {
      late.push(heard.id);
    });
    expect(late).toEqual(['kept']);
    unsubscribe();
  });

  it('still tells onPaymentReceived, once each, the payments held while the known-payments read failed', async () => {
    rememberSessionPhrase(MNEMONIC);
    const { loadSdk, connection, listeners } = createFakeSdk();
    let rejectList!: (error: Error) => void;
    connection.listPayments.mockImplementationOnce(
      () =>
        new Promise<WalletPayment[]>((_resolve, reject) => {
          rejectList = reject;
        }),
    );
    await connectWallet(loadSdk);
    const received: string[] = [];
    const unsubscribe = onPaymentReceived((p) => {
      received.push(p.id);
    });
    for (const id of ['live', 'live', 'other']) {
      for (const listener of listeners) {
        (listener as (event: { type: string; payment?: WalletPayment }) => void)({
          type: 'paymentSucceeded',
          payment: payment(id),
        });
      }
    }
    rejectList(new Error('list failed'));
    await vi.waitFor(() => expect(received).toEqual(['live', 'other']));
    unsubscribe();
  });

  it('tells onPaymentReceived a payment once, also when a failed read told it and a later reconnect lists it', async () => {
    rememberSessionPhrase(MNEMONIC);
    const { loadSdk, connection, listeners } = createFakeSdk();
    connection.listPayments.mockResolvedValueOnce([payment('old')]);
    await connectWallet(loadSdk);
    await vi.waitFor(() => expect(connection.listPayments).toHaveBeenCalledTimes(1));
    await Promise.resolve();
    const received: string[] = [];
    const unsubscribe = onPaymentReceived((p) => {
      received.push(p.id);
    });
    let rejectList!: (error: Error) => void;
    connection.listPayments.mockImplementationOnce(
      () =>
        new Promise<WalletPayment[]>((_resolve, reject) => {
          rejectList = reject;
        }),
    );
    await connectWallet(loadSdk);
    for (const listener of listeners) {
      (listener as (event: { type: string; payment?: WalletPayment }) => void)({
        type: 'paymentSucceeded',
        payment: payment('paid'),
      });
    }
    rejectList(new Error('list failed'));
    await vi.waitFor(() => expect(received).toEqual(['old', 'paid']));
    // The next connection lists it, and the last list that was read did not.
    connection.listPayments.mockResolvedValueOnce([payment('paid'), payment('old')]);
    await connectWallet(loadSdk);
    await vi.waitFor(() => expect(connection.listPayments).toHaveBeenCalledTimes(3));
    await Promise.resolve();
    await Promise.resolve();
    // 'old' from the first list, as the listener subscribed after it; 'paid' once.
    expect(received).toEqual(['old', 'paid']);
    unsubscribe();
  });

  it('tells onPaymentReceived at once a payment reported before the known payments are read, once across a replaced connection', async () => {
    rememberSessionPhrase(MNEMONIC);
    const { loadSdk, connection, listeners } = createFakeSdk();
    connection.listPayments.mockImplementationOnce(
      () => new Promise<WalletPayment[]>(() => undefined),
    );
    await connectWallet(loadSdk);
    const received: string[] = [];
    const unsubscribe = onPaymentReceived((p) => {
      received.push(p.id);
    });
    for (const listener of [...listeners]) {
      (listener as (event: { type: string; payment?: WalletPayment }) => void)({
        type: 'paymentSucceeded',
        payment: payment('first-sync'),
      });
    }
    // Before the known payments are read.
    expect(received).toEqual(['first-sync']);
    connection.listPayments.mockResolvedValueOnce([payment('first-sync')]);
    await connectWallet(loadSdk);
    await vi.waitFor(() => expect(connection.listPayments).toHaveBeenCalledTimes(2));
    await Promise.resolve();
    expect(received).toEqual(['first-sync']);
    unsubscribe();
  });

  it('drops the payments held meanwhile when the known-payments read fails', async () => {
    rememberSessionPhrase(MNEMONIC);
    const { loadSdk, connection, listeners } = createFakeSdk();
    let rejectList!: (error: Error) => void;
    connection.listPayments.mockImplementationOnce(
      () =>
        new Promise<WalletPayment[]>((_resolve, reject) => {
          rejectList = reject;
        }),
    );
    await connectWallet(loadSdk);
    const seen: string[] = [];
    const unsubscribe = onIncomingPayment((p) => {
      seen.push(p.id);
    });
    const emit = (event: { type: string; payment?: WalletPayment }): void => {
      for (const listener of listeners) {
        (listener as (event: { type: string; payment?: WalletPayment }) => void)(event);
      }
    };
    emit({ type: 'paymentSucceeded', payment: payment('old-on-sync') });
    rejectList(new Error('list failed'));
    await vi.waitFor(() => {
      emit({ type: 'paymentSucceeded', payment: payment('after') });
      expect(seen).toEqual(['after']);
    });
    unsubscribe();
  });

  it('counts none as known when the read fails', async () => {
    rememberSessionPhrase(MNEMONIC);
    const { loadSdk, connection, listeners } = createFakeSdk();
    connection.listPayments.mockRejectedValueOnce(new Error('list failed'));
    await connectWallet(loadSdk);
    const seen: string[] = [];
    const unsubscribe = onIncomingPayment((p) => {
      seen.push(p.id);
    });
    const emit = (event: { type: string; payment?: WalletPayment }): void => {
      for (const listener of listeners) {
        (listener as (event: { type: string; payment?: WalletPayment }) => void)(event);
      }
    };
    await vi.waitFor(() => {
      emit({ type: 'paymentSucceeded', payment: payment('fresh') });
      expect(seen).toEqual(['fresh']);
    });
    unsubscribe();
  });

  it('ignores a known-payments read of a dropped connection that settles after the new one', async () => {
    rememberSessionPhrase(MNEMONIC);
    const first = createFakeSdk();
    let resolveStale!: (payments: WalletPayment[]) => void;
    first.connection.listPayments.mockImplementationOnce(
      () =>
        new Promise<WalletPayment[]>((resolve) => {
          resolveStale = resolve;
        }),
    );
    await connectWallet(first.loadSdk);
    await disconnectWallet();
    rememberSessionPhrase(MNEMONIC);
    const second = createFakeSdk();
    second.connection.listPayments.mockResolvedValueOnce([]);
    await connectWallet(second.loadSdk);
    await vi.waitFor(() => expect(second.connection.listPayments).toHaveBeenCalled());
    await Promise.resolve();
    await Promise.resolve();
    // The old read answers last and names the payment that is about to arrive on the new one.
    resolveStale([payment('fresh')]);
    await Promise.resolve();
    await Promise.resolve();
    const seen: string[] = [];
    const unsubscribe = onIncomingPayment((p) => {
      seen.push(p.id);
    });
    for (const listener of second.listeners) {
      (listener as (event: { type: string; payment?: WalletPayment }) => void)({
        type: 'paymentSucceeded',
        payment: payment('fresh'),
      });
    }
    await vi.waitFor(() => expect(seen).toEqual(['fresh']));
    unsubscribe();
  });
});

describe('wallet trace spans', () => {
  /**
   * Span names and attributes recorded since the last clear.
   *
   * @returns `[name, attributes]` per span, in start order.
   */
  function spans(): Array<[string, unknown]> {
    return vi.mocked(traceWallet).mock.calls.map(([name, , attributes]) => [name, attributes]);
  }

  beforeEach(() => {
    vi.mocked(traceWallet).mockClear();
  });

  it('times the SDK load, the connect, and the first synced read of a start', async () => {
    rememberSessionPhrase(MNEMONIC);
    const { loadSdk, connection } = createFakeSdk();
    await connectWallet(loadSdk);
    expect(spans()).toEqual([
      ['wallet.sdk.load', undefined],
      ['wallet.connect', undefined],
      ['wallet.sync.first', undefined],
    ]);
    expect(connection.getInfo).toHaveBeenCalledWith({ ensureSynced: true });
  });

  it('times a balance read and an address registration', async () => {
    rememberSessionPhrase(MNEMONIC);
    const { loadSdk, connection } = createFakeSdk();
    await connectWallet(loadSdk);
    vi.mocked(traceWallet).mockClear();
    await refreshWallet();
    await registerWalletAddress('ada');
    expect(spans()).toEqual([
      ['wallet.balance', undefined],
      ['wallet.address.register', undefined],
    ]);
    expect(connection.registerAddress).toHaveBeenCalledWith('ada');
  });

  it.each([
    ['a Spark invoice', { type: 'input' as const, input: 'spark1qqqq' }, 'spark', 'spark'],
    ['a Spark address', { type: 'input' as const, input: 'sp1pqqqq' }, 'spark', 'spark'],
    [
      'a Lightning request',
      { type: 'input' as const, input: 'lnbc1qqqq' },
      'lightning',
      'lightning',
    ],
    [
      'a lightning: link',
      { type: 'input' as const, input: 'LIGHTNING:LNBC1QQQQ' },
      'lightning',
      'lightning',
    ],
    [
      'an LNURL receiver',
      { type: 'lnurl' as const, request: { details: {} }, amountSats: 2_100 },
      'lightning',
      'lightning',
    ],
    [
      'a URI that offers a Lightning request',
      { type: 'input' as const, input: 'bitcoin:bc1q?lightning=lnbc1' },
      'lightning',
      'lightning',
    ],
    [
      'a base-chain URI the SDK pays without a base-chain quote',
      { type: 'input' as const, input: 'bitcoin:bc1q' },
      'onchain',
      'lightning',
    ],
  ])(
    'times prepare and send of %s with its route only',
    async (_label, request, prepareRoute, sendRoute) => {
      await connectPaying({});
      vi.mocked(traceWallet).mockClear();
      const result = await payFromWallet(request);
      if (result.kind !== 'confirm') {
        throw new Error('expected confirm');
      }
      await result.send();
      expect(spans().filter(([name]) => name !== 'wallet.balance')).toEqual([
        ['wallet.prepare', { route: prepareRoute }],
        ['wallet.send', { route: sendRoute }],
      ]);
    },
  );

  it('marks a send to a base-chain address as onchain', async () => {
    const quote = { fees: { fast: 3, medium: 2, slow: 1 }, expiresAtMs: Date.now() + 600_000 };
    await connectPaying({
      prepare: async () => ({
        amountSats: 1_000,
        feeSats: 2,
        onchain: quote,
        send: async () => undefined,
      }),
    });
    vi.mocked(traceWallet).mockClear();
    const result = await payFromWallet({ type: 'input', input: 'bc1q', amountSats: 1_000 });
    if (result.kind !== 'confirm') {
      throw new Error('expected confirm');
    }
    await result.send('slow');
    expect(spans().filter(([name]) => name !== 'wallet.balance')).toEqual([
      ['wallet.prepare', { route: 'onchain' }],
      ['wallet.send', { route: 'onchain' }],
    ]);
  });
});
