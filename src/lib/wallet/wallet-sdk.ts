/**
 * Narrow adapter over `@breeztech/breez-sdk-spark/ssr`.
 *
 * The SDK keeps wallet state in IndexedDB; the recovery phrase is passed in
 * memory and never stored by this app. The adapter exposes no availability
 * check for addresses: the account's own username is the only one registered.
 */

/**
 * IndexedDB directory name the SDK uses for this app's wallet state. The SDK
 * appends the network and a hash of the wallet's identity key to this name, so
 * each wallet on a browser gets its own database.
 */
const WALLET_STORAGE_DIR = '21gifts-wallet';

/**
 * Set when `sdk.default()` (SDK init) rejects inside {@link loadWalletSdk}.
 * Never cleared; only a page reload recovers because the SDK caches a failed
 * initialisation. A rejecting `import()` does not set it.
 */
let sdkInitFailed = false;

/**
 * True while `sdk.default()` (SDK init) inside {@link loadWalletSdk} has not
 * settled. The SDK caches a pending initialisation as well, so a new attempt
 * would wait on the same promise.
 */
let sdkInitPending = false;

/**
 * True after the SDK's initialisation failed in this page, or while it is still
 * pending (for example after the connect deadline expired during it). The SDK
 * caches its initialisation promise, so only a reload recovers.
 *
 * @returns Whether the page must be reloaded before another connect attempt.
 */
export function walletNeedsReload(): boolean {
  return sdkInitFailed || sdkInitPending;
}

/**
 * Balance and identity returned by a connected wallet.
 */
export interface WalletInfo {
  /** Confirmed balance in satoshis. */
  balanceSats: number;
  /** Wallet identity public key. */
  identityPubkey: string;
}

/**
 * Opaque SDK event forwarded to listeners.
 */
export interface WalletSdkEvent {
  /** Event discriminant from the SDK. */
  type: string;
}

/** Direction of a wallet payment as the member sees it. */
export type WalletPaymentDirection = 'received' | 'sent';

/**
 * One wallet payment in the shape the history list renders.
 */
export interface WalletPayment {
  /** SDK payment id. */
  id: string;
  /** `received` for an incoming payment, `sent` for an outgoing one. */
  direction: WalletPaymentDirection;
  /** Amount in whole satoshis, without fees. */
  amountSats: number;
  /** Fees in whole satoshis: paid on top of a send, deducted from a received deposit. */
  feesSats: number;
  /** Epoch ms when the payment was created. */
  timestamp: number;
  /** Whether the payment settled, is still open, or failed. */
  status: 'completed' | 'pending' | 'failed';
  /** How the payment moved. */
  method: WalletPaymentMethod;
  /** Note the payer attached to a received payment, or `null`. */
  senderComment: string | null;
  /** Method details the payment screen shows; absent fields were not reported by the SDK. */
  info: WalletPaymentInfo;
}

/** How a payment moved: Lightning, a Spark transfer, or on-chain in or out. */
export type WalletPaymentMethod = 'lightning' | 'spark' | 'deposit' | 'withdraw' | 'other';

/** A Nostr zap request (NIP-57 kind 9734) attached to a received Lightning payment. */
export interface WalletPaymentZap {
  /** Hex public key of the zapper. */
  senderPubkey: string;
  /** The zapper's message, trimmed; empty when none. */
  content: string;
  /** Hex id of the zapped note, or `null`. */
  noteId: string | null;
}

/** Method details of one payment. */
export interface WalletPaymentInfo {
  /** Invoice description or the Spark invoice's description. */
  description?: string;
  /** BOLT11 invoice or Spark invoice. */
  invoice?: string;
  /** Lightning payment hash (hex). */
  paymentHash?: string;
  /** Lightning preimage (hex), the proof of payment once settled. */
  preimage?: string;
  /** Node the Lightning invoice belongs to (hex). */
  destinationPubkey?: string;
  /** Lightning address that was paid. */
  lnAddress?: string;
  /** Comment sent along with a Lightning-address payment. */
  lnurlComment?: string;
  /** Zap request of a received zap. */
  zap?: WalletPaymentZap;
  /** On-chain transaction id. */
  txId?: string;
  /** Output index of a deposit. */
  vout?: number;
}

