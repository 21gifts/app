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
      assetFilter: { type: 'bitcoin' },
    });
  });

  it('disconnect forwards to the handle', async () => {
    const sdk = await loadWalletSdk();
    const connection = await sdk.connect(MNEMONIC, API_KEY, HOST);
    await connection.disconnect();
    expect(mocks.disconnect).toHaveBeenCalledTimes(1);
  });
});

describe('payments', () => {
  const sdkPay = {
    parse: vi.fn(),
    prepareSendPayment: vi.fn(),
    sendPayment: vi.fn(),
    prepareLnurlPay: vi.fn(),
    lnurlPay: vi.fn(),
  };
  const LNURL = {
    callback: 'https://pay.example/cb',
    minSendable: 1_500,
    maxSendable: 2_000_999,
    metadataStr: '[]',
    commentAllowed: 120,
    domain: 'pay.example',
    url: 'https://pay.example/.well-known/lnurlp/bob',
  };
  const BOLT11 = `lnbc21n1${'q'.repeat(40)}`;

  beforeEach(() => {
    for (const fn of Object.values(sdkPay)) {
      fn.mockReset();
    }
    mocks.connect.mockResolvedValue({
      getInfo: mocks.getInfo,
      addEventListener: mocks.addEventListener,
      disconnect: mocks.disconnect,
      ...sdkPay,
    });
  });

  async function connection(): Promise<
    Awaited<ReturnType<Awaited<ReturnType<typeof loadWalletSdk>>['connect']>>
  > {
    const sdk = await loadWalletSdk();
    return sdk.connect(MNEMONIC, API_KEY, HOST);
  }

  it('parse maps a BOLT11 request with amount and shows the request, not its description', async () => {
    sdkPay.parse.mockResolvedValue({
      type: 'bolt11Invoice',
      amountMsat: 2_100_999,
      description: ' Coffee ',
      invoice: { bolt11: BOLT11 },
    });
    const conn = await connection();
    await expect(conn.parse(BOLT11)).resolves.toEqual({
      type: 'request',
      input: BOLT11,
      amountSats: 2_100,
      recipient: `${BOLT11.slice(0, 10)}…${BOLT11.slice(-6)}`,
    });
    expect(sdkPay.parse).toHaveBeenCalledWith(BOLT11);
  });

  it('parse maps an amountless BOLT11 request to a shortened recipient', async () => {
    sdkPay.parse.mockResolvedValue({ type: 'bolt11Invoice', invoice: { bolt11: BOLT11 } });
    const conn = await connection();
    await expect(conn.parse(BOLT11)).resolves.toEqual({
      type: 'request',
      input: BOLT11,
      amountSats: null,
      recipient: `${BOLT11.slice(0, 10)}…${BOLT11.slice(-6)}`,
    });
  });

  it('parse keeps a short request whole as the recipient', async () => {
    sdkPay.parse.mockResolvedValue({
      type: 'bolt11Invoice',
      invoice: { bolt11: 'lnbc1short' },
    });
    const conn = await connection();
    await expect(conn.parse('lnbc1short')).resolves.toMatchObject({ recipient: 'lnbc1short' });
  });

  it('parse maps a Spark-style invoice with and without amount', async () => {
    const invoice = `spark1${'x'.repeat(40)}`;
    sdkPay.parse.mockResolvedValueOnce({
      type: 'sparkInvoice',
      invoice,
      amount: '2100',
      description: 'Gift',
    });
    sdkPay.parse.mockResolvedValueOnce({ type: 'sparkInvoice', invoice });
    const conn = await connection();
    await expect(conn.parse(invoice)).resolves.toEqual({
      type: 'request',
      input: invoice,
      amountSats: 2_100,
      recipient: `${invoice.slice(0, 10)}…${invoice.slice(-6)}`,
    });
    await expect(conn.parse(invoice)).resolves.toEqual({
      type: 'request',
      input: invoice,
      amountSats: null,
      recipient: `${invoice.slice(0, 10)}…${invoice.slice(-6)}`,
    });
  });

  it('parse refuses a BOLT11 request for less than one whole sat', async () => {
    sdkPay.parse.mockResolvedValue({
      type: 'bolt11Invoice',
      amountMsat: 500,
      invoice: { bolt11: 'lnbc5p1' },
    });
    const conn = await connection();
    await expect(conn.parse('lnbc5p1')).resolves.toEqual({ type: 'unsupported' });
  });

  it('parse refuses a token invoice', async () => {
    sdkPay.parse.mockResolvedValue({
      type: 'sparkInvoice',
      invoice: 'spark1token',
      tokenIdentifier: 'btkn1',
    });
    const conn = await connection();
    await expect(conn.parse('spark1token')).resolves.toEqual({ type: 'unsupported' });
  });

  it('parse maps an address without amount', async () => {
    sdkPay.parse.mockResolvedValue({ type: 'sparkAddress', address: 'sp1short' });
    const conn = await connection();
    await expect(conn.parse('sp1short')).resolves.toEqual({
      type: 'request',
      input: 'sp1short',
      amountSats: null,
      recipient: 'sp1short',
    });
  });

  it('parse maps a payment address and an LNURL to sat bounds', async () => {
    sdkPay.parse.mockResolvedValueOnce({
      type: 'lightningAddress',
      address: 'bob@pay.example',
      payRequest: LNURL,
    });
    sdkPay.parse.mockResolvedValueOnce({ type: 'lnurlPay', ...LNURL });
    sdkPay.parse.mockResolvedValueOnce({ type: 'lnurlPay', ...LNURL, address: 'amy@pay.example' });
    const conn = await connection();
    await expect(conn.parse('bob@pay.example')).resolves.toEqual({
      type: 'lnurl',
      request: { details: LNURL },
      minSats: 2,
      maxSats: 2_000,
      commentMaxLength: 120,
      recipient: 'bob@pay.example',
    });
    await expect(conn.parse('lnurl1')).resolves.toMatchObject({
      type: 'lnurl',
      recipient: 'pay.example',
    });
    await expect(conn.parse('lnurl1')).resolves.toMatchObject({ recipient: 'amy@pay.example' });
  });

  it('parse refuses an LNURL receiver whose bounds leave no whole sat', async () => {
    sdkPay.parse.mockResolvedValueOnce({
      type: 'lnurlPay',
      ...LNURL,
      minSendable: 1_001,
      maxSendable: 1_500,
    });
    sdkPay.parse.mockResolvedValueOnce({
      type: 'lnurlPay',
      ...LNURL,
      minSendable: 0,
      maxSendable: 999,
    });
    sdkPay.parse.mockResolvedValueOnce({
      type: 'lnurlPay',
      ...LNURL,
      minSendable: 0,
      maxSendable: 5_000,
    });
    const conn = await connection();
    await expect(conn.parse('lnurl1')).resolves.toEqual({ type: 'unsupported' });
    await expect(conn.parse('lnurl1')).resolves.toEqual({ type: 'unsupported' });
    await expect(conn.parse('lnurl1')).resolves.toMatchObject({ minSats: 1, maxSats: 5 });
  });

  it('parse keeps millisat bounds that round to one whole sat as equal bounds', async () => {
    sdkPay.parse.mockResolvedValueOnce({
      type: 'lnurlPay',
      ...LNURL,
      minSendable: 6_500,
      maxSendable: 7_999,
    });
    const conn = await connection();
    await expect(conn.parse('lnurl1')).resolves.toMatchObject({ minSats: 7, maxSats: 7 });
  });

  it('parse maps a base-chain address to onchain and other inputs to unsupported', async () => {
    sdkPay.parse.mockResolvedValueOnce({ type: 'bitcoinAddress', address: 'bc1q' });
    sdkPay.parse.mockResolvedValueOnce({ type: 'lnurlWithdraw' });
    const conn = await connection();
    await expect(conn.parse('bc1q')).resolves.toEqual({ type: 'onchain' });
    await expect(conn.parse('lnurlw')).resolves.toEqual({ type: 'unsupported' });
  });

  it('parse takes the first payable method of a BIP21 URI', async () => {
    sdkPay.parse.mockResolvedValue({
      type: 'bip21',
      paymentMethods: [
        { type: 'bitcoinAddress', address: 'bc1q' },
        { type: 'sparkInvoice', invoice: 'spark1token', tokenIdentifier: 'btkn1' },
        { type: 'url' },
        { type: 'bolt11Invoice', amountMsat: 21_000, invoice: { bolt11: 'lnbc1short' } },
      ],
    });
    const conn = await connection();
    await expect(conn.parse('bitcoin:bc1q?lightning=lnbc1short')).resolves.toEqual({
      type: 'request',
      input: 'lnbc1short',
      amountSats: 21,
      recipient: 'lnbc1short',
    });
  });

  it('parse maps a BIP21 URI with only a base-chain address to onchain, and none to unsupported', async () => {
    sdkPay.parse.mockResolvedValueOnce({
      type: 'bip21',
      paymentMethods: [{ type: 'bitcoinAddress', address: 'bc1q' }],
    });
    sdkPay.parse.mockResolvedValueOnce({ type: 'bip21', paymentMethods: [] });
    const conn = await connection();
    await expect(conn.parse('bitcoin:bc1q')).resolves.toEqual({ type: 'onchain' });
    await expect(conn.parse('bitcoin:')).resolves.toEqual({ type: 'unsupported' });
  });

  it('parse refuses a BIP21 URI that names an asset', async () => {
    sdkPay.parse.mockResolvedValueOnce({
      type: 'bip21',
      assetId: 'btkn1',
      amountSat: 21,
      paymentMethods: [{ type: 'sparkAddress', address: 'sp1asset' }],
    });
    const conn = await connection();
    await expect(conn.parse('bitcoin:?sp=sp1asset&assetid=btkn1')).resolves.toEqual({
      type: 'unsupported',
    });
  });

  it('parse takes the BIP21 amount for a method without one', async () => {
    sdkPay.parse.mockResolvedValueOnce({
      type: 'bip21',
      amountSat: 2_100,
      paymentMethods: [{ type: 'sparkAddress', address: 'sp1short' }],
    });
    sdkPay.parse.mockResolvedValueOnce({
      type: 'bip21',
      amountSat: 2_100,
      paymentMethods: [
        { type: 'bolt11Invoice', amountMsat: 21_000, invoice: { bolt11: 'lnbc1short' } },
      ],
    });
    const conn = await connection();
    await expect(conn.parse('bitcoin:?sp=sp1short&amount=0.000021')).resolves.toEqual({
      type: 'request',
      input: 'sp1short',
      amountSats: 2_100,
      recipient: 'sp1short',
      amountFromUri: true,
    });
    await expect(conn.parse('bitcoin:?lightning=lnbc1short')).resolves.toMatchObject({
      amountSats: 21,
    });
  });

  it('parse rejects when the SDK rejects', async () => {
    sdkPay.parse.mockRejectedValue(new Error('unreachable'));
    const conn = await connection();
    await expect(conn.parse('bob@pay.example')).rejects.toThrow('unreachable');
  });

  it('prepare pays a request text and reads amount and the Spark-style fee', async () => {
    const response = {
      amount: 2_100n,
      paymentMethod: { type: 'sparkInvoice', fee: '0' },
      feePolicy: 'feesExcluded',
    };
    sdkPay.prepareSendPayment.mockResolvedValue(response);
    sdkPay.sendPayment.mockResolvedValue({ payment: {} });
    const conn = await connection();
    const prepared = await conn.prepare({ type: 'input', input: 'spark1x' });
    expect(sdkPay.prepareSendPayment).toHaveBeenCalledWith({
      paymentRequest: { type: 'input', input: 'spark1x' },
    });
    expect(prepared.amountSats).toBe(2_100);
    expect(prepared.feeSats).toBe(0);
    await prepared.send();
    expect(sdkPay.sendPayment).toHaveBeenCalledWith({ prepareResponse: response });
  });

  it('prepare passes an amount and reads address and BOLT11 fees', async () => {
    sdkPay.prepareSendPayment.mockResolvedValueOnce({
      amount: 500n,
      paymentMethod: { type: 'sparkAddress', fee: '3' },
    });
    sdkPay.prepareSendPayment.mockResolvedValueOnce({
      amount: 21n,
      paymentMethod: { type: 'bolt11Invoice', lightningFeeSats: 2 },
    });
    const conn = await connection();
    await expect(
      conn.prepare({ type: 'input', input: 'sp1', amountSats: 500 }),
    ).resolves.toMatchObject({
      amountSats: 500,
      feeSats: 3,
    });
    expect(sdkPay.prepareSendPayment).toHaveBeenCalledWith({
      paymentRequest: { type: 'input', input: 'sp1' },
      amount: 500n,
    });
    await expect(conn.prepare({ type: 'input', input: 'lnbc1' })).resolves.toMatchObject({
      amountSats: 21,
      feeSats: 2,
    });
  });

  it('sends a BOLT11 request over Lightning and shows only the Lightning fee', async () => {
    const response = {
      amount: 21n,
      paymentMethod: { type: 'bolt11Invoice', lightningFeeSats: 2, sparkTransferFeeSats: 7 },
    };
    sdkPay.prepareSendPayment.mockResolvedValueOnce(response);
    sdkPay.sendPayment.mockResolvedValue({ payment: {} });
    const conn = await connection();
    const prepared = await conn.prepare({ type: 'input', input: 'lnbc1' });
    expect(prepared.feeSats).toBe(2);
    await prepared.send();
    expect(sdkPay.sendPayment).toHaveBeenCalledWith({
      prepareResponse: response,
      options: { type: 'bolt11Invoice', preferSpark: false },
    });
  });

  it('prepare rejects a payment that would send a token rather than Bitcoin', async () => {
    sdkPay.prepareSendPayment
      .mockResolvedValueOnce({
        amount: 21n,
        tokenIdentifier: 'btkn1',
        paymentMethod: { type: 'sparkInvoice', fee: '0' },
      })
      .mockResolvedValueOnce({
        amount: 21n,
        paymentMethod: { type: 'sparkInvoice', fee: '0', tokenIdentifier: 'btkn1' },
      });
    const conn = await connection();
    await expect(conn.prepare({ type: 'input', input: 'spark1t' })).rejects.toThrow(
      'Unsupported payment method',
    );
    await expect(conn.prepare({ type: 'input', input: 'spark1t' })).rejects.toThrow(
      'Unsupported payment method',
    );
  });

  it('prepare rejects a method the app does not pay', async () => {
    sdkPay.prepareSendPayment.mockResolvedValue({
      amount: 1_000n,
      paymentMethod: { type: 'bitcoinAddress' },
    });
    const conn = await connection();
    await expect(conn.prepare({ type: 'input', input: 'bc1q' })).rejects.toThrow(
      'Unsupported payment method',
    );
  });

  it('prepare asks an LNURL receiver for an amount with and without comment, and sends', async () => {
    const response = { amountSats: 2_100, feeSats: 1 };
    sdkPay.prepareLnurlPay.mockResolvedValue(response);
    sdkPay.lnurlPay.mockResolvedValue({ payment: {} });
    const conn = await connection();
    const prepared = await conn.prepare({
      type: 'lnurl',
      request: { details: LNURL },
      amountSats: 2_100,
      comment: 'Thanks',
    });
    expect(sdkPay.prepareLnurlPay).toHaveBeenCalledWith({
      amount: 2_100n,
      payRequest: LNURL,
      comment: 'Thanks',
    });
    expect(prepared).toMatchObject({ amountSats: 2_100, feeSats: 1 });
    await prepared.send();
    expect(sdkPay.lnurlPay).toHaveBeenCalledWith({ prepareResponse: response });
    await conn.prepare({ type: 'lnurl', request: { details: LNURL }, amountSats: 5 });
    expect(sdkPay.prepareLnurlPay).toHaveBeenLastCalledWith({ amount: 5n, payRequest: LNURL });
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
