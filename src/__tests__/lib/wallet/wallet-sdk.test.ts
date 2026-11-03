import { beforeEach, describe, expect, it, vi } from 'vitest';
import { toWalletPayment, toWalletReportPayment } from '@/lib/wallet/wallet-sdk';

/** A fresh adapter per test, so its shared SDK start begins empty. */
let loadWalletSdk: typeof import('@/lib/wallet/wallet-sdk').loadWalletSdk;

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
    getPayment: vi.fn(),
    checkLightningAddressAvailable: vi.fn(),
    disconnect: vi.fn(),
    connect: vi.fn(),
    defaultConfig: vi.fn(),
    defaultExternalSigners: vi.fn(),
    init: vi.fn(),
  };
});

vi.mock('@breeztech/breez-sdk-spark/web', () => ({
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
  defaultExternalSigners: (...args: unknown[]) => mocks.defaultExternalSigners(...args),
}));

beforeEach(async () => {
  vi.resetModules();
  ({ loadWalletSdk } = await import('@/lib/wallet/wallet-sdk'));
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
    getPayment: mocks.getPayment,
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

  it('addEventListener maps the payment of a payment event and leaves out a token payment', async () => {
    let forwarded: ((event: unknown) => void) | undefined;
    mocks.addEventListener.mockImplementation(
      async (listener: { onEvent: (e: unknown) => void }) => {
        forwarded = listener.onEvent;
        return 'listener-1';
      },
    );
    const sdk = await loadWalletSdk();
    const connection = await sdk.connect(MNEMONIC, API_KEY, HOST);
    const seen: unknown[] = [];
    await connection.addEventListener((event) => {
      seen.push(event);
    });
    forwarded?.({
      type: 'paymentSucceeded',
      payment: {
        id: 'p1',
        paymentType: 'receive',
        status: 'completed',
        amount: BigInt(500),
        fees: BigInt(0),
        timestamp: 10,
        method: 'lightning',
      },
    });
    forwarded?.({
      type: 'paymentSucceeded',
      payment: {
        id: 't1',
        paymentType: 'receive',
        status: 'completed',
        amount: BigInt(5),
        fees: BigInt(0),
        timestamp: 10,
        method: 'token',
      },
    });
    expect(seen).toEqual([
      {
        type: 'paymentSucceeded',
        payment: {
          id: 'p1',
          direction: 'received',
          amountSats: 500,
          feesSats: 0,
          timestamp: 10_000,
          status: 'completed',
          method: 'lightning',
          senderComment: null,
          info: {},
        },
      },
      { type: 'paymentSucceeded' },
    ]);
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
        feesSats: 0,
        timestamp: 1_700_000_000_000,
        status: 'completed',
        method: 'lightning',
        senderComment: 'Thanks',
        info: {},
      },
    ]);
    expect(mocks.listPayments).toHaveBeenCalledWith({
      offset: 20,
      limit: 20,
      sortAscending: false,
      assetFilter: { type: 'bitcoin' },
    });
  });

  it('getPayment reads one payment by id and maps it', async () => {
    mocks.getPayment.mockResolvedValueOnce({
      payment: {
        id: 'p2',
        paymentType: 'send',
        status: 'pending',
        amount: 1_500n,
        fees: 2n,
        timestamp: 1_700_000_000,
        method: 'spark',
      },
    });
    const sdk = await loadWalletSdk();
    const connection = await sdk.connect(MNEMONIC, API_KEY, HOST);
    await expect(connection.getPayment('p2')).resolves.toMatchObject({
      id: 'p2',
      direction: 'sent',
      feesSats: 2,
      status: 'pending',
      method: 'spark',
    });
    expect(mocks.getPayment).toHaveBeenCalledWith({ paymentId: 'p2' });
  });

  it('getPayment refuses a token payment, whose amount is not in satoshis', async () => {
    mocks.getPayment.mockResolvedValueOnce({
      payment: {
        id: 't1',
        paymentType: 'receive',
        status: 'completed',
        amount: 5n,
        timestamp: 1_700_000_000,
        method: 'token',
      },
    });
    const sdk = await loadWalletSdk();
    const connection = await sdk.connect(MNEMONIC, API_KEY, HOST);
    await expect(connection.getPayment('t1')).rejects.toThrow('wallet-payment-not-bitcoin');
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
  const ONCHAIN = 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq';

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

  it('parse maps a mainnet base-chain address to onchain and other inputs to unsupported', async () => {
    sdkPay.parse.mockResolvedValueOnce({
      type: 'bitcoinAddress',
      address: ONCHAIN,
      network: 'bitcoin',
    });
    sdkPay.parse.mockResolvedValueOnce({
      type: 'bitcoinAddress',
      address: '3J98t1',
      network: 'bitcoin',
    });
    sdkPay.parse.mockResolvedValueOnce({
      type: 'bitcoinAddress',
      address: 'tb1q',
      network: 'testnet3',
    });
    sdkPay.parse.mockResolvedValueOnce({ type: 'lnurlWithdraw' });
    const conn = await connection();
    await expect(conn.parse(ONCHAIN)).resolves.toEqual({
      type: 'onchain',
      address: ONCHAIN,
      amountSats: null,
      recipient: 'bc1qar0srr…wf5mdq',
    });
    await expect(conn.parse('3J98t1')).resolves.toEqual({
      type: 'onchain',
      address: '3J98t1',
      amountSats: null,
      recipient: '3J98t1',
    });
    await expect(conn.parse('tb1q')).resolves.toEqual({ type: 'unsupported' });
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

  it('parse maps a BIP21 URI with only a base-chain address to onchain with its amount, and none to unsupported', async () => {
    const address = { type: 'bitcoinAddress', address: ONCHAIN, network: 'bitcoin' };
    sdkPay.parse.mockResolvedValueOnce({ type: 'bip21', paymentMethods: [address] });
    sdkPay.parse.mockResolvedValueOnce({
      type: 'bip21',
      amountSat: 50_000,
      paymentMethods: [address, { ...address, address: 'bc1qsecond' }],
    });
    sdkPay.parse.mockResolvedValueOnce({
      type: 'bip21',
      amountSat: 0.5,
      paymentMethods: [address],
    });
    sdkPay.parse.mockResolvedValueOnce({ type: 'bip21', paymentMethods: [] });
    const conn = await connection();
    const onchain = {
      type: 'onchain',
      address: ONCHAIN,
      amountSats: null,
      recipient: 'bc1qar0srr…wf5mdq',
    };
    await expect(conn.parse(`bitcoin:${ONCHAIN}`)).resolves.toEqual(onchain);
    await expect(conn.parse(`bitcoin:${ONCHAIN}?amount=0.0005`)).resolves.toEqual({
      ...onchain,
      amountSats: 50_000,
    });
    await expect(conn.parse(`bitcoin:${ONCHAIN}?amount=0.000000005`)).resolves.toEqual(onchain);
    await expect(conn.parse('bitcoin:')).resolves.toEqual({ type: 'unsupported' });
  });

  it('parse keeps the Lightning method of a BIP21 URI before its base-chain address', async () => {
    sdkPay.parse.mockResolvedValue({
      type: 'bip21',
      amountSat: 2_100,
      paymentMethods: [
        { type: 'bitcoinAddress', address: ONCHAIN, network: 'bitcoin' },
        { type: 'sparkAddress', address: 'sp1short' },
      ],
    });
    const conn = await connection();
    await expect(conn.parse(`bitcoin:${ONCHAIN}?sp=sp1short`)).resolves.toEqual({
      type: 'request',
      input: 'sp1short',
      amountSats: 2_100,
      recipient: 'sp1short',
      amountFromUri: true,
    });
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
      paymentMethod: { type: 'crossChainAddress' },
    });
    const conn = await connection();
    await expect(conn.prepare({ type: 'input', input: '0xabc' })).rejects.toThrow(
      'Unsupported payment method',
    );
  });

  it('prepare reads the fee quote of a base-chain address and sends with the chosen speed', async () => {
    const response = {
      amount: 50_000n,
      paymentMethod: {
        type: 'bitcoinAddress',
        address: { address: ONCHAIN, network: 'bitcoin', source: {} },
        feeQuote: {
          id: 'quote-1',
          expiresAt: 1_800_000_000,
          speedFast: { userFeeSat: 2_000, l1BroadcastFeeSat: 840 },
          speedMedium: { userFeeSat: 1_000, l1BroadcastFeeSat: 420 },
          speedSlow: { userFeeSat: 500, l1BroadcastFeeSat: 210 },
          isEstimate: false,
        },
      },
      feePolicy: 'feesExcluded',
    };
    sdkPay.prepareSendPayment.mockResolvedValue(response);
    sdkPay.sendPayment.mockResolvedValue({ payment: {} });
    const conn = await connection();
    const prepared = await conn.prepare({ type: 'input', input: ONCHAIN, amountSats: 50_000 });
    expect(sdkPay.prepareSendPayment).toHaveBeenCalledWith({
      paymentRequest: { type: 'input', input: ONCHAIN },
      amount: 50_000n,
    });
    expect(prepared.amountSats).toBe(50_000);
    expect(prepared.feeSats).toBe(1_420);
    expect(prepared.onchain).toEqual({
      fees: { fast: 2_840, medium: 1_420, slow: 710 },
      expiresAtMs: 1_800_000_000_000,
    });
    await prepared.send('fast');
    expect(sdkPay.sendPayment).toHaveBeenLastCalledWith({
      prepareResponse: response,
      options: { type: 'bitcoinAddress', confirmationSpeed: 'fast' },
    });
    await prepared.send();
    expect(sdkPay.sendPayment).toHaveBeenLastCalledWith({
      prepareResponse: response,
      options: { type: 'bitcoinAddress', confirmationSpeed: 'medium' },
    });
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

describe('social recovery', () => {
  const sdkRecovery = {
    signMessage: vi.fn(),
    getLightningAddress: vi.fn(),
    authorizeLightningAddressTransfer: vi.fn(),
    claimLightningAddressTransfer: vi.fn(),
    receivePayment: vi.fn(),
    prepareSendPayment: vi.fn(),
    sendPayment: vi.fn(),
  };
  /** The identity key and a compact signature of the SDK's offline signer. */
  const OLD_KEY = '0281363910b0dc0015a4a25e758da30f0e28388ea5252c0e3713936f2d4ef7d3d5';
  const COMPACT =
    'b02626c724efdd78042241a16fb1808118544d09f13d2d745847f5dbfc46f46167acd68bf9f5cf6cf844b000c555a228c811924a44473a516c7cce6a95cdaab4';
  const DER =
    '3045022100b02626c724efdd78042241a16fb1808118544d09f13d2d745847f5dbfc46f461022067acd68bf9f5cf6cf844b000c555a228c811924a44473a516c7cce6a95cdaab4';
  const signer = {
    getIdentityPublicKey: vi.fn(),
    signMessage: vi.fn(),
    free: vi.fn(),
  };
  const signers = { sparkSigner: signer, free: vi.fn() };
  const UUID = '5f0c3a4e-8d1b-4f6a-9c2e-7b3d1a0e9f42';

  beforeEach(() => {
    for (const fn of [...Object.values(sdkRecovery), ...Object.values(signer), signers.free]) {
      fn.mockReset();
    }
    mocks.connect.mockResolvedValue({
      getInfo: mocks.getInfo,
      addEventListener: mocks.addEventListener,
      disconnect: mocks.disconnect,
      ...sdkRecovery,
    });
    mocks.defaultExternalSigners.mockReset().mockReturnValue(signers);
    signer.getIdentityPublicKey.mockResolvedValue({
      bytes: Array.from(Buffer.from(OLD_KEY, 'hex')),
    });
    signer.signMessage.mockResolvedValue({ bytes: Array.from(Buffer.from(COMPACT, 'hex')) });
  });

  async function connection(): Promise<
    Awaited<ReturnType<Awaited<ReturnType<typeof loadWalletSdk>>['connect']>>
  > {
    const sdk = await loadWalletSdk();
    return sdk.connect(MNEMONIC, API_KEY, HOST);
  }

  it('signMessage signs compact and returns only the key and the signature', async () => {
    sdkRecovery.signMessage.mockResolvedValue({ pubkey: OLD_KEY, signature: COMPACT, extra: 1 });
    const conn = await connection();
    await expect(conn.signMessage('21gifts-account-recovery-v1\nacc')).resolves.toEqual({
      pubkey: OLD_KEY,
      signature: COMPACT,
    });
    expect(sdkRecovery.signMessage).toHaveBeenCalledWith({
      message: '21gifts-account-recovery-v1\nacc',
      compact: true,
    });
  });

  it('hasAddress reads the address the wallet holds, or none', async () => {
    sdkRecovery.getLightningAddress
      .mockResolvedValueOnce({ username: 'ada', lightningAddress: 'ada@21.gifts' })
      .mockResolvedValueOnce(undefined);
    const conn = await connection();
    await expect(conn.hasAddress()).resolves.toBe(true);
    await expect(conn.hasAddress()).resolves.toBe(false);
    expect(sdkRecovery.getLightningAddress).toHaveBeenCalledWith();
  });

  it('authorizes the address for the new key and claims it with that same authorization', async () => {
    const authorization = {
      username: 'ada',
      pubkey: OLD_KEY,
      signature: DER,
      domain: HOST,
      timestamp: 1_700_000_000,
    };
    sdkRecovery.authorizeLightningAddressTransfer.mockResolvedValue(authorization);
    sdkRecovery.claimLightningAddressTransfer.mockResolvedValue({ username: 'ada' });
    const conn = await connection();
    const transfer = await conn.authorizeAddressTransfer(IDENTITY);
    expect(sdkRecovery.authorizeLightningAddressTransfer).toHaveBeenCalledWith({
      transfereePubkey: IDENTITY,
    });
    expect(transfer).toEqual({ authorization });
    await expect(conn.claimAddressTransfer(transfer)).resolves.toBeUndefined();
    expect(sdkRecovery.claimLightningAddressTransfer).toHaveBeenCalledWith({ authorization });
  });

  it('claimAddressTransfer passes a refused claim on', async () => {
    sdkRecovery.claimLightningAddressTransfer.mockRejectedValue(new Error('refused'));
    const conn = await connection();
    await expect(conn.claimAddressTransfer({ authorization: {} })).rejects.toThrow('refused');
  });

  it('receiveSparkAddress asks for a Spark address and returns it', async () => {
    sdkRecovery.receivePayment.mockResolvedValue({ paymentRequest: 'spark1qxyz', fee: 0n });
    const conn = await connection();
    await expect(conn.receiveSparkAddress()).resolves.toBe('spark1qxyz');
    expect(sdkRecovery.receivePayment).toHaveBeenCalledWith({
      paymentMethod: { type: 'sparkAddress' },
    });
  });

  it('sendToSparkAddress sends exactly the amount with the idempotency key', async () => {
    const prepared = {
      amount: 21_000n,
      paymentMethod: { type: 'sparkAddress', address: 'spark1qxyz', fee: '0' },
      feePolicy: 'feesExcluded',
    };
    sdkRecovery.prepareSendPayment.mockResolvedValue(prepared);
    sdkRecovery.sendPayment.mockResolvedValue({ payment: {} });
    const conn = await connection();
    await expect(conn.sendToSparkAddress('spark1qxyz', 21_000, UUID)).resolves.toBeUndefined();
    expect(sdkRecovery.prepareSendPayment).toHaveBeenCalledWith({
      paymentRequest: { type: 'input', input: 'spark1qxyz' },
      amount: 21_000n,
    });
    expect(sdkRecovery.sendPayment).toHaveBeenCalledWith({
      prepareResponse: prepared,
      idempotencyKey: UUID,
    });
  });

  it('sendToSparkAddress refuses any other payment method and sends nothing', async () => {
    sdkRecovery.prepareSendPayment.mockResolvedValue({
      amount: 21_000n,
      paymentMethod: { type: 'bolt11Invoice', lightningFeeSats: 2 },
    });
    const conn = await connection();
    await expect(conn.sendToSparkAddress('lnbc1', 21_000, UUID)).rejects.toThrow(
      'Not a Spark address',
    );
    expect(sdkRecovery.sendPayment).not.toHaveBeenCalled();
  });

  it('identityPubkey reads the key of the words offline and frees the signer', async () => {
    const sdk = await loadWalletSdk();
    await expect(sdk.identityPubkey(MNEMONIC)).resolves.toBe(OLD_KEY);
    expect(mocks.defaultExternalSigners).toHaveBeenCalledWith(MNEMONIC, null, 'mainnet');
    expect(mocks.connect).not.toHaveBeenCalled();
    expect(signer.free).toHaveBeenCalledTimes(1);
    expect(signers.free).toHaveBeenCalledTimes(1);
  });

  it('identityPubkey frees the signer also when reading the key fails', async () => {
    signer.getIdentityPublicKey.mockRejectedValue(new Error('signer failed'));
    const sdk = await loadWalletSdk();
    await expect(sdk.identityPubkey(MNEMONIC)).rejects.toThrow('signer failed');
    expect(signer.free).toHaveBeenCalledTimes(1);
    expect(signers.free).toHaveBeenCalledTimes(1);
  });

  it('identityPubkey passes invalid words on', async () => {
    mocks.defaultExternalSigners.mockImplementation(() => {
      throw new Error('invalid mnemonic');
    });
    const sdk = await loadWalletSdk();
    await expect(sdk.identityPubkey('not words')).rejects.toThrow('invalid mnemonic');
  });

  it('signAddressLookup signs the exact recover message bytes and DER-encodes the signature', async () => {
    const sdk = await loadWalletSdk();
    await expect(sdk.signAddressLookup(MNEMONIC, HOST, 1_761_700_000)).resolves.toEqual({
      pubkey: OLD_KEY,
      signature: DER,
    });
    const signed = signer.signMessage.mock.calls[0]?.[0] as Uint8Array;
    expect(new TextDecoder().decode(signed)).toBe(
      `breez-lnurl:v2\nrecover\n${HOST}\n${OLD_KEY}\n1761700000`,
    );
    expect(mocks.connect).not.toHaveBeenCalled();
    expect(signer.free).toHaveBeenCalledTimes(1);
    expect(signers.free).toHaveBeenCalledTimes(1);
  });
});

describe('loadWalletSdk listReportPayments', () => {
  it('lists Bitcoin payments newest first in the report shape', async () => {
    mocks.listPayments.mockResolvedValueOnce({
      payments: [
        {
          id: 'r1',
          paymentType: 'receive',
          status: 'completed',
          amount: 21n,
          fees: 0n,
          timestamp: 0,
          method: 'lightning',
          details: {
            type: 'lightning',
            htlcDetails: { paymentHash: PAYMENT_HASH, preimage: PREIMAGE },
          },
        },
      ],
    });
    const sdk = await loadWalletSdk();
    const conn = await sdk.connect(MNEMONIC, API_KEY, HOST);
    const rows = await conn.listReportPayments({ offset: 200, limit: 200 });
    expect(mocks.listPayments).toHaveBeenCalledWith({
      offset: 200,
      limit: 200,
      sortAscending: false,
      assetFilter: { type: 'bitcoin' },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.paymentHash).toBe(PAYMENT_HASH);
    expect(JSON.stringify(rows)).not.toContain(PREIMAGE);
  });
});

describe('loadWalletSdk start', () => {
  it('shares one download and initialisation between calls while it runs', async () => {
    let finishInit: () => void = () => undefined;
    mocks.init.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        finishInit = resolve;
      }),
    );
    const first = loadWalletSdk();
    const second = loadWalletSdk();
    await vi.waitFor(() => {
      expect(mocks.callOrder).toContain('init');
    });
    finishInit();
    await Promise.all([first, second]);
    await loadWalletSdk();
    expect(mocks.init).toHaveBeenCalledTimes(1);
  });

  it('initialises again in the same page after an initialisation failed', async () => {
    mocks.init.mockRejectedValueOnce(new Error('init failed'));
    await expect(loadWalletSdk()).rejects.toThrow('init failed');
    const sdk = await loadWalletSdk();
    await sdk.connect(MNEMONIC, API_KEY, HOST);
    expect(mocks.init).toHaveBeenCalledTimes(2);
    expect(mocks.connect).toHaveBeenCalledTimes(1);
  });

  it('imports again in the same page after the package import failed', async () => {
    vi.resetModules();
    let failImport = true;
    vi.doMock('@breeztech/breez-sdk-spark/web', () => {
      if (failImport) {
        throw new Error('import failed');
      }
      return {
        default: async () => mocks.init(),
        defaultConfig: (...args: unknown[]) => mocks.defaultConfig(...args),
        connect: (...args: unknown[]) => mocks.connect(...args),
      };
    });
    try {
      const { loadWalletSdk: load } = await import('@/lib/wallet/wallet-sdk');
      await expect(load()).rejects.toThrow();
      expect(mocks.init).not.toHaveBeenCalled();
      failImport = false;
      await expect(load()).resolves.toBeDefined();
      expect(mocks.init).toHaveBeenCalledTimes(1);
    } finally {
      vi.doUnmock('@breeztech/breez-sdk-spark/web');
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
      feesSats: 0,
      timestamp: 1_700_000_000_000,
      status: 'completed',
      method: 'other',
      senderComment: null,
      info: {},
    });
  });

  it('maps the fees and the known methods; token and unknown methods are other', () => {
    expect(toWalletPayment({ ...base, fees: 3n }).feesSats).toBe(3);
    expect(toWalletPayment({ ...base, fees: 4 }).feesSats).toBe(4);
    for (const method of ['lightning', 'spark', 'deposit', 'withdraw'] as const) {
      expect(toWalletPayment({ ...base, method }).method).toBe(method);
    }
    expect(toWalletPayment({ ...base, method: 'token' }).method).toBe('other');
    expect(toWalletPayment({ ...base, method: 'unknown' }).method).toBe('other');
  });

  it('reads a Lightning send: description, invoice, hash, preimage, node, address, and comment', () => {
    expect(
      toWalletPayment({
        ...base,
        details: {
          type: 'lightning',
          description: '  Coffee  ',
          invoice: 'lnbc1',
          destinationPubkey: '02ab',
          htlcDetails: { paymentHash: 'aa', preimage: 'bb' },
          lnurlPayInfo: { lnAddress: 'bob@example.com', comment: '  thanks  ' },
        },
      }).info,
    ).toEqual({
      description: 'Coffee',
      invoice: 'lnbc1',
      paymentHash: 'aa',
      preimage: 'bb',
      destinationPubkey: '02ab',
      lnAddress: 'bob@example.com',
      lnurlComment: 'thanks',
    });
  });

  it('leaves out a blank description and comment and a missing preimage', () => {
    expect(
      toWalletPayment({
        ...base,
        details: {
          type: 'lightning',
          description: '   ',
          htlcDetails: { paymentHash: 'aa' },
          lnurlPayInfo: { comment: '  ' },
        },
      }).info,
    ).toEqual({ paymentHash: 'aa' });
  });

  it('reads a Spark invoice and its description', () => {
    expect(
      toWalletPayment({
        ...base,
        details: { type: 'spark', invoiceDetails: { description: 'Gift', invoice: 'spark1x' } },
      }).info,
    ).toEqual({ description: 'Gift', invoice: 'spark1x' });
    expect(
      toWalletPayment({
        ...base,
        details: { type: 'spark', invoiceDetails: { invoice: 'spark1y' } },
      }).info,
    ).toEqual({ invoice: 'spark1y' });
  });

  it('reads a gift memo as purpose gift and uses its hash when none is set', () => {
    const mixedHash = 'aB'.repeat(32);
    expect(
      toWalletPayment({
        ...base,
        details: {
          type: 'spark',
          invoiceDetails: { description: `zap:${mixedHash}`, invoice: 'spark1z' },
        },
      }).info,
    ).toEqual({
      purpose: 'gift',
      invoice: 'spark1z',
      paymentHash: mixedHash.toLowerCase(),
    });
    expect(
      toWalletPayment({
        ...base,
        details: {
          type: 'spark',
          invoiceDetails: { description: `zap:${mixedHash}`, invoice: 'spark1z' },
          htlcDetails: { paymentHash: 'cc'.repeat(32) },
        },
      }).info,
    ).toEqual({
      purpose: 'gift',
      invoice: 'spark1z',
      paymentHash: 'cc'.repeat(32),
    });
  });

  it('reads a shop memo as purpose shop without a payment hash', () => {
    expect(
      toWalletPayment({
        ...base,
        details: {
          type: 'spark',
          invoiceDetails: { description: 'pos:chg_abc', invoice: 'spark1p' },
        },
      }).info,
    ).toEqual({ purpose: 'shop', chargeId: 'chg_abc', invoice: 'spark1p' });
  });

  it('reads the transaction of a deposit and a withdrawal', () => {
    expect(
      toWalletPayment({ ...base, details: { type: 'deposit', txId: 'tx1', vout: 0 } }).info,
    ).toEqual({ txId: 'tx1', vout: 0 });
    expect(toWalletPayment({ ...base, details: { type: 'withdraw', txId: 'tx2' } }).info).toEqual({
      txId: 'tx2',
    });
  });

  it('reads a zap request: sender, trimmed message, and the zapped note', () => {
    const key = 'ab'.repeat(32);
    const note = 'ef'.repeat(32);
    const zap = (event: unknown): ReturnType<typeof toWalletPayment>['info']['zap'] =>
      toWalletPayment({
        ...base,
        paymentType: 'receive',
        details: {
          type: 'lightning',
          lnurlReceiveMetadata: { nostrZapRequest: JSON.stringify(event) },
        },
      }).info.zap;
    expect(
      zap({
        kind: 9734,
        pubkey: key,
        content: '  Great photo!  ',
        tags: [['p', 'cd'], ['e'], ['e', 'not-hex'], ['e', note]],
      }),
    ).toEqual({ senderPubkey: key, content: 'Great photo!', noteId: note });
    expect(zap({ kind: 9734, pubkey: key, content: 7, tags: 'x' })).toEqual({
      senderPubkey: key,
      content: '',
      noteId: null,
    });
    expect(zap({ kind: 9734, pubkey: key, tags: ['e', 'x'] })?.noteId).toBeNull();
  });

  it('leaves out a zap request that is malformed JSON, not an object, the wrong kind, or without a 64-hex sender', () => {
    for (const raw of [
      '{not json',
      '"text"',
      'null',
      '{"kind":1,"pubkey":"ab"}',
      '{"kind":9734}',
    ]) {
      expect(
        toWalletPayment({
          ...base,
          details: { type: 'lightning', lnurlReceiveMetadata: { nostrZapRequest: raw } },
        }).info.zap,
      ).toBeUndefined();
    }
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

const PREIMAGE = 'f'.repeat(64);
const PAYMENT_HASH = 'e'.repeat(64);

describe('toWalletReportPayment', () => {
  it('maps a sent Lightning address payment and leaves out the preimage', () => {
    const sdkPayment = {
      id: 'pay-1',
      paymentType: 'send',
      status: 'completed',
      amount: 2_100n,
      fees: 3n,
      timestamp: 1_700_000_000,
      method: 'lightning',
      details: {
        type: 'lightning',
        description: ' Coffee ',
        invoice: 'lnbc21u1example',
        destinationPubkey: '03node',
        htlcDetails: { paymentHash: PAYMENT_HASH, preimage: PREIMAGE, expiryTime: 1, status: 'x' },
        lnurlPayInfo: { lnAddress: 'shop@example.com', domain: 'example.com', comment: 'thanks' },
        lnurlReceiveMetadata: { nostrZapRequest: '{}', senderComment: 'ignored' },
      },
    };
    const mapped = toWalletReportPayment(sdkPayment);
    expect(mapped).toEqual({
      id: 'pay-1',
      direction: 'out',
      status: 'completed',
      amountSats: 2_100,
      feeSats: 3,
      timestamp: '2023-11-14T22:13:20.000Z',
      method: 'lightning',
      paymentHash: PAYMENT_HASH,
      invoice: 'lnbc21u1example',
      destination: 'shop@example.com',
      description: 'Coffee',
      lnurlComment: 'thanks',
    });
    expect(JSON.stringify(mapped)).not.toContain(PREIMAGE);
    expect(Object.keys(mapped)).not.toContain('preimage');
  });

  it('falls back to the LNURL domain, then the node key', () => {
    const base = {
      id: 'p',
      paymentType: 'send',
      status: 'pending',
      amount: 1,
      fees: 0,
      timestamp: 0,
      method: 'lightning',
    };
    expect(
      toWalletReportPayment({
        ...base,
        details: { type: 'lightning', lnurlPayInfo: { domain: 'pay.example' } },
      }).destination,
    ).toBe('pay.example');
    const node = toWalletReportPayment({
      ...base,
      details: { type: 'lightning', destinationPubkey: '03node', lnurlPayInfo: { lnAddress: ' ' } },
    });
    expect(node.destination).toBe('03node');
    expect(node.status).toBe('pending');
  });

  it('maps a received Spark invoice payment with the sender comment', () => {
    const mapped = toWalletReportPayment({
      id: 'p2',
      paymentType: 'receive',
      status: 'failed',
      amount: 5,
      fees: 0,
      timestamp: 0,
      method: 'spark',
      details: {
        type: 'spark',
        invoiceDetails: { invoice: 'spark1invoice', description: 'Tip' },
        htlcDetails: { paymentHash: PAYMENT_HASH },
        lnurlReceiveMetadata: { senderComment: 'hi' },
      },
    });
    expect(mapped).toMatchObject({
      direction: 'in',
      status: 'failed',
      method: 'spark',
      invoice: 'spark1invoice',
      description: 'Tip',
      lnurlComment: 'hi',
      paymentHash: PAYMENT_HASH,
      destination: null,
    });
  });

  it('copies a gift memo onto the report payment', () => {
    const hash = 'ab'.repeat(32);
    expect(
      toWalletReportPayment({
        id: 'p3',
        paymentType: 'send',
        status: 'completed',
        amount: 1,
        fees: 0,
        timestamp: 0,
        method: 'spark',
        details: {
          type: 'spark',
          invoiceDetails: { invoice: 'spark1z', description: `zap:${hash}` },
        },
      }).description,
    ).toBe(`zap:${hash}`);
  });

  it('maps base-chain deposits and withdrawals to onchain with the transaction id', () => {
    for (const method of ['deposit', 'withdraw']) {
      const mapped = toWalletReportPayment({
        id: method,
        paymentType: method === 'deposit' ? 'receive' : 'send',
        status: 'completed',
        amount: 10_000,
        fees: 200,
        timestamp: 0,
        method,
        details: { type: method, txId: 'abc123' },
      });
      expect(mapped.method).toBe('onchain');
      expect(mapped.destination).toBe('abc123');
    }
  });

  it('keeps token and unknown methods and reports missing details as null', () => {
    const base = {
      id: 't',
      paymentType: 'receive',
      status: 'completed',
      amount: 1,
      fees: 0,
      timestamp: 0,
      method: 'token',
    };
    const token = toWalletReportPayment(base);
    expect(token.method).toBe('token');
    expect(token).toMatchObject({
      paymentHash: null,
      invoice: null,
      destination: null,
      description: null,
      lnurlComment: null,
    });
    expect(
      toWalletReportPayment({ ...base, method: 'something-new', details: undefined }).method,
    ).toBe('unknown');
  });
});