/**
 * One page of the wallet's payment list.
 */
export interface WalletPaymentPage {
  /** Number of payments to skip from the newest. */
  offset: number;
  /** Maximum number of payments to return. */
  limit: number;
}

/**
 * Narrow view of an SDK payment that {@link toWalletPayment} reads.
 */
export interface SdkPaymentLike {
  /** SDK payment id. */
  id: string;
  /** `receive` or `send`. */
  paymentType: string;
  /** `completed`, `pending`, or `failed`. */
  status: string;
  /** Amount in satoshis (the SDK uses `bigint`). */
  amount: bigint | number;
  /** Fees in satoshis. */
  fees?: bigint | number;
  /** Creation time in epoch seconds. */
  timestamp: number;
  /** `lightning`, `spark`, `token`, `deposit`, `withdraw`, or `unknown`. */
  method?: string;
  /** Method-specific details. */
  details?: SdkPaymentDetailsLike | undefined;
}

/** The parts of the SDK's payment details (lightning, spark, deposit, withdraw) the app reads. */
export interface SdkPaymentDetailsLike {
  /** Detail variant. */
  type: string;
  /** Lightning invoice description. */
  description?: string;
  /** Lightning invoice. */
  invoice?: string;
  /** Node the Lightning invoice belongs to. */
  destinationPubkey?: string;
  /** Lightning HTLC: payment hash and, once settled, the preimage. */
  htlcDetails?: { paymentHash: string; preimage?: string };
  /** Spark invoice and its description. */
  invoiceDetails?: { description?: string; invoice: string };
  /** Lightning-address send: the address and the comment sent along. */
  lnurlPayInfo?: { lnAddress?: string; comment?: string };
  /** Lightning-address receive: the payer note and a zap request. */
  lnurlReceiveMetadata?: { senderComment?: string; nostrZapRequest?: string };
  /** On-chain transaction id. */
  txId?: string;
  /** Output index of a deposit. */
  vout?: number;
}

/** A 32-byte value in lowercase hex: a Nostr public key or event id. */
const HEX_32 = /^[0-9a-f]{64}$/;

/**
 * Reads a zap request (NIP-57 kind 9734) from its JSON. A public key or zapped
 * note id that is not 64 lowercase hex characters is not accepted.
 *
 * @param raw - The zap request JSON the SDK stored.
 * @returns The zapper, message, and zapped note, or `null` when it is not a zap request.
 */
function parseZap(raw: string | undefined): WalletPaymentZap | null {
  if (raw === undefined) {
    return null;
  }
  let event: unknown;
  try {
    event = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof event !== 'object' || event === null) {
    return null;
  }
  const { kind, pubkey, content, tags } = event as Record<string, unknown>;
  if (kind !== 9734 || typeof pubkey !== 'string' || !HEX_32.test(pubkey)) {
    return null;
  }
  const note = (Array.isArray(tags) ? tags : []).find(
    (tag: unknown): tag is [string, string] =>
      Array.isArray(tag) && tag[0] === 'e' && typeof tag[1] === 'string' && HEX_32.test(tag[1]),
  );
  return {
    senderPubkey: pubkey,
    content: typeof content === 'string' ? content.trim() : '',
    noteId: note === undefined ? null : note[1],
  };
}

/**
 * Collects the details the payment screen shows.
 *
 * @param details - SDK payment details.
 * @returns The present fields.
 */
function paymentInfo(details: SdkPaymentDetailsLike | undefined): WalletPaymentInfo {
  const info: WalletPaymentInfo = {};
  if (details === undefined) {
    return info;
  }
  const description = (details.description ?? details.invoiceDetails?.description)?.trim();
  if (description !== undefined && description !== '') {
    info.description = description;
  }
  const invoice = details.invoice ?? details.invoiceDetails?.invoice;
  if (invoice !== undefined) {
    info.invoice = invoice;
  }
  if (details.htlcDetails !== undefined) {
    info.paymentHash = details.htlcDetails.paymentHash;
    if (details.htlcDetails.preimage !== undefined) {
      info.preimage = details.htlcDetails.preimage;
    }
  }
  if (details.destinationPubkey !== undefined) {
    info.destinationPubkey = details.destinationPubkey;
  }
  if (details.lnurlPayInfo?.lnAddress !== undefined) {
    info.lnAddress = details.lnurlPayInfo.lnAddress;
  }
  const comment = details.lnurlPayInfo?.comment?.trim();
  if (comment !== undefined && comment !== '') {
    info.lnurlComment = comment;
  }
  const zap = parseZap(details.lnurlReceiveMetadata?.nostrZapRequest);
  if (zap !== null) {
    info.zap = zap;
  }
  if (details.txId !== undefined) {
    info.txId = details.txId;
  }
  if (details.vout !== undefined) {
    info.vout = details.vout;
  }
  return info;
}

