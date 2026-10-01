import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearSessionPhrase, peekSessionPhrase, rememberSessionPhrase } from '@/lib/tab-phrase';
import {
  connectWallet,
  disconnectWallet,
  ensureWalletConnected,
  listenForWalletPhrase,
  listWalletPayments,
  parseWalletInput,
  payFromWallet,
  refreshWallet,
  registerWalletAddress,
  WALLET_SEND_TIMEOUT_MS,
  type WalletSdkLoader,
} from '@/lib/wallet/wallet-service';
import type { WalletConnection, WalletSdk } from '@/lib/wallet/wallet-sdk';
import { useAuthStore } from '@/stores/auth-store';
import { useWalletStore } from '@/stores/wallet-store';

const MNEMONIC =
  'abandon ability able about above absent absorb abstract absurd abuse access accident';
const API_KEY = 'test-breez-api-key';
const IDENTITY = `02${'a'.repeat(64)}`;

const ssrImport = vi.hoisted(() =>
  vi.fn(async () => {
    throw new Error('real SDK must not load');
  }),
);

vi.mock('@breeztech/breez-sdk-spark/ssr', () => ({
  default: () => ssrImport(),
}));

const ORIGINAL_BREEZ = process.env.NEXT_PUBLIC_BREEZ_API_KEY;

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
    disconnect: vi.fn(overrides?.disconnect ?? (async () => undefined)),
  };
  const connect = vi.fn(
    overrides?.connect ?? (async () => connection as unknown as WalletConnection),
  );
  const loadSdk: WalletSdkLoader = vi.fn(async () => ({
    connect: connect as WalletSdk['connect'],
  }));
  return { loadSdk, connection, connect, listeners };
}

beforeEach(() => {
  process.env.NEXT_PUBLIC_BREEZ_API_KEY = API_KEY;
  clearSessionPhrase();
  useWalletStore.getState().reset();
  useAuthStore.setState({ session: null, account: null, wrongAccount: false });
  ssrImport.mockClear();
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

    it('sets error when loadSdk never settles', async () => {
      rememberSessionPhrase(MNEMONIC);
      const loadSdk: WalletSdkLoader = vi.fn(() => new Promise<WalletSdk>(() => undefined));
      const pending = connectWallet(loadSdk);
      await vi.advanceTimersByTimeAsync(0);
      expect(loadSdk).toHaveBeenCalled();
      expect(useWalletStore.getState().status).toBe('connecting');
      await vi.advanceTimersByTimeAsync(30_000);
      await expect(pending).resolves.toBeUndefined();
      expect(useWalletStore.getState().status).toBe('error');
    });

    it('starts the deadline without waiting for the previous disconnect', async () => {
      rememberSessionPhrase(MNEMONIC);
      const first = createFakeSdk({
        disconnect: () => new Promise<never>(() => undefined),
      });
      await connectWallet(first.loadSdk);
      expect(useWalletStore.getState().status).toBe('ready');
      const secondLoadSdk: WalletSdkLoader = vi.fn(() => new Promise<WalletSdk>(() => undefined));
      const pending = connectWallet(secondLoadSdk);
      await vi.advanceTimersByTimeAsync(0);
      expect(secondLoadSdk).toHaveBeenCalled();
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
    const loadSdk: WalletSdkLoader = async () => ({ connect: connect as WalletSdk['connect'] });
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
    const loadSdk: WalletSdkLoader = async () => ({ connect: connect as WalletSdk['connect'] });
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
    const loadSdk: WalletSdkLoader = async () => ({ connect: connect as WalletSdk['connect'] });
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
    releaseLoad({ connect: connect as WalletSdk['connect'] });
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
    const loadSdk: WalletSdkLoader = async () => ({
      connect: connect as WalletSdk['connect'],
    });
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
    const loadSdk: WalletSdkLoader = async () => ({
      connect: vi.fn(async () => connection as unknown as WalletConnection),
    });
    const pending = connectWallet(loadSdk);
    await vi.waitFor(() => expect(connection.addEventListener).toHaveBeenCalled());
    await disconnectWallet();
    releaseListener();
    await expect(pending).resolves.toBeUndefined();
    expect(connection.getInfo).not.toHaveBeenCalled();
    expect(useWalletStore.getState().status).toBe('locked');
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
    expect(ssrImport).not.toHaveBeenCalled();
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
    connection.listPayments.mockResolvedValueOnce([row]);
    await connectWallet(loadSdk);
    await expect(listWalletPayments({ offset: 20, limit: 20 })).resolves.toEqual([row]);
    expect(connection.listPayments).toHaveBeenCalledWith({ offset: 20, limit: 20 });
  });
});

