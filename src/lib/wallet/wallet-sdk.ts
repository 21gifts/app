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
  /** Epoch ms when the payment was created. */
  timestamp: number;
  /** Whether the payment settled, is still open, or failed. */
  status: 'completed' | 'pending' | 'failed';
  /** Note the payer attached to a received payment, or `null`. */
  senderComment: string | null;
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
  /** Creation time in epoch seconds. */
  timestamp: number;
  /** Method-specific details; only the received-payment note is read. */
  details?: { type: string; lnurlReceiveMetadata?: { senderComment?: string } } | undefined;
}

/**
 * Maps an SDK payment to the {@link WalletPayment} the history list renders.
 * A blank note counts as no note.
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
    timestamp: payment.timestamp * 1000,
    status:
      payment.status === 'pending' || payment.status === 'failed' ? payment.status : 'completed',
    senderComment: comment === '' ? null : comment,
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
   * @throws When the SDK cannot prepare the payment.
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
 *   `amountSats` is `null` when the text carries no amount. `amountFromUri`
 *   marks an amount taken from a BIP21 URI for a method without one; it has
 *   to be passed to `prepare`.
 * - `lnurl`: an address whose server issues the request for a chosen amount,
 *   between `minSats` and `maxSats`, with a comment of at most
 *   `commentMaxLength` characters (`0` means no comment).
 * - `onchain`: a Bitcoin address on the base chain, not supported yet.
 * - `unsupported`: anything else the SDK recognised but the app does not pay.
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
  | { type: 'onchain' }
  | { type: 'unsupported' };

/**
 * Payment to prepare. `input` pays a request or address text (with
 * `amountSats` when the text carries none). `lnurl` asks the receiver's
 * server for a request of `amountSats`, with an optional comment.
 */
export type WalletPayRequest =
  | { type: 'input'; input: string; amountSats?: number }
  | { type: 'lnurl'; request: WalletLnurlRequest; amountSats: number; comment?: string };

/**
 * A prepared payment: what will leave the wallet, and how to send it.
 */
export interface WalletPreparedPayment {
  /** Whole sats the receiver gets. */
  amountSats: number;
  /** Whole sats of fee on top of `amountSats`. */
  feeSats: number;
  /**
   * Sends the prepared payment.
   *
   * @returns Resolves when the SDK reports the payment sent.
   */
  send(): Promise<void>;
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
      description?: string;
      invoice: { bolt11: string };
    }
  | {
      type: 'sparkInvoice';
      invoice: string;
      amount?: string;
      tokenIdentifier?: string;
      description?: string;
    }
  | { type: 'sparkAddress'; address: string }
  | { type: 'lightningAddress'; address: string; payRequest: LnurlDetails }
  | ({ type: 'lnurlPay' } & LnurlDetails)
  | { type: 'bitcoinAddress' }
  | { type: 'bip21'; amountSat?: number; paymentMethods: ParsedInput[] }
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
      const description = bolt11.description?.trim() ?? '';
      return {
        type: 'request',
        input: bolt11.invoice.bolt11,
        amountSats: bolt11.amountMsat === undefined ? null : Math.floor(bolt11.amountMsat / 1000),
        recipient: description === '' ? shorten(bolt11.invoice.bolt11) : description,
      };
    }
    case 'sparkInvoice': {
      const invoice = parsed as Extract<ParsedInput, { type: 'sparkInvoice' }>;
      if (invoice.tokenIdentifier !== undefined) {
        return { type: 'unsupported' };
      }
      const description = invoice.description?.trim() ?? '';
      return {
        type: 'request',
        input: invoice.invoice,
        amountSats: invoice.amount === undefined ? null : Number(invoice.amount),
        recipient: description === '' ? shorten(invoice.invoice) : description,
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
    case 'bitcoinAddress':
      return { type: 'onchain' };
    case 'bip21': {
      const bip21 = parsed as Extract<ParsedInput, { type: 'bip21' }>;
      const methods = bip21.paymentMethods;
      let onchain = false;
      for (const method of methods) {
        const target = targetFromParsed(method);
        if (target === null || target.type === 'unsupported') {
          continue;
        }
        if (target.type === 'onchain') {
          onchain = true;
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
      return onchain ? { type: 'onchain' } : null;
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

/** Narrow view of the SDK's prepared send method that the adapter reads. */
type PreparedMethod =
  | { type: 'bolt11Invoice'; lightningFeeSats: number }
  | { type: 'sparkAddress'; fee: string }
  | { type: 'sparkInvoice'; fee: string }
  | { type: string };

/**
 * Reads the fee of a prepared send.
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
          const feeSats = feeOf(prepared.paymentMethod as PreparedMethod);
          return {
            amountSats: Number(prepared.amount),
            feeSats,
            async send(): Promise<void> {
              await handle.sendPayment({ prepareResponse: prepared });
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