const METHODS: readonly WalletPaymentMethod[] = ['lightning', 'spark', 'deposit', 'withdraw'];

/**
 * Maps an SDK payment to the {@link WalletPayment} the history list and the
 * payment screen render: fees, method (`token` and unknown methods are
 * `other`), and the method details (description, invoice, payment hash and
 * preimage, node, paid Lightning address and comment, a parsed zap request,
 * transaction id and output). A blank note, description, or comment counts as
 * none; a zap request that is not valid kind-9734 JSON is left out.
 *
 * @param payment - Payment from the SDK's `listPayments`.
 * @returns The mapped payment.
 */
export function toWalletPayment(payment: SdkPaymentLike): WalletPayment {
  const details = payment.details;
  const rawComment =
    details !== undefined && details.type === 'lightning'
      ? details.lnurlReceiveMetadata?.senderComment
      : undefined;
  const comment = typeof rawComment === 'string' ? rawComment.trim() : '';
  return {
    id: payment.id,
    direction: payment.paymentType === 'send' ? 'sent' : 'received',
    amountSats: Number(payment.amount),
    feesSats: Number(payment.fees ?? 0),
    timestamp: payment.timestamp * 1000,
    status:
      payment.status === 'pending' || payment.status === 'failed' ? payment.status : 'completed',
    method: METHODS.find((method) => method === payment.method) ?? 'other',
    senderComment: comment === '' ? null : comment,
    info: paymentInfo(details),
  };
}

/**
 * A live SDK connection.
 */
export interface WalletConnection {
  /**
   * Reads the current balance and identity key, optionally waiting for the SDK
   * to synchronize first.
   *
   * @param options - Set `ensureSynced` to wait for synchronized wallet state.
   * @returns Balance and identity public key.
   */
  getInfo(options?: { ensureSynced?: boolean }): Promise<WalletInfo>;
  /**
   * Registers an event listener on the connection.
   *
   * @param onEvent - Callback invoked for each SDK event.
   * @returns Listener id assigned by the SDK.
   */
  addEventListener(onEvent: (event: WalletSdkEvent) => void): Promise<string>;
  /**
   * Registers `username` as this wallet's address on the configured domain.
   *
   * @param username - The account's username.
   * @returns Resolves once the domain accepted the registration.
   */
  registerAddress(username: string): Promise<void>;
  /**
   * Lists Bitcoin payments newest first (token payments are left out, since
   * their amounts are not satoshis).
   *
   * @param page - Offset and limit.
   * @returns The payments on that page.
   */
  listPayments(page: WalletPaymentPage): Promise<WalletPayment[]>;
  /**
   * Reads one payment by its SDK id.
   *
   * @param id - SDK payment id.
   * @returns The payment.
   */
  getPayment(id: string): Promise<WalletPayment>;
  /**
   * Reads a pasted payment request or address with the SDK's `parse`.
   *
   * @param input - Text as pasted, trimmed.
   * @returns What the text pays and whether the app can pay it.
   * @throws When the SDK cannot read the text or cannot reach the receiver's server.
   */
  parse(input: string): Promise<WalletTarget>;
  /**
   * Prepares a payment and reads its amount and fee. Nothing is sent yet.
   *
   * @param request - Payment request text, or a receiver that asks for an amount.
   * @returns The prepared payment and the function that sends it.
   * @throws When the SDK cannot prepare the payment, or it would pay a token
   *   rather than Bitcoin.
   */
  prepare(request: WalletPayRequest): Promise<WalletPreparedPayment>;
  /**
   * Closes the connection.
   *
   * @returns Resolves when the SDK has disconnected.
   */
  disconnect(): Promise<void>;
}