/**
 * Connects a fake wallet whose connection also parses and prepares payments.
 */
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
    });
  });

  it('returns amount and fee, then pays once and refreshes the balance', async () => {
    const send = vi.fn(async () => undefined);
    const { getInfo, prepare } = await connectPaying({
      prepare: async () => ({ amountSats: 2_100, feeSats: 0, send }),
    });
    const result = await payFromWallet({ type: 'input', input: 'spark1x' });
    expect(prepare).toHaveBeenCalledWith({ type: 'input', input: 'spark1x' });
    expect(result).toMatchObject({ kind: 'confirm', amountSats: 2_100, feeSats: 0 });
    if (result.kind !== 'confirm') {
      throw new Error('expected confirm');
    }
    const readsBefore = getInfo.mock.calls.length;
    await expect(result.send()).resolves.toEqual({ kind: 'paid' });
    await vi.waitFor(() => {
      expect(getInfo.mock.calls.length).toBeGreaterThan(readsBefore);
    });
    expect(send).toHaveBeenCalledTimes(1);
    await expect(result.send()).resolves.toEqual({ kind: 'failed' });
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('reports insufficient balance when amount and fee exceed it', async () => {
    await connectPaying({
      balanceSats: 2_100,
      prepare: async () => ({ amountSats: 2_100, feeSats: 1, send: async () => undefined }),
    });
    await expect(payFromWallet({ type: 'input', input: 'spark1x' })).resolves.toEqual({
      kind: 'insufficient',
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
    await expect(payFromWallet({ type: 'input', input: 'a' })).resolves.toEqual({ kind: 'failed' });
    await expect(payFromWallet({ type: 'input', input: 'a' })).resolves.toEqual({
      kind: 'insufficient',
    });
    await expect(payFromWallet({ type: 'input', input: 'a' })).resolves.toEqual({
      kind: 'insufficient',
    });
  });

  it('fails when the balance cannot be read before confirmation', async () => {
    const { getInfo } = await connectPaying({});
    getInfo.mockRejectedValueOnce(new Error('offline'));
    await expect(payFromWallet({ type: 'input', input: 'a' })).resolves.toEqual({ kind: 'failed' });
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
    await expect(first.send()).resolves.toEqual({ kind: 'failed' });
    await expect(second.send()).resolves.toEqual({ kind: 'insufficient' });
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
    await expect(pending).resolves.toEqual({ kind: 'failed' });
  });

  it('refuses to send after the wallet was disconnected', async () => {
    const send = vi.fn(async () => undefined);
    await connectPaying({ prepare: async () => ({ amountSats: 1, feeSats: 0, send }) });
    const result = await payFromWallet({ type: 'input', input: 'a' });
    if (result.kind !== 'confirm') {
      throw new Error('expected confirm');
    }
    await disconnectWallet();
    await expect(result.send()).resolves.toEqual({ kind: 'failed' });
    expect(send).not.toHaveBeenCalled();
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
    const { parse } = await connectPaying({ parse: async () => ({ type: 'onchain' }) });
    await expect(parseWalletInput('  bc1q  ')).resolves.toEqual({
      kind: 'target',
      target: { type: 'onchain' },
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
});
