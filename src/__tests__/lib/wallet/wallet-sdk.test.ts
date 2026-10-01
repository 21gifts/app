import { beforeEach, describe, expect, it, vi } from 'vitest';
import { loadWalletSdk, toWalletPayment } from '@/lib/wallet/wallet-sdk';

const MNEMONIC =
  'abandon ability able about above absent absorb abstract absurd abuse access accident';
const API_KEY = 'test-breez-api-key';
const IDENTITY = `02${'a'.repeat(64)}`;
const HOST = '21.gifts';

const mocks = vi.hoisted(() => {
  const callOrder: string[] = [];
  return {
    callOrder,
    getInfo: vi.fn(),
    addEventListener: vi.fn(),
    registerLightningAddress: vi.fn(),
    listPayments: vi.fn(),
    checkLightningAddressAvailable: vi.fn(),
    disconnect: vi.fn(),
    connect: vi.fn(),
    defaultConfig: vi.fn(),
    init: vi.fn(),
  };
});

vi.mock('@breeztech/breez-sdk-spark/ssr', () => ({
  default: async () => {
    mocks.callOrder.push('init');
    return mocks.init();
  },
  defaultConfig: (...args: unknown[]) => {
    mocks.callOrder.push('defaultConfig');
    return mocks.defaultConfig(...args);
  },
  connect: (...args: unknown[]) => {
    mocks.callOrder.push('connect');
    return mocks.connect(...args);
  },
}));

beforeEach(() => {
  mocks.callOrder.length = 0;
  mocks.init.mockReset().mockResolvedValue(undefined);
  mocks.defaultConfig.mockReset().mockReturnValue({
    network: 'mainnet',
    lnurlDomain: 'lnurl.example',
    syncIntervalSecs: 30,
  });
  mocks.getInfo.mockReset().mockResolvedValue({
    balanceSats: 21_000,
    identityPubkey: IDENTITY,
    tokenBalances: new Map(),
  });
  mocks.addEventListener.mockReset().mockResolvedValue('listener-1');
  mocks.disconnect.mockReset().mockResolvedValue(undefined);
  mocks.registerLightningAddress.mockReset().mockResolvedValue({
    username: 'ada',
    lightningAddress: 'ada@21.gifts',
  });
  mocks.listPayments.mockReset().mockResolvedValue({ payments: [] });
  mocks.checkLightningAddressAvailable.mockReset().mockResolvedValue(true);
  mocks.connect.mockReset().mockResolvedValue({
    getInfo: mocks.getInfo,
    addEventListener: mocks.addEventListener,
    registerLightningAddress: mocks.registerLightningAddress,
    listPayments: mocks.listPayments,
    checkLightningAddressAvailable: mocks.checkLightningAddressAvailable,
    disconnect: mocks.disconnect,
  });
});