/**
 * Receiver details the SDK needs to ask a receiver's server for a payment
 * request. Opaque to the app; only the adapter reads it.
 */
export interface WalletLnurlRequest {
  /** SDK pay-request details, passed back unchanged to `prepare`. */
  readonly details: unknown;
}

/**
 * What a pasted text pays, as read by {@link WalletConnection.parse}.
 *
 * - `request`: a payment request or an address the SDK pays from `input`.
 *   `amountSats` is `null` when the text carries no amount. `recipient` is the
 *   shortened request or address, never the issuer's description.
 *   `amountFromUri` marks an amount taken from a BIP21 URI for a method
 *   without one; it has to be passed to `prepare`.
 * - `lnurl`: an address whose server issues the request for a chosen amount,
 *   between `minSats` and `maxSats`, with a comment of at most
 *   `commentMaxLength` characters (`0` means no comment).
 * - `onchain`: a Bitcoin mainnet address on the base chain. `address` is what
 *   `prepare` pays, `recipient` its shortened form. `amountSats` is the amount
 *   of a BIP21 URI that offers only this address, otherwise `null`.
 * - `unsupported`: anything else the SDK recognised but the app does not pay,
 *   including a BOLT11 request for less than one whole sat, a BIP21 URI
 *   that names an asset (a token, not Bitcoin), and an address of a test network.
 */
export type WalletTarget =
  | {
      type: 'request';
      input: string;
      amountSats: number | null;
      recipient: string;
      amountFromUri?: true;
    }
  | {
      type: 'lnurl';
      request: WalletLnurlRequest;
      minSats: number;
      maxSats: number;
      commentMaxLength: number;
      recipient: string;
    }
  | { type: 'onchain'; address: string; amountSats: number | null; recipient: string }
  | { type: 'unsupported' };

/**
 * Payment to prepare. `input` pays a request or address text (with
 * `amountSats` when the text carries none; a base-chain address always needs
 * it). `lnurl` asks the receiver's
 * server for a request of `amountSats`, with an optional comment.
 */
export type WalletPayRequest =
  | { type: 'input'; input: string; amountSats?: number }
  | { type: 'lnurl'; request: WalletLnurlRequest; amountSats: number; comment?: string };

/** Confirmation speed of a payment to a base-chain address, as the SDK names it. */
export type OnchainSpeed = 'fast' | 'medium' | 'slow';

/**
 * Fee quote of a payment to a base-chain address: the whole-sat fee of each
 * speed (the fee the wallet pays plus the network fee), and when the quote
 * expires.
 */
export interface WalletOnchainQuote {
  /** Whole sats of fee for each speed. */
  fees: Record<OnchainSpeed, number>;
  /** Epoch ms after which the quote may no longer be sent. */
  expiresAtMs: number;
}

/**
 * A prepared payment: what will leave the wallet, and how to send it.
 */
export interface WalletPreparedPayment {
  /** Whole sats the receiver gets. */
  amountSats: number;
  /** Whole sats of fee on top of `amountSats` (the medium speed for a base-chain address). */
  feeSats: number;
  /** Fee quote when the payment goes to a base-chain address. */
  onchain?: WalletOnchainQuote;
  /**
   * Sends the prepared payment.
   *
   * @param speed - Confirmation speed for a base-chain address (default `medium`);
   *   ignored for other payments.
   * @returns Resolves when the SDK reports the payment sent.
   */
  send(speed?: OnchainSpeed): Promise<void>;
}

/** Characters kept at each end of a shortened request or address. */
const SHORT_HEAD = 10;
const SHORT_TAIL = 6;

/**
 * Shortens a long request or address for the confirm screen.
 *
 * @param value - Full text.
 * @returns The text, or its start and end around an ellipsis.
 */
function shorten(value: string): string {
  if (value.length <= SHORT_HEAD + SHORT_TAIL + 1) {
    return value;
  }
  return `${value.slice(0, SHORT_HEAD)}…${value.slice(-SHORT_TAIL)}`;
}

