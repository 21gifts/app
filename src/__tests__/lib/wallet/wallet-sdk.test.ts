import { beforeEach, describe, expect, it, vi } from 'vitest';
import { loadWalletSdk } from '@/lib/wallet/wallet-sdk';

const MNEMONIC =
  'abandon ability able about above absent absorb abstract absurd abuse access accident';
const API_KEY = 'test-breez-api-key';
const IDENTITY = `02${'a'.repeat(64)}`;

const mocks = vi.hoisted(() => {
  const callOrder: string[] = [];
  return {
    callOrder,
    getInfo: vi.fn(),
    addEventListener: vi.fn(),
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
  mocks.connect.mockReset().mockResolvedValue({
    getInfo: mocks.getInfo,
    addEventListener: mocks.addEventListener,
    disconnect: mocks.disconnect,
  });
});

describe('loadWalletSdk', () => {
  it('initializes before defaultConfig and connect', async () => {
    const sdk = await loadWalletSdk();
    expect(mocks.callOrder).toEqual(['init']);
    await sdk.connect(MNEMONIC, API_KEY);
    expect(mocks.callOrder).toEqual(['init', 'defaultConfig', 'connect']);
    expect(mocks.defaultConfig).toHaveBeenCalledWith('mainnet');
  });

  it('connects with apiKey, mnemonic seed, storage dir, and no lnurlDomain', async () => {
    const sdk = await loadWalletSdk();
    await sdk.connect(MNEMONIC, API_KEY);
    expect(mocks.connect).toHaveBeenCalledTimes(1);
    const request = mocks.connect.mock.calls[0]?.[0] as {
      config: { apiKey?: string; network: string; lnurlDomain?: string };
      seed: { type: string; mnemonic: string };
      storageDir: string;
    };
    expect(request.config.apiKey).toBe(API_KEY);
    expect(request.config.network).toBe('mainnet');
    expect(Object.prototype.hasOwnProperty.call(request.config, 'lnurlDomain')).toBe(false);
    expect(request.seed).toEqual({ type: 'mnemonic', mnemonic: MNEMONIC });
    expect(request.storageDir).toBe('21gifts-wallet');
  });

  it('getInfo maps balance and identity and drops other fields', async () => {
    const sdk = await loadWalletSdk();
    const connection = await sdk.connect(MNEMONIC, API_KEY);
    await expect(connection.getInfo()).resolves.toEqual({
      balanceSats: 21_000,
      identityPubkey: IDENTITY,
    });
    expect(mocks.getInfo).toHaveBeenCalledWith({});
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
    const connection = await sdk.connect(MNEMONIC, API_KEY);
    const seen: string[] = [];
    const id = await connection.addEventListener((event) => {
      seen.push(event.type);
    });
    expect(id).toBe('listener-1');
    forwarded?.({ type: 'synced' });
    expect(seen).toEqual(['synced']);
  });

  it('disconnect forwards to the handle', async () => {
    const sdk = await loadWalletSdk();
    const connection = await sdk.connect(MNEMONIC, API_KEY);
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
