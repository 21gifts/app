'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useWallet, type WalletViewStatus } from '@/hooks/useWallet';
import { useWalletSetup } from '@/hooks/useWalletSetup';
import { LnurlRelayError, postLnurlInvoice, postLnurlPayRequest } from '@/lib/api';
import { encodeLnurl } from '@/lib/lnurl';
import { lnurlPayAddress } from '@/lib/pay-link';
import { fetchMemberSparkInvoice, fetchShopChargeInvoice } from '@/lib/pos';
import { visualPin } from '@/lib/visual-pin';
import { lnurlRelayTarget, ownShop, type OwnShop } from '@/lib/wallet/lnurl-relay';
import { canUnlockWallet } from '@/lib/wallet/wallet-phrase';
import { needsWalletSetup } from '@/lib/wallet/wallet-setup';
import { useAuthStore } from '@/stores/auth-store';
import { useWalletStore } from '@/stores/wallet-store';
import type { OnchainSpeed, WalletPayRequest, WalletTarget } from '@/lib/wallet/wallet-sdk';
import {
  parseWalletInput,
  payFromWallet,
  type WalletOnchainFees,
  type WalletSendResult,
} from '@/lib/wallet/wallet-service';

/**
 * Whether the wallet can send right now: connected and ready, for an account
 * that is in wallet mode and not in the one-time wallet setup.
 *
 * @returns `true` while the store is `ready` and the account can use the wallet.
 */
function walletCanSend(): boolean {
  return (
    useWalletStore.getState().status === 'ready' &&
    canUnlockWallet(useAuthStore.getState().account) &&
    !needsWalletSetup(useAuthStore.getState().account)
  );
}

/**
 * Why the input step shows an alert.
 *
 * - `invalid`: not a payment request or address.
 * - `unreachable`: the receiver's server did not answer this browser.
 * - `notPayable`: the api does not read this address as one it can pay.
 * - `notFound`: the receiver's server does not know this address.
 * - `relayUnreachable`: the receiver's server did not answer the api.
 * - `unsupported`: recognised but not payable from this wallet.
 * - `insufficient`: the balance does not cover amount and fee.
 * - `failed`: prepare or send failed, or the wallet had no connection when the
 *   text was read.
 * - `unavailable`: a step needs the wallet, and this account has no wallet it
 *   can use here (the wallet is not configured, or the account cannot hold one).
 * - `unreadable`: reading the text ended in an unexpected error.
 */
export type WalletSendError =
  | 'invalid'
  | 'unreachable'
  | 'notPayable'
  | 'notFound'
  | 'relayUnreachable'
  | 'unsupported'
  | 'insufficient'
  | 'failed'
  | 'unavailable'
  | 'unreadable';

/**
 * What a step that needs the open wallet waits for: `opening` while the
 * wallet opens, `error` when it could not be opened (or its one-time setup
 * gave up), so **Try again** shows.
 */
export type WalletSendWait = 'opening' | 'error';

/**
 * How long a Playwright-only pin that opens the wallet waits before it shows
 * the quote (`?visual=send-confirm-opens`, or **Try again** under
 * `?visual=send-confirm-wallet-error`).
 */
export const WALLET_SEND_PIN_OPEN_MS = 1_500;

/**
 * Lightning address or LNURL on another host, read through the api. `target`
 * is the api's normalised target for `POST /lnurl/invoice`.
 */
export interface WalletSendRelayTarget {
  type: 'relay';
  target: string;
  minSats: number;
  maxSats: number;
  commentMaxLength: number;
  recipient: string;
}

/**
 * LNURL receiver read by the wallet. `member` is the lower-case username when
 * it is a 21.gifts member on this app's own host (see `ownShop`) without an
 * open charge, so the amount is first asked as a Spark invoice.
 */
export type WalletSendLnurlTarget = Extract<WalletTarget, { type: 'lnurl' }> & {
  member?: string;
};

/**
 * Base-chain address that still needs an amount. `minSats` is the smallest
 * amount the SDK sends to it, once a prepare refused a smaller one.
 */
export type WalletSendOnchainTarget = Extract<WalletTarget, { type: 'onchain' }> & {
  minSats?: number;
};

/** Receiver that still needs an amount. */
export type WalletSendAmountTarget =
  | Extract<WalletTarget, { type: 'request' }>
  | WalletSendLnurlTarget
  | WalletSendRelayTarget
  | WalletSendOnchainTarget;

/**
 * Speed choice on the confirm step of a payment to a base-chain address:
 * the fee of each speed, the largest fee the balance covers, the chosen
 * speed, and `renewed` when the quote expired and this is the new one.
 */
export interface WalletSendOnchain extends WalletOnchainFees {
  /** Chosen speed; `feeSats` of the confirm step is its fee. */
  speed: OnchainSpeed;
  /** Set when an expired quote was replaced by this one; nothing was sent. */
  renewed?: true;
}