/** Narrow view of the SDK's parsed input that the adapter reads. */
type ParsedInput =
  | {
      type: 'bolt11Invoice';
      amountMsat?: number;
      invoice: { bolt11: string };
    }
  | {
      type: 'sparkInvoice';
      invoice: string;
      amount?: string;
      tokenIdentifier?: string;
    }
  | { type: 'sparkAddress'; address: string }
  | { type: 'lightningAddress'; address: string; payRequest: LnurlDetails }
  | ({ type: 'lnurlPay' } & LnurlDetails)
  | { type: 'bitcoinAddress'; address: string; network: string }
  | { type: 'bip21'; amountSat?: number; assetId?: string; paymentMethods: ParsedInput[] }
  | { type: string };

/** Narrow view of the SDK's pay-request details. */
interface LnurlDetails {
  minSendable: number;
  maxSendable: number;
  commentAllowed: number;
  domain: string;
  address?: string;
}

/**
 * Maps one parsed SDK input to a {@link WalletTarget}.
 *
 * @param parsed - SDK `parse` result.
 * @returns The target, or `null` when this input is not one the app pays.
 */
function targetFromParsed(parsed: ParsedInput): WalletTarget | null {
  switch (parsed.type) {
    case 'bolt11Invoice': {
      const bolt11 = parsed as Extract<ParsedInput, { type: 'bolt11Invoice' }>;
      if (bolt11.amountMsat !== undefined && bolt11.amountMsat < 1000) {
        return { type: 'unsupported' };
      }
      return {
        type: 'request',
        input: bolt11.invoice.bolt11,
        amountSats: bolt11.amountMsat === undefined ? null : Math.floor(bolt11.amountMsat / 1000),
        recipient: shorten(bolt11.invoice.bolt11),
      };
    }
    case 'sparkInvoice': {
      const invoice = parsed as Extract<ParsedInput, { type: 'sparkInvoice' }>;
      if (invoice.tokenIdentifier !== undefined) {
        return { type: 'unsupported' };
      }
      return {
        type: 'request',
        input: invoice.invoice,
        amountSats: invoice.amount === undefined ? null : Number(invoice.amount),
        recipient: shorten(invoice.invoice),
      };
    }
    case 'sparkAddress': {
      const address = (parsed as Extract<ParsedInput, { type: 'sparkAddress' }>).address;
      return { type: 'request', input: address, amountSats: null, recipient: shorten(address) };
    }
    case 'lightningAddress': {
      const address = parsed as Extract<ParsedInput, { type: 'lightningAddress' }>;
      return lnurlTarget(address.payRequest, address.address);
    }
    case 'lnurlPay': {
      const details = parsed as Extract<ParsedInput, { type: 'lnurlPay' }>;
      return lnurlTarget(details, details.address ?? details.domain);
    }
    case 'bitcoinAddress': {
      const bitcoin = parsed as Extract<ParsedInput, { type: 'bitcoinAddress' }>;
      if (bitcoin.network !== 'bitcoin') {
        return { type: 'unsupported' };
      }
      return {
        type: 'onchain',
        address: bitcoin.address,
        amountSats: null,
        recipient: shorten(bitcoin.address),
      };
    }
    case 'bip21': {
      const bip21 = parsed as Extract<ParsedInput, { type: 'bip21' }>;
      if (bip21.assetId !== undefined) {
        return { type: 'unsupported' };
      }
      const methods = bip21.paymentMethods;
      let onchain: Extract<WalletTarget, { type: 'onchain' }> | null = null;
      for (const method of methods) {
        const target = targetFromParsed(method);
        if (target === null || target.type === 'unsupported') {
          continue;
        }
        if (target.type === 'onchain') {
          onchain ??= target;
          continue;
        }
        if (
          target.type === 'request' &&
          target.amountSats === null &&
          bip21.amountSat !== undefined
        ) {
          return { ...target, amountSats: bip21.amountSat, amountFromUri: true };
        }
        return target;
      }
      if (onchain === null) {
        return null;
      }
      const uriSats = bip21.amountSat;
      return uriSats !== undefined && uriSats >= 1
        ? { ...onchain, amountSats: Math.floor(uriSats) }
        : onchain;
    }
    default:
      return null;
  }
}