describe('loadWalletSdk', () => {
  it('initializes before defaultConfig and connect', async () => {
    const sdk = await loadWalletSdk();
    expect(mocks.callOrder).toEqual(['init']);
    await sdk.connect(MNEMONIC, API_KEY, HOST);
    expect(mocks.callOrder).toEqual(['init', 'defaultConfig', 'connect']);
    expect(mocks.defaultConfig).toHaveBeenCalledWith('mainnet');
  });

  it('connects with apiKey, mnemonic seed, storage dir, and the app host as lnurlDomain', async () => {
    const sdk = await loadWalletSdk();
    await sdk.connect(MNEMONIC, API_KEY, HOST);
    expect(mocks.connect).toHaveBeenCalledTimes(1);
    const request = mocks.connect.mock.calls[0]?.[0] as {
      config: { apiKey?: string; network: string; lnurlDomain?: string };
      seed: { type: string; mnemonic: string };
      storageDir: string;
    };
    expect(request.config.apiKey).toBe(API_KEY);
    expect(request.config.network).toBe('mainnet');
    expect(request.config.lnurlDomain).toBe(HOST);
    expect(request.seed).toEqual({ type: 'mnemonic', mnemonic: MNEMONIC });
    expect(request.storageDir).toBe('21gifts-wallet');
  });

  it('getInfo maps balance and identity and drops other fields', async () => {
    const sdk = await loadWalletSdk();
    const connection = await sdk.connect(MNEMONIC, API_KEY, HOST);
    await expect(connection.getInfo()).resolves.toEqual({
      balanceSats: 21_000,
      identityPubkey: IDENTITY,
    });
    expect(mocks.getInfo).toHaveBeenCalledWith({});
  });

  it('getInfo forwards ensureSynced only when requested', async () => {
    const sdk = await loadWalletSdk();
    const connection = await sdk.connect(MNEMONIC, API_KEY, HOST);
    await connection.getInfo({ ensureSynced: true });
    await connection.getInfo({ ensureSynced: false });
    expect(mocks.getInfo.mock.calls).toEqual([[{ ensureSynced: true }], [{}]]);
  });

  it('addEventListener forwards events and returns the SDK id', async () => {
    let forwarded: ((event: { type: string }) => void) | undefined;
    mocks.addEventListener.mockImplementation(
      async (listener: { onEvent: (e: { type: string }) => void }) => {
        forwarded = listener.onEvent;
        return 'listener-1';
      },
    );
    const sdk = await loadWalletSdk();
    const connection = await sdk.connect(MNEMONIC, API_KEY, HOST);
    const seen: string[] = [];
    const id = await connection.addEventListener((event) => {
      seen.push(event.type);
    });
    expect(id).toBe('listener-1');
    forwarded?.({ type: 'synced' });
    expect(seen).toEqual(['synced']);
  });

  it('registerAddress registers only the given username and never checks availability', async () => {
    const sdk = await loadWalletSdk();
    const connection = await sdk.connect(MNEMONIC, API_KEY, HOST);
    await expect(connection.registerAddress('ada')).resolves.toBeUndefined();
    expect(mocks.registerLightningAddress).toHaveBeenCalledWith({ username: 'ada' });
    expect(mocks.checkLightningAddressAvailable).not.toHaveBeenCalled();
  });

  it('registerAddress propagates an SDK rejection', async () => {
    mocks.registerLightningAddress.mockRejectedValueOnce(new Error('taken'));
    const sdk = await loadWalletSdk();
    const connection = await sdk.connect(MNEMONIC, API_KEY, HOST);
    await expect(connection.registerAddress('ada')).rejects.toThrow('taken');
  });

  it('listPayments asks newest first with the page and maps each payment', async () => {
    mocks.listPayments.mockResolvedValueOnce({
      payments: [
        {
          id: 'p1',
          paymentType: 'receive',
          status: 'completed',
          amount: 21_000n,
          fees: 0n,
          timestamp: 1_700_000_000,
          method: 'lightning',
          details: { type: 'lightning', lnurlReceiveMetadata: { senderComment: 'Thanks' } },
        },
      ],
    });
    const sdk = await loadWalletSdk();
    const connection = await sdk.connect(MNEMONIC, API_KEY, HOST);
    await expect(connection.listPayments({ offset: 20, limit: 20 })).resolves.toEqual([
      {
        id: 'p1',
        direction: 'received',
        amountSats: 21_000,
        timestamp: 1_700_000_000_000,
        status: 'completed',
        senderComment: 'Thanks',
      },
    ]);
    expect(mocks.listPayments).toHaveBeenCalledWith({
      offset: 20,
      limit: 20,
      sortAscending: false,
    });
  });

  it('disconnect forwards to the handle', async () => {
    const sdk = await loadWalletSdk();
    const connection = await sdk.connect(MNEMONIC, API_KEY, HOST);
    await connection.disconnect();
    expect(mocks.disconnect).toHaveBeenCalledTimes(1);
  });
});