/** Step of the `/wallet` send flow. */
export type WalletSendState =
  | { step: 'input'; error: WalletSendError | null }
  | {
      step: 'amount';
      target: WalletSendAmountTarget;
      amountError: boolean;
      /** Set when the receiver refused the comment as too long. */
      commentError?: true;
    }
  | {
      /**
       * The confirm step before its fee is known: the payment waits for the
       * wallet to open, then is prepared and becomes `confirm` on its own.
       */
      step: 'quote';
      recipient: string;
      amountSats: number;
    }
  | {
      step: 'confirm';
      recipient: string;
      amountSats: number;
      feeSats: number;
      /** Speed choice when the payment goes to a base-chain address. */
      onchain?: WalletSendOnchain;
    }
  | { step: 'sent'; amountSats: number; recipient: string };

/** State and actions of the `/wallet` send flow. */
export interface UseWalletSendResult {
  /** Current step. */
  state: WalletSendState;
  /** True while parse, prepare, or send runs, or a read or quote waits for the wallet. */
  busy: boolean;
  /**
   * What the current step waits for, or `null`: set while a read on the
   * input step, or the `quote` step, waits for the wallet to open.
   */
  walletWait: WalletSendWait | null;
  /**
   * **Try again** while `walletWait` is `error`: opens the wallet again (or
   * runs its one-time setup again). The waiting step continues on its own
   * once the wallet is ready.
   */
  retryWallet: () => void;
  /**
   * True only while a confirmed payment is being sent; `busy` without
   * `sending` on the confirm step is the renewal of an expired quote.
   */
  sending: boolean;
  /** Pasted text. */
  text: string;
  /** Updates the pasted text and clears an input alert. */
  setText: (value: string) => void;
  /** Optional comment for a receiver that accepts one. */
  comment: string;
  /** Updates the comment. */
  setComment: (value: string) => void;
  /** Reads the pasted text and moves to amount, confirm, or an alert. */
  submitInput: () => void;
  /**
   * Prepares the payment for the entered amount.
   *
   * @param sats - Whole sats from the amount field, or `null` when it cannot be read.
   */
  submitAmount: (sats: number | null) => void;
  /**
   * Chooses the speed of a payment to a base-chain address on the confirm
   * step. A speed whose fee the balance does not cover is ignored.
   *
   * @param speed - The speed to send with.
   */
  setSpeed: (speed: OnchainSpeed) => void;
  /** Sends the confirmed payment once. */
  confirm: () => void;
  /**
   * Closes the amount, quote, or confirm step (back to input) or the sent step. While
   * a confirm send is in flight it closes nothing and still consumes Back;
   * while an expired quote is being renewed it closes the step and drops the
   * renewal.
   *
   * @returns `true` when Back is consumed (a step was closed or a send is in
   *   flight), `false` when no step is open or the flow is pinned.
   */
  cancel: () => boolean;
  /**
   * Leaves the flow on an empty input step without an alert, dropping a read,
   * prepare, or quote renewal in flight. Does nothing while a confirm send is
   * in flight or the flow is pinned.
   */
  abandon: () => void;
}

/**
 * Recipient, amount, and fee shown by the visual fixtures. `fixedLink` is the
 * point-of-sale QR of `shop@21.gifts`, `fixedAmountSats` its open charge, and
 * `fixedFeeSats` the Lightning fee when that charge is paid over Lightning
 * (paid with the shop's Spark invoice, the fee is `feeSats`).
 * `memberRecipient` is a 21.gifts member on this host, paid `amountSats`
 * with that member's Spark invoice (fee `feeSats`).
 */
export const WALLET_SEND_VISUAL_FIXTURE = {
  recipient: 'bob@example.com',
  amountSats: 2_100,
  feeSats: 0,
  minSats: 1,
  maxSats: 1_000_000,
  commentMaxLength: 140,
  requestRecipient: 'sp1qexample…a9f2',
  fixedLink: `https://21.gifts/pl/?lightning=${encodeLnurl('https://21.gifts/.well-known/lnurlp/shop')}`,
  fixedAmountSats: 7_000,
  fixedFeeSats: 3,
  memberRecipient: 'alice@21.gifts',
  onchainAddress: 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq',
  onchainRecipient: 'bc1qar0srr…wf5mdq',
  onchainAmountSats: 50_000,
  onchainMinSats: 294,
  onchainFees: { fast: 2_840, medium: 1_420, slow: 710 },
  onchainSpendableFeeSats: 950_000,
  onchainLowSpendableFeeSats: 2_000,
} as const;

/** Options of one prepare in {@link useWalletSend}. */
interface PrepareOptions {
  /** Amount the prepared payment must have, or the result counts as failed. */
  expectedSats?: number;
  /** Runs instead of the input alert when the result fails (but not when the balance is too low). */
  fallback?: () => void;
  /** Base-chain address whose amount step reopens when the SDK refuses the amount as too small. */
  onchainTarget?: WalletSendOnchainTarget;
  /** Speed chosen before the quote expired; set only when renewing a quote. */
  renewSpeed?: OnchainSpeed;
}

/** The last prepare that opened the confirm step, kept to renew an expired quote. */
interface PreparedSend {
  request: WalletPayRequest;
  recipient: string;
  options: PrepareOptions;
}

/**
 * Speed shown first on the confirm step of a payment to a base-chain
 * address: medium when the balance covers its fee, otherwise slow.
 *
 * @param fees - Fees per speed and the largest fee the balance covers.
 * @returns The default speed.
 */
function defaultSpeed(fees: WalletOnchainFees): OnchainSpeed {
  return fees.fees.medium <= fees.spendableFeeSats ? 'medium' : 'slow';
}