/**
 * Builds an `lnurl` target from SDK pay-request details (millisat bounds).
 * Bounds that leave no whole sat (at least 1) make the receiver unsupported.
 *
 * @param details - SDK pay-request details.
 * @param recipient - Address or domain shown on the confirm screen.
 * @returns The `lnurl` target, or `unsupported` when the bounds leave no whole sat.
 */
function lnurlTarget(details: LnurlDetails, recipient: string): WalletTarget {
  const minSats = Math.max(1, Math.ceil(details.minSendable / 1000));
  const maxSats = Math.floor(details.maxSendable / 1000);
  if (minSats > maxSats) {
    return { type: 'unsupported' };
  }
  return {
    type: 'lnurl',
    request: { details },
    minSats,
    maxSats,
    commentMaxLength: details.commentAllowed,
    recipient,
  };
}

/** Narrow view of one speed of the SDK's on-chain fee quote. */
interface SpeedFeeQuote {
  userFeeSat: number;
  l1BroadcastFeeSat: number;
}

/** Narrow view of the SDK's prepared send method that the adapter reads. */
type PreparedMethod =
  | { type: 'bolt11Invoice'; lightningFeeSats: number }
  | { type: 'sparkAddress'; fee: string }
  | { type: 'sparkInvoice'; fee: string }
  | {
      type: 'bitcoinAddress';
      feeQuote: {
        expiresAt: number;
        speedFast: SpeedFeeQuote;
        speedMedium: SpeedFeeQuote;
        speedSlow: SpeedFeeQuote;
      };
    }
  | { type: string };

/**
 * Reads the SDK's on-chain fee quote. The fee of a speed is the wallet's fee
 * plus the network fee. The SDK gives the expiry in epoch seconds.
 *
 * @param method - SDK prepared payment method of type `bitcoinAddress`.
 * @returns Fees per speed and the expiry in epoch ms.
 */
function onchainQuoteOf(
  method: Extract<PreparedMethod, { type: 'bitcoinAddress' }>,
): WalletOnchainQuote {
  const quote = method.feeQuote;
  const total = (speed: SpeedFeeQuote): number => speed.userFeeSat + speed.l1BroadcastFeeSat;
  return {
    fees: {
      fast: total(quote.speedFast),
      medium: total(quote.speedMedium),
      slow: total(quote.speedSlow),
    },
    expiresAtMs: quote.expiresAt * 1000,
  };
}

/**
 * Reads the fee of a prepared send. A BOLT11 request is sent over Lightning
 * (`preferSpark: false`), so its fee is `lightningFeeSats`; the SDK's optional
 * `sparkTransferFeeSats` belongs to the Spark route, which is not used.
 *
 * @param method - SDK prepared payment method.
 * @returns Whole sats of fee.
 * @throws When the method is not one the app pays.
 */
function feeOf(method: PreparedMethod): number {
  if (method.type === 'bolt11Invoice') {
    return (method as Extract<PreparedMethod, { type: 'bolt11Invoice' }>).lightningFeeSats;
  }
  if (method.type === 'sparkAddress' || method.type === 'sparkInvoice') {
    return Number((method as { fee: string }).fee);
  }
  throw new Error('Unsupported payment method');
}

/**
 * Lazily loaded wallet SDK surface.
 */
export interface WalletSdk {
  /**
   * Opens a wallet from a mnemonic and API key.
   *
   * @param mnemonic - BIP-39 recovery phrase.
   * @param apiKey - Breez API key.
   * @param lnurlDomain - Host that serves the wallet's address (the app's own host).
   * @returns A live connection.
   */
  connect(mnemonic: string, apiKey: string, lnurlDomain: string): Promise<WalletConnection>;
}

/**
 * Dynamically imports the Breez Spark SSR package, initializes it, and returns
 * a narrow {@link WalletSdk} wrapper. The only module that names the package.
 * A rejected or still pending initialisation is reported by {@link walletNeedsReload}.
 *
 * @returns A {@link WalletSdk} whose `connect` opens a mainnet wallet and whose
 * `getInfo` can wait for synchronized state.
 * @throws When the SDK module cannot be imported or its initialisation fails.
 */