describe('walletNeedsReload', () => {
  it('is false initially', async () => {
    vi.resetModules();
    const { walletNeedsReload } = await import('@/lib/wallet/wallet-sdk');
    expect(walletNeedsReload()).toBe(false);
  });

  it('stays false after a successful load', async () => {
    vi.resetModules();
    mocks.init.mockResolvedValue(undefined);
    const { loadWalletSdk: load, walletNeedsReload } = await import('@/lib/wallet/wallet-sdk');
    await load();
    expect(walletNeedsReload()).toBe(false);
  });

  it('is true after init rejects', async () => {
    vi.resetModules();
    mocks.init.mockRejectedValueOnce(new Error('init failed'));
    const { loadWalletSdk: load, walletNeedsReload } = await import('@/lib/wallet/wallet-sdk');
    expect(walletNeedsReload()).toBe(false);
    await expect(load()).rejects.toThrow('init failed');
    expect(walletNeedsReload()).toBe(true);
  });

  it('is true while init is pending and false once it resolves', async () => {
    vi.resetModules();
    let finishInit: () => void = () => undefined;
    mocks.init.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        finishInit = resolve;
      }),
    );
    const { loadWalletSdk: load, walletNeedsReload } = await import('@/lib/wallet/wallet-sdk');
    const loading = load();
    await vi.waitFor(() => {
      expect(mocks.callOrder).toContain('init');
    });
    expect(walletNeedsReload()).toBe(true);
    finishInit();
    await loading;
    expect(walletNeedsReload()).toBe(false);
  });

  it('stays false when the package import rejects', async () => {
    vi.resetModules();
    vi.doMock('@breeztech/breez-sdk-spark/ssr', () => {
      throw new Error('import failed');
    });
    try {
      const { loadWalletSdk: load, walletNeedsReload } = await import('@/lib/wallet/wallet-sdk');
      await expect(load()).rejects.toThrow();
      expect(walletNeedsReload()).toBe(false);
    } finally {
      vi.doUnmock('@breeztech/breez-sdk-spark/ssr');
      vi.resetModules();
    }
  });
});

describe('toWalletPayment', () => {
  const base = {
    id: 'p',
    paymentType: 'send',
    status: 'completed',
    amount: 5_000n,
    timestamp: 1_700_000_000,
  };

  it('maps a sent payment without details', () => {
    expect(toWalletPayment(base)).toEqual({
      id: 'p',
      direction: 'sent',
      amountSats: 5_000,
      timestamp: 1_700_000_000_000,
      status: 'completed',
      senderComment: null,
    });
  });

  it('maps a numeric amount and keeps pending and failed', () => {
    expect(toWalletPayment({ ...base, amount: 7, status: 'pending' })).toMatchObject({
      amountSats: 7,
      status: 'pending',
    });
    expect(toWalletPayment({ ...base, status: 'failed' }).status).toBe('failed');
  });

  it('treats an unknown status as completed and an unknown type as received', () => {
    expect(toWalletPayment({ ...base, paymentType: 'receive', status: 'other' })).toMatchObject({
      direction: 'received',
      status: 'completed',
    });
  });

  it('reads the sender comment only from a lightning payment and trims it', () => {
    expect(
      toWalletPayment({
        ...base,
        paymentType: 'receive',
        details: { type: 'lightning', lnurlReceiveMetadata: { senderComment: '  hi  ' } },
      }).senderComment,
    ).toBe('hi');
    expect(
      toWalletPayment({
        ...base,
        details: { type: 'lightning', lnurlReceiveMetadata: { senderComment: '   ' } },
      }).senderComment,
    ).toBeNull();
    expect(toWalletPayment({ ...base, details: { type: 'lightning' } }).senderComment).toBeNull();
    expect(
      toWalletPayment({
        ...base,
        details: { type: 'spark', lnurlReceiveMetadata: { senderComment: 'x' } },
      }).senderComment,
    ).toBeNull();
  });
});