/**
 * Recipient shown for a receiver read from `text`: the Lightning address
 * behind an LNURL for `/.well-known/lnurlp/<name>` (see `lnurlPayAddress`),
 * otherwise `fallback`.
 *
 * @param text - Text as pasted or scanned.
 * @param fallback - Recipient of the receiver (an address or a domain).
 * @returns The recipient to show.
 */
function recipientOf(text: string, fallback: string): string {
  return lnurlPayAddress(text) ?? fallback;
}

/**
 * Pinned step from `?visual=send-…`, honoured only in a Playwright build.
 *
 * @param name - Pin name from {@link visualPin}.
 * @returns The pinned step, or `null`.
 */
function visualState(name: string | null): WalletSendState | null {
  const fixture = WALLET_SEND_VISUAL_FIXTURE;
  const lnurl: WalletSendAmountTarget = {
    type: 'lnurl',
    request: { details: null },
    minSats: fixture.minSats,
    maxSats: fixture.maxSats,
    commentMaxLength: fixture.commentMaxLength,
    recipient: fixture.recipient,
  };
  const request: WalletSendAmountTarget = {
    type: 'request',
    input: fixture.requestRecipient,
    amountSats: null,
    recipient: fixture.requestRecipient,
  };
  const onchainTarget: WalletSendOnchainTarget = {
    type: 'onchain',
    address: fixture.onchainAddress,
    amountSats: null,
    recipient: fixture.onchainRecipient,
  };
  const onchainConfirm = (
    speed: OnchainSpeed,
    spendableFeeSats: number,
    renewed: boolean,
  ): WalletSendState => ({
    step: 'confirm',
    recipient: fixture.onchainRecipient,
    amountSats: fixture.onchainAmountSats,
    feeSats: fixture.onchainFees[speed],
    onchain: {
      fees: { ...fixture.onchainFees },
      spendableFeeSats,
      speed,
      ...(renewed ? { renewed: true as const } : {}),
    },
  });
  switch (name) {
    case 'send-input':
    case 'send-input-busy':
      return { step: 'input', error: null };
    case 'send-amount':
    case 'send-amount-busy':
      return { step: 'amount', target: lnurl, amountError: false };
    case 'send-amount-error':
      return { step: 'amount', target: lnurl, amountError: true };
    case 'send-amount-no-comment':
      return { step: 'amount', target: { ...lnurl, commentMaxLength: 0 }, amountError: false };
    case 'send-amount-request':
      return { step: 'amount', target: request, amountError: false };
    case 'send-amount-min':
      return { step: 'amount', target: request, amountError: true };
    case 'send-comment-long':
      return {
        step: 'amount',
        target: {
          type: 'relay',
          target: fixture.recipient,
          minSats: fixture.minSats,
          maxSats: fixture.maxSats,
          commentMaxLength: fixture.commentMaxLength,
          recipient: fixture.recipient,
        },
        amountError: false,
        commentError: true,
      };
    case 'send-confirm':
    case 'send-confirm-sending':
      return {
        step: 'confirm',
        recipient: fixture.recipient,
        amountSats: fixture.amountSats,
        feeSats: fixture.feeSats,
      };
    case 'send-confirm-fixed':
    case 'send-confirm-shop':
      return {
        step: 'confirm',
        recipient: recipientOf(fixture.fixedLink, fixture.recipient),
        amountSats: fixture.fixedAmountSats,
        feeSats: name === 'send-confirm-shop' ? fixture.feeSats : fixture.fixedFeeSats,
      };
    case 'send-confirm-member':
      return {
        step: 'confirm',
        recipient: fixture.memberRecipient,
        amountSats: fixture.amountSats,
        feeSats: fixture.feeSats,
      };
    case 'send-amount-onchain':
      return { step: 'amount', target: onchainTarget, amountError: false };
    case 'send-amount-onchain-min':
      return {
        step: 'amount',
        target: { ...onchainTarget, minSats: fixture.onchainMinSats },
        amountError: true,
      };
    case 'send-confirm-onchain':
    case 'send-confirm-onchain-sending':
    case 'send-confirm-onchain-renewing':
      return onchainConfirm('medium', fixture.onchainSpendableFeeSats, false);
    case 'send-confirm-onchain-fast':
      return onchainConfirm('fast', fixture.onchainSpendableFeeSats, false);
    case 'send-confirm-onchain-slow':
      return onchainConfirm('slow', fixture.onchainSpendableFeeSats, false);
    case 'send-confirm-onchain-low':
      return onchainConfirm('medium', fixture.onchainLowSpendableFeeSats, false);
    case 'send-confirm-onchain-renewed':
      return onchainConfirm('medium', fixture.onchainSpendableFeeSats, true);
    case 'send-input-opening':
    case 'send-input-wallet-error':
      return { step: 'input', error: null };
    case 'send-confirm-opening':
    case 'send-confirm-opens':
    case 'send-confirm-wallet-error':
      return { step: 'quote', recipient: fixture.recipient, amountSats: fixture.amountSats };
    case 'send-sent':
      return { step: 'sent', amountSats: fixture.amountSats, recipient: fixture.recipient };
    case 'send-unsupported':
      return { step: 'input', error: 'unsupported' };
    case 'send-invalid':
      return { step: 'input', error: 'invalid' };
    case 'send-failed':
      return { step: 'input', error: 'failed' };
    case 'send-insufficient':
      return { step: 'input', error: 'insufficient' };
    case 'send-error':
      return { step: 'input', error: 'unreachable' };
    case 'send-not-payable':
      return { step: 'input', error: 'notPayable' };
    case 'send-not-found':
      return { step: 'input', error: 'notFound' };
    case 'send-relay-unreachable':
      return { step: 'input', error: 'relayUnreachable' };
    case 'send-unavailable':
      return { step: 'input', error: 'unavailable' };
    case 'send-unreadable':
      return { step: 'input', error: 'unreadable' };
    default:
      return null;
  }
}