export async function loadWalletSdk(): Promise<WalletSdk> {
  const sdk = await import('@breeztech/breez-sdk-spark/ssr');
  sdkInitPending = true;
  try {
    await sdk.default();
  } catch (error: unknown) {
    sdkInitFailed = true;
    throw error;
  } finally {
    sdkInitPending = false;
  }
  return {
    async connect(
      mnemonic: string,
      apiKey: string,
      lnurlDomain: string,
    ): Promise<WalletConnection> {
      const config = sdk.defaultConfig('mainnet');
      config.apiKey = apiKey;
      config.lnurlDomain = lnurlDomain;
      const handle = await sdk.connect({
        config,
        seed: { type: 'mnemonic', mnemonic },
        storageDir: WALLET_STORAGE_DIR,
      });
      return {
        async getInfo(options?: { ensureSynced?: boolean }): Promise<WalletInfo> {
          const request = options?.ensureSynced === true ? { ensureSynced: true } : {};
          const info = await handle.getInfo(request);
          return {
            balanceSats: info.balanceSats,
            identityPubkey: info.identityPubkey,
          };
        },
        async addEventListener(onEvent: (event: WalletSdkEvent) => void): Promise<string> {
          return handle.addEventListener({ onEvent });
        },
        async registerAddress(username: string): Promise<void> {
          await handle.registerLightningAddress({ username });
        },
        async listPayments(page: WalletPaymentPage): Promise<WalletPayment[]> {
          const response = await handle.listPayments({
            offset: page.offset,
            limit: page.limit,
            sortAscending: false,
            assetFilter: { type: 'bitcoin' },
          });
          return response.payments.map(toWalletPayment);
        },
        async getPayment(id: string): Promise<WalletPayment> {
          const response = await handle.getPayment({ paymentId: id });
          return toWalletPayment(response.payment);
        },
        async parse(input: string): Promise<WalletTarget> {
          const parsed = (await handle.parse(input)) as ParsedInput;
          return targetFromParsed(parsed) ?? { type: 'unsupported' };
        },
        async prepare(request: WalletPayRequest): Promise<WalletPreparedPayment> {
          if (request.type === 'lnurl') {
            const prepared = await handle.prepareLnurlPay({
              amount: BigInt(request.amountSats),
              payRequest: request.request.details as Parameters<
                typeof handle.prepareLnurlPay
              >[0]['payRequest'],
              ...(request.comment === undefined ? {} : { comment: request.comment }),
            });
            return {
              amountSats: prepared.amountSats,
              feeSats: prepared.feeSats,
              async send(): Promise<void> {
                await handle.lnurlPay({ prepareResponse: prepared });
              },
            };
          }
          const prepared = await handle.prepareSendPayment({
            paymentRequest: { type: 'input', input: request.input },
            ...(request.amountSats === undefined ? {} : { amount: BigInt(request.amountSats) }),
          });
          const methodToken = (prepared.paymentMethod as { tokenIdentifier?: string })
            .tokenIdentifier;
          if (prepared.tokenIdentifier !== undefined || methodToken !== undefined) {
            throw new Error('Unsupported payment method');
          }
          const method = prepared.paymentMethod as PreparedMethod;
          if (method.type === 'bitcoinAddress') {
            const onchain = onchainQuoteOf(
              method as Extract<PreparedMethod, { type: 'bitcoinAddress' }>,
            );
            return {
              amountSats: Number(prepared.amount),
              feeSats: onchain.fees.medium,
              onchain,
              async send(speed: OnchainSpeed = 'medium'): Promise<void> {
                await handle.sendPayment({
                  prepareResponse: prepared,
                  options: { type: 'bitcoinAddress', confirmationSpeed: speed },
                });
              },
            };
          }
          const feeSats = feeOf(method);
          return {
            amountSats: Number(prepared.amount),
            feeSats,
            async send(): Promise<void> {
              await handle.sendPayment(
                prepared.paymentMethod.type === 'bolt11Invoice'
                  ? {
                      prepareResponse: prepared,
                      options: { type: 'bolt11Invoice', preferSpark: false },
                    }
                  : { prepareResponse: prepared },
              );
            },
          };
        },
        async disconnect(): Promise<void> {
          await handle.disconnect();
        },
      };
    },
  };
}