/**
 * Bounds of the amount a target accepts.
 *
 * @param target - Receiver that needs an amount.
 * @returns Smallest and largest whole sats.
 */
export function walletSendBounds(target: WalletSendAmountTarget): { min: number; max: number } {
  if (target.type === 'onchain') {
    return { min: target.minSats ?? 1, max: Number.MAX_SAFE_INTEGER };
  }
  if (target.type !== 'request') {
    return { min: target.minSats, max: target.maxSats };
  }
  return { min: 1, max: Number.MAX_SAFE_INTEGER };
}

/**
 * Input alert for an api refusal of a `/lnurl/…` request.
 *
 * @param error - Rejection of `postLnurlPayRequest` or `postLnurlInvoice`.
 * @returns The alert for the input step.
 */
function relayInputError(error: unknown): WalletSendError {
  switch (error instanceof LnurlRelayError ? error.reason : 'failed') {
    case 'notPayable':
      return 'notPayable';
    case 'notFound':
      return 'notFound';
    case 'unreachable':
      return 'relayUnreachable';
    default:
      return 'failed';
  }
}

/**
 * What a pinned step waits for under `?visual=send-…`, honoured only in a
 * Playwright build (the pin itself comes from {@link visualPin}).
 *
 * @param name - Pin name from {@link visualPin}.
 * @param retried - Whether **Try again** was pressed under the pin.
 * @returns The pinned wait, or `null`.
 */
function visualWait(name: string | null, retried: boolean): WalletSendWait | null {
  switch (name) {
    case 'send-input-opening':
    case 'send-confirm-opening':
    case 'send-confirm-opens':
      return 'opening';
    case 'send-input-wallet-error':
    case 'send-confirm-wallet-error':
      return retried ? 'opening' : 'error';
    default:
      return null;
  }
}

/** A step held until the wallet is ready, and the run it belongs to. */
interface HeldWalletStep {
  run: number;
  go: () => void;
}

/**
 * Drives the `/wallet` send flow: paste, read with the SDK's `parse`, an
 * amount (and optional comment) when the receiver asks for one, a confirm
 * step with amount, fee, and recipient, then one send. Only the steps that
 * need the open wallet wait for it: the SDK read of the text and the
 * prepare that gives the fee. A text the SDK reads waits on the input step
 * (`walletWait`) and is read once the wallet is ready; a payment whose fee
 * is not known yet shows the `quote` step (amount and recipient) and is
 * prepared once the wallet is ready, then shows `confirm`. While the wallet
 * cannot be opened, `walletWait` is `error` and `retryWallet` tries again
 * (or runs the one-time setup again); the text and the step are kept. A
 * step that needs the wallet when this account has no wallet it can use
 * here ends on the input step with `unavailable`. A base-chain address
 * (or a `bitcoin:` URI that offers only one) asks for an amount, or uses the
 * URI amount; an amount below the SDK minimum reopens the amount step with
 * that minimum. Its confirm step offers the speeds the balance covers
 * (`setSpeed`, medium first), and an expired fee quote is prepared again
 * instead of sent, returning to the confirm step marked `renewed`. A
 * receiver whose server this browser
 * cannot reach shows a plain error. A Lightning address or LNURL on another
 * host (see `lnurlRelayTarget`) is read through the api instead, without the
 * wallet: its pay request gives the bounds and comment length, the api
 * returns the invoice for the chosen amount, and the wallet pays that
 * invoice. A 21.gifts shop on this host (`ownShop`) is asked for an open
 * charge first (`fetchShopChargeInvoice`, also without the wallet): with
 * one, the wallet pays its Spark invoice for
 * exactly that amount, without a fee; with none, no Spark invoice, or a
 * prepare that fails or gives another amount, the text is read as below.
 * When the shop has no open charge (`none`), the amount entered for that
 * own-host member (shown as `<name>@<host>`) is first asked as a Spark
 * invoice (`fetchMemberSparkInvoice`) and paid without a fee; no Spark
 * invoice, or a prepare that fails or gives another amount, pays the member
 * over Lightning as before. An open charge that cannot be paid with a Spark
 * invoice is read as before, without that member step. Other own-host addresses and Spark targets are read by the
 * wallet. No send is retried on its own; only an expired fee quote is
 * prepared again once, before anything is sent. When the wallet stops being
 * ready, an open confirm step becomes the `quote` step again (its prepared
 * payment belonged to the closed connection) and a read or prepare that
 * settles meanwhile waits again; a send in flight is kept, and the amount
 * step stays. Visual pins (`?visual=send-…`) apply only in a Playwright
 * build and leave the actions inert (so does any `?visual=balance-…`,
 * `?visual=history-…`, or other `?visual=send-…` value there); under
 * `send-input-busy` and `send-amount-busy`, **Continue** only marks that
 * step busy, and under an idle base-chain confirm pin `setSpeed` chooses a
 * covered speed. `send-input-opening` and `send-input-wallet-error` pin a
 * read that waits for the wallet, `send-confirm-opening` and
 * `send-confirm-wallet-error` the `quote` step; `send-confirm-opens` shows
 * the confirm fixture {@link WALLET_SEND_PIN_OPEN_MS} after it opened, and so
 * does **Try again** under `send-confirm-wallet-error`.
 *
 * @returns The current step, drafts, and actions.
 */
export function useWalletSend(): UseWalletSendResult {
  const [state, setState] = useState<WalletSendState>({ step: 'input', error: null });
  const [busy, setBusy] = useState(false);
  const [pinBusy, setPinBusy] = useState(false);
  const [pinRetried, setPinRetried] = useState(false);
  const [pinOpened, setPinOpened] = useState(false);
  const [text, setTextState] = useState('');
  const [comment, setComment] = useState('');
  const [pinSpeed, setPinSpeed] = useState<OnchainSpeed | null>(null);
  const sendRef = useRef<((speed?: OnchainSpeed) => Promise<WalletSendResult>) | null>(null);
  const preparedRef = useRef<PreparedSend | null>(null);
  const sendingRef = useRef(false);
  const [sending, setSending] = useState(false);
  const generation = useRef(0);
  const heldRef = useRef<HeldWalletStep | null>(null);
  /** Whether a step is held for the wallet now. */
  const [holding, setHolding] = useState(false);
  /** Bumped on every hold, so the runner looks again even when `ready` did not change. */
  const [holds, setHolds] = useState(0);
  const pin = visualPin();
  const pinned = visualState(pin);
  const inert = pinned !== null || (pin !== null && /^(balance|history|send)-/.test(pin));
  const status = useWalletStore((store) => store.status);
  const account = useAuthStore((store) => store.account);
  const session = useAuthStore((store) => store.session);
  const ready = status === 'ready' && canUnlockWallet(account) && !needsWalletSetup(account);
  const wallet = useWallet();
  const setup = useWalletSetup();
  const walletStatus = useRef<WalletViewStatus>(wallet.status);

  useEffect(() => {
    walletStatus.current = wallet.status;
  });

  useEffect(
    () => () => {
      generation.current += 1;
    },
    [],
  );

  useEffect(() => {
    if (pin !== 'send-confirm-opens' && !(pin === 'send-confirm-wallet-error' && pinRetried)) {
      return;
    }
    const timer = window.setTimeout(() => {
      setPinOpened(true);
    }, WALLET_SEND_PIN_OPEN_MS);
    return () => {
      window.clearTimeout(timer);
    };
  }, [pin, pinRetried]);

  /**
   * Holds `go` until the wallet is ready, for the step of `run`. Returns
   * `ready` when the wallet can be used now. When this account has no wallet
   * it can use here, the flow ends on the input step with `unavailable`.
   */
  const holdForWallet = useCallback(
    (run: number, go: () => void): 'ready' | 'held' | 'unavailable' => {
      if (walletCanSend()) {
        return 'ready';
      }
      if (walletStatus.current === 'disabled') {
        heldRef.current = null;
        setBusy(false);
        setState({ step: 'input', error: 'unavailable' });
        return 'unavailable';
      }
      heldRef.current = { run, go };
      setBusy(true);
      setHolding(true);
      setHolds((count) => count + 1);
      return 'held';
    },
    [],
  );

  useEffect(() => {
    const step = heldRef.current;
    // The store itself decides: `ready` from the last render may already be stale.
    if (step === null || !walletCanSend()) {
      return;
    }
    heldRef.current = null;
    setHolding(false);
    if (step.run === generation.current) {
      step.go();
    }
  }, [ready, holds]);

  useEffect(() => {
    if (wallet.status !== 'disabled' || heldRef.current === null) {
      return;
    }
    heldRef.current = null;
    generation.current += 1;
    setHolding(false);
    setBusy(false);
    setState({ step: 'input', error: 'unavailable' });
  }, [wallet.status, holds]);

  const setText = useCallback((value: string): void => {
    setTextState(value);
    setState((current) =>
      current.step === 'input' && current.error !== null ? { step: 'input', error: null } : current,
    );
  }, []);

  /**
   * Ends `run` with one plain alert on the input step when its read rejected
   * or its handler threw unexpectedly. A run that a Cancel or a new run
   * already ended stays ended.
   */
  const failRun = useCallback((run: number, error: WalletSendError): void => {
    if (run !== generation.current) {
      return;
    }
    heldRef.current = null;
    setHolding(false);
    setBusy(false);
    setState({ step: 'input', error });
  }, []);

  /**
   * Prepares `request` and opens the confirm step. While the wallet is not
   * ready, the `quote` step shows `amountSats` and `recipient` and the
   * prepare runs once it is; a result that settles after the wallet stopped
   * being ready waits again. A result that is not the
   * expected amount, or that fails, runs `fallback` when given (a balance
   * that is too low still shows that alert), otherwise returns to the input
   * with an alert. An amount the SDK refuses as below its minimum for a
   * base-chain address reopens the amount step with that minimum. A payment
   * to a base-chain address opens with `renewSpeed` when the balance covers
   * it (marked `renewed`), otherwise with {@link defaultSpeed}.
   */
  const prepare = useCallback(
    function prepareSend(
      request: WalletPayRequest,
      recipient: string,
      amountSats: number,
      options: PrepareOptions = {},
    ): void {
      const { expectedSats, fallback, onchainTarget, renewSpeed } = options;
      const run = generation.current;
      const again = (): void => {
        prepareSend(request, recipient, amountSats, options);
      };
      const wait = holdForWallet(run, again);
      if (wait === 'held') {
        setState({ step: 'quote', recipient, amountSats });
      }
      if (wait !== 'ready') {
        return;
      }
      setBusy(true);
      void payFromWallet(request)
        .then((result) => {
          if (run !== generation.current) {
            return;
          }
          if (!walletCanSend()) {
            again();
            return;
          }
          if (
            result.kind === 'confirm' &&
            (expectedSats === undefined || result.amountSats === expectedSats)
          ) {
            setBusy(false);
            sendRef.current = result.send;
            preparedRef.current = { request, recipient, options };
            const fees = result.onchain;
            if (fees === undefined) {
              setState({
                step: 'confirm',
                recipient,
                amountSats: result.amountSats,
                feeSats: result.feeSats,
              });
              return;
            }
            const speed =
              renewSpeed !== undefined && fees.fees[renewSpeed] <= fees.spendableFeeSats
                ? renewSpeed
                : defaultSpeed(fees);
            setState({
              step: 'confirm',
              recipient,
              amountSats: result.amountSats,
              feeSats: fees.fees[speed],
              onchain: {
                ...fees,
                speed,
                ...(renewSpeed === undefined ? {} : { renewed: true as const }),
              },
            });
            return;
          }
          if (result.kind === 'belowMinimum' && onchainTarget !== undefined) {
            setBusy(false);
            setState({
              step: 'amount',
              target: { ...onchainTarget, minSats: result.minSats },
              amountError: true,
            });
            return;
          }
          if (fallback !== undefined && result.kind !== 'insufficient') {
            fallback();
            return;
          }
          setBusy(false);
          setState({
            step: 'input',
            error: result.kind === 'insufficient' ? 'insufficient' : 'failed',
          });
        })
        .catch(() => {
          failRun(run, 'failed');
        });
    },
    [holdForWallet, failRun],
  );

  useEffect(() => {
    if (inert || ready || state.step !== 'confirm' || sendingRef.current) {
      return;
    }
    const last = preparedRef.current;
    /* v8 ignore next 3 -- a live confirm step is only opened by a prepare that stored it */
    if (last === null) {
      return;
    }
    // The prepared payment belongs to the connection that closed: quote it again once open.
    generation.current += 1;
    sendRef.current = null;
    prepare(last.request, last.recipient, state.amountSats, last.options);
  }, [inert, ready, state, prepare]);

  /**
   * Pays `sats` to `target` the way **Continue** in the amount step does: the
   * relay asks the api for an invoice, an LNURL receiver is asked by the
   * wallet, and a request is prepared with that amount. The bounds are
   * already checked. A relay receiver that takes one amount never showed an
   * amount step, so its refusals return to the input. An own-host member is
   * first asked for a Spark invoice of `sats`; without one, or when it cannot
   * be prepared for exactly `sats`, the wallet asks the LNURL receiver.
   */
  const payAmount = useCallback(
    (target: WalletSendAmountTarget, sats: number, note: string): void => {
      if (target.type === 'relay') {
        const trimmed = note.trim().slice(0, target.commentMaxLength);
        const run = generation.current;
        setBusy(true);
        const request =
          session === null
            ? Promise.reject(new LnurlRelayError('failed'))
            : postLnurlInvoice(session, target.target, sats * 1000, trimmed);
        void request.then(
          (invoice) => {
            if (run !== generation.current) {
              return;
            }
            prepare({ type: 'input', input: invoice.pr }, target.recipient, sats, {
              expectedSats: sats,
            });
          },
          (error: unknown) => {
            if (run !== generation.current) {
              return;
            }
            setBusy(false);
            const reason = error instanceof LnurlRelayError ? error.reason : 'failed';
            if (target.minSats === target.maxSats) {
              setState({ step: 'input', error: relayInputError(error) });
              return;
            }
            if (reason === 'amount' || reason === 'comment') {
              setState({
                step: 'amount',
                target,
                amountError: reason === 'amount',
                ...(reason === 'comment' ? { commentError: true as const } : {}),
              });
              return;
            }
            setState({ step: 'input', error: relayInputError(error) });
          },
        );
        return;
      }
      if (target.type === 'lnurl') {
        const trimmed = note.trim().slice(0, target.commentMaxLength);
        const lightning = (): void => {
          prepare(
            {
              type: 'lnurl',
              request: target.request,
              amountSats: sats,
              ...(trimmed === '' ? {} : { comment: trimmed }),
            },
            target.recipient,
            sats,
          );
        };
        if (target.member === undefined) {
          lightning();
          return;
        }
        const run = generation.current;
        setBusy(true);
        void fetchMemberSparkInvoice(target.member, sats, trimmed).then((sparkInvoice) => {
          if (run !== generation.current) {
            return;
          }
          if (sparkInvoice === null) {
            lightning();
            return;
          }
          prepare({ type: 'input', input: sparkInvoice }, target.recipient, sats, {
            expectedSats: sats,
            fallback: lightning,
          });
        });
        return;
      }
      if (target.type === 'onchain') {
        prepare(
          { type: 'input', input: target.address, amountSats: sats },
          target.recipient,
          sats,
          { onchainTarget: target },
        );
        return;
      }
      prepare({ type: 'input', input: target.input, amountSats: sats }, target.recipient, sats);
    },
    [session, prepare],
  );

  /**
   * Opens the amount step for `target`, or pays at once when its whole-sat
   * bounds are one amount (a point-of-sale charge): then no message is sent.
   */
  const askAmount = useCallback(
    (target: Exclude<WalletSendAmountTarget, { type: 'request' | 'onchain' }>): void => {
      setComment('');
      if (target.minSats === target.maxSats) {
        payAmount(target, target.minSats, '');
        return;
      }
      setBusy(false);
      setState({ step: 'amount', target, amountError: false });
    },
    [payAmount],
  );

  const submitInput = useCallback((): void => {
    if (inert) {
      setPinBusy(pin === 'send-input-busy');
      return;
    }
    if (busy || state.step !== 'input') {
      return;
    }
    const run = generation.current;
    setBusy(true);
    const relay = lnurlRelayTarget(text, window.location.hostname);
    if (relay !== null) {
      const request =
        session === null
          ? Promise.reject(new LnurlRelayError('failed'))
          : postLnurlPayRequest(session, relay);
      void request
        .then(
          (payRequest) => {
            if (run !== generation.current) {
              return;
            }
            const minSats = Math.max(1, Math.ceil(payRequest.minSendableMsat / 1000));
            const maxSats = Math.floor(payRequest.maxSendableMsat / 1000);
            if (minSats > maxSats) {
              setBusy(false);
              setState({ step: 'input', error: 'unsupported' });
              return;
            }
            askAmount({
              type: 'relay',
              target: payRequest.target,
              minSats,
              maxSats,
              commentMaxLength: payRequest.commentAllowed,
              recipient: payRequest.target.includes('@')
                ? payRequest.target
                : recipientOf(text, payRequest.domain),
            });
          },
          (error: unknown) => {
            if (run !== generation.current) {
              return;
            }
            setBusy(false);
            setState({ step: 'input', error: relayInputError(error) });
          },
        )
        .catch(() => {
          failRun(run, 'unreadable');
        });
      return;
    }
    const readWithWallet = (member: OwnShop | null): void => {
      const again = (): void => {
        readWithWallet(member);
      };
      if (holdForWallet(run, again) !== 'ready') {
        return;
      }
      void parseWalletInput(text)
        .then((parsed) => {
          if (run !== generation.current) {
            return;
          }
          if (!walletCanSend()) {
            again();
            return;
          }
          if (parsed.kind !== 'target') {
            setBusy(false);
            setState({
              step: 'input',
              error:
                parsed.kind === 'unreachable'
                  ? 'unreachable'
                  : parsed.kind === 'unlock'
                    ? 'failed'
                    : 'invalid',
            });
            return;
          }
          const target = parsed.target;
          if (target.type === 'unsupported') {
            setBusy(false);
            setState({ step: 'input', error: 'unsupported' });
            return;
          }
          if (target.type === 'onchain') {
            if (target.amountSats !== null) {
              prepare(
                { type: 'input', input: target.address, amountSats: target.amountSats },
                target.recipient,
                target.amountSats,
                { onchainTarget: { ...target, amountSats: null } },
              );
              return;
            }
            setBusy(false);
            setComment('');
            setState({ step: 'amount', target, amountError: false });
            return;
          }
          if (target.type === 'lnurl') {
            askAmount({
              ...target,
              ...(member === null
                ? { recipient: recipientOf(text, target.recipient) }
                : { recipient: member.address, member: member.name }),
            });
            return;
          }
          if (target.amountSats !== null && target.amountSats > 0) {
            prepare(
              {
                type: 'input',
                input: target.input,
                ...(target.amountFromUri === true ? { amountSats: target.amountSats } : {}),
              },
              target.recipient,
              target.amountSats,
            );
            return;
          }
          setBusy(false);
          setComment('');
          setState({ step: 'amount', target, amountError: false });
        })
        .catch(() => {
          failRun(run, 'unreadable');
        });
    };
    const shop = ownShop(text, window.location.hostname);
    if (shop === null) {
      readWithWallet(null);
      return;
    }
    void fetchShopChargeInvoice(shop.name)
      .then((charge) => {
        if (run !== generation.current) {
          return;
        }
        if (charge.kind !== 'invoice') {
          readWithWallet(charge.kind === 'none' ? shop : null);
          return;
        }
        prepare({ type: 'input', input: charge.sparkInvoice }, shop.address, charge.amountSats, {
          expectedSats: charge.amountSats,
          fallback: () => {
            readWithWallet(null);
          },
        });
      })
      .catch(() => {
        failRun(run, 'unreadable');
      });
  }, [pin, inert, busy, state.step, text, session, prepare, askAmount, failRun, holdForWallet]);

  const submitAmount = useCallback(
    (sats: number | null): void => {
      if (inert) {
        setPinBusy(pin === 'send-amount-busy');
        return;
      }
      if (busy || state.step !== 'amount') {
        return;
      }
      const target = state.target;
      const { min, max } = walletSendBounds(target);
      if (sats === null || sats < min || sats > max) {
        setState({ step: 'amount', target, amountError: true });
        return;
      }
      payAmount(target, sats, comment);
    },
    [pin, inert, busy, state, comment, payAmount],
  );

  const confirm = useCallback((): void => {
    const send = sendRef.current;
    if (inert || !ready || busy || state.step !== 'confirm' || send === null) {
      return;
    }
    sendRef.current = null;
    const { amountSats, recipient } = state;
    const speed = state.onchain?.speed;
    const run = generation.current;
    setBusy(true);
    sendingRef.current = true;
    setSending(true);
    void send(speed).then((result) => {
      sendingRef.current = false;
      setSending(false);
      if (run !== generation.current) {
        return;
      }
      const last = preparedRef.current;
      if (result.kind === 'expired' && last !== null) {
        prepare(last.request, last.recipient, amountSats, {
          ...last.options,
          renewSpeed: speed ?? 'medium',
        });
        return;
      }
      setBusy(false);
      /* v8 ignore next 4 -- a send is only offered by a prepare that stored itself */
      if (result.kind === 'expired') {
        setState({ step: 'input', error: null });
        return;
      }
      if (result.kind === 'paid') {
        setTextState('');
        setComment('');
        setState({ step: 'sent', amountSats, recipient });
        return;
      }
      setState({
        step: 'input',
        error: result.kind === 'insufficient' ? 'insufficient' : 'failed',
      });
    });
  }, [inert, ready, busy, state, prepare]);

  const setSpeed = useCallback(
    (speed: OnchainSpeed): void => {
      const pinnedNow = visualState(pin);
      if (pinnedNow !== null) {
        if (
          pinnedNow.step === 'confirm' &&
          pinnedNow.onchain !== undefined &&
          pin !== 'send-confirm-onchain-sending' &&
          pin !== 'send-confirm-onchain-renewing' &&
          pinnedNow.onchain.fees[speed] <= pinnedNow.onchain.spendableFeeSats
        ) {
          setPinSpeed(speed);
        }
        return;
      }
      if (busy) {
        return;
      }
      setState((current) => {
        if (
          current.step !== 'confirm' ||
          current.onchain === undefined ||
          current.onchain.fees[speed] > current.onchain.spendableFeeSats
        ) {
          return current;
        }
        return {
          ...current,
          feeSats: current.onchain.fees[speed],
          onchain: { ...current.onchain, speed },
        };
      });
    },
    [pin, busy],
  );

  const cancel = useCallback((): boolean => {
    if (inert || state.step === 'input') {
      return false;
    }
    if (state.step === 'confirm' && busy && sendingRef.current) {
      return true;
    }
    generation.current += 1;
    heldRef.current = null;
    setHolding(false);
    sendRef.current = null;
    setBusy(false);
    setState({ step: 'input', error: null });
    return true;
  }, [inert, state.step, busy]);

  const abandon = useCallback((): void => {
    if (inert || sendingRef.current) {
      return;
    }
    generation.current += 1;
    heldRef.current = null;
    setHolding(false);
    sendRef.current = null;
    setBusy(false);
    setTextState('');
    setState({ step: 'input', error: null });
  }, [inert]);

  const retryWallet = useCallback((): void => {
    if (pinned !== null) {
      setPinRetried(true);
      return;
    }
    if (wallet.setupFailed) {
      setup.retry();
      return;
    }
    wallet.retry();
  }, [pinned, wallet, setup]);

  const pinWait = pinOpened ? null : visualWait(pin, pinRetried);
  const opened = pinOpened ? visualState('send-confirm') : null;
  const shown =
    opened ??
    (pinned !== null &&
    pinned.step === 'confirm' &&
    pinned.onchain !== undefined &&
    pinSpeed !== null
      ? {
          ...pinned,
          feeSats: pinned.onchain.fees[pinSpeed],
          onchain: { ...pinned.onchain, speed: pinSpeed },
        }
      : pinned);
  const current = shown ?? state;
  const waits = current.step === 'quote' || (current.step === 'input' && holding);
  const liveWait: WalletSendWait | null = waits
    ? wallet.status === 'error'
      ? 'error'
      : 'opening'
    : null;
  const pinSending = pin === 'send-confirm-sending' || pin === 'send-confirm-onchain-sending';
  return {
    state: current,
    busy:
      pinned === null
        ? busy
        : pinSending || pinBusy || pin === 'send-confirm-onchain-renewing' || pinWait !== null,
    sending: pinned === null ? sending : pinSending,
    walletWait: pinned === null ? liveWait : pinWait,
    retryWallet,
    text,
    setText,
    comment,
    setComment,
    submitInput,
    submitAmount,
    setSpeed,
    confirm,
    cancel,
    abandon,
  };
}
