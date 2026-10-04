'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { LnurlRelayError, postLnurlInvoice, postLnurlPayRequest } from '@/lib/api';
import { getE2eNow } from '@/lib/config';
import { encodeLnurl } from '@/lib/lnurl';
import { lnurlPayAddress } from '@/lib/pay-link';
import { lnurlRelayTarget } from '@/lib/wallet/lnurl-relay';
import { canUnlockWallet } from '@/lib/wallet/wallet-phrase';
import { needsWalletSetup } from '@/lib/wallet/wallet-setup';
import { useAuthStore } from '@/stores/auth-store';
import { useWalletStore } from '@/stores/wallet-store';
import type { WalletPayRequest, WalletTarget } from '@/lib/wallet/wallet-sdk';
import {
  parseWalletInput,
  payFromWallet,
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
 * - `onchain`: a base-chain Bitcoin address, not supported yet.
 * - `unsupported`: recognised but not payable from this wallet.
 * - `insufficient`: the balance does not cover amount and fee.
 * - `failed`: prepare or send failed, or the wallet had no connection when the
 *   text was read.
 */
export type WalletSendError =
  | 'invalid'
  | 'unreachable'
  | 'notPayable'
  | 'notFound'
  | 'relayUnreachable'
  | 'onchain'
  | 'unsupported'
  | 'insufficient'
  | 'failed';

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

/** Receiver that still needs an amount. */
export type WalletSendAmountTarget =
  | Extract<WalletTarget, { type: 'request' }>
  | Extract<WalletTarget, { type: 'lnurl' }>
  | WalletSendRelayTarget;

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
  | { step: 'confirm'; recipient: string; amountSats: number; feeSats: number }
  | { step: 'sent'; amountSats: number };

/** State and actions of the `/wallet` send flow. */
export interface UseWalletSendResult {
  /** Current step. */
  state: WalletSendState;
  /** True while parse, prepare, or send runs. */
  busy: boolean;
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
  /** Sends the confirmed payment once. */
  confirm: () => void;
  /**
   * Closes the amount or confirm step (back to input) or the sent step. While
   * a confirm send is in flight it closes nothing and still consumes Back.
   *
   * @returns `true` when Back is consumed (a step was closed or a send is in
   *   flight), `false` when no step is open or the flow is pinned.
   */
  cancel: () => boolean;
}

/**
 * Recipient, amount, and fee shown by the visual fixtures. `fixedLink` is the
 * point-of-sale QR of `shop@21.gifts`, and `fixedAmountSats` its open charge.
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
} as const;

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
 * Name of the `?visual=` pin, honoured only in a Playwright build.
 *
 * @returns The pin name, or `null`.
 */
function visualName(): string | null {
  /* v8 ignore next 3 -- SSR has no window */
  if (typeof window === 'undefined') {
    return null;
  }
  if (getE2eNow() === null) {
    return null;
  }
  return new URLSearchParams(window.location.search).get('visual');
}

/**
 * Pinned step from `?visual=send-…`, honoured only in a Playwright build.
 *
 * @param name - Pin name from {@link visualName}.
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
      return {
        step: 'confirm',
        recipient: recipientOf(fixture.fixedLink, fixture.recipient),
        amountSats: fixture.fixedAmountSats,
        feeSats: fixture.feeSats,
      };
    case 'send-sent':
      return { step: 'sent', amountSats: fixture.amountSats };
    case 'send-onchain':
      return { step: 'input', error: 'onchain' };
    case 'send-unsupported':
      return { step: 'input', error: 'unsupported' };
    case 'send-invalid':
      return { step: 'input', error: 'invalid' };
    case 'send-failed':
    case 'send-alert-locked':
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
 * Drives the `/wallet` send flow: paste, read with the SDK's `parse`, an
 * amount (and optional comment) when the receiver asks for one, a confirm
 * step with amount, fee, and recipient, then one send. A base-chain address
 * shows that it is not supported yet. A receiver whose server this browser
 * cannot reach shows a plain error. A Lightning address or LNURL on another
 * host (see `lnurlRelayTarget`) is read through the api instead: its pay
 * request gives the bounds and comment length, the api returns the invoice
 * for the chosen amount, and the wallet pays that invoice. Own-host addresses
 * and Spark targets are read by the wallet. Nothing is retried on its own. Visual
 * pins (`?visual=send-…`) apply only in a Playwright build and leave the
 * actions inert (so does any `?visual=balance-…`, `?visual=history-…`, or
 * other `?visual=send-…` value there); under `send-input-busy` and `send-amount-busy`, **Continue**
 * only marks that step busy. While the one-time wallet setup is due, the
 * actions stay idle. When the wallet leaves `ready` or the account leaves
 * wallet mode, an open amount or confirm step and any read or prepare in
 * flight are dropped (a send in flight is kept), so a later reconnect starts
 * at the input; a read or prepare that settles once the wallet is no longer
 * ready is dropped too.
 *
 * @returns The current step, drafts, and actions.
 */
export function useWalletSend(): UseWalletSendResult {
  const [state, setState] = useState<WalletSendState>({ step: 'input', error: null });
  const [busy, setBusy] = useState(false);
  const [pinBusy, setPinBusy] = useState(false);
  const [text, setTextState] = useState('');
  const [comment, setComment] = useState('');
  const sendRef = useRef<(() => Promise<WalletSendResult>) | null>(null);
  const generation = useRef(0);
  const pin = visualName();
  const pinned = visualState(pin);
  const inert = pinned !== null || (pin !== null && /^(balance|history|send)-/.test(pin));
  const status = useWalletStore((store) => store.status);
  const account = useAuthStore((store) => store.account);
  const session = useAuthStore((store) => store.session);
  const ready = status === 'ready' && canUnlockWallet(account) && !needsWalletSetup(account);

  useEffect(
    () => () => {
      generation.current += 1;
    },
    [],
  );

  useEffect(() => {
    if (inert || ready) {
      return;
    }
    if ((state.step === 'input' && !busy) || state.step === 'sent') {
      return;
    }
    if (state.step === 'confirm' && busy) {
      return;
    }
    generation.current += 1;
    sendRef.current = null;
    setBusy(false);
    setState({ step: 'input', error: null });
  }, [inert, ready, state.step, busy]);

  const setText = useCallback((value: string): void => {
    setTextState(value);
    setState((current) =>
      current.step === 'input' && current.error !== null ? { step: 'input', error: null } : current,
    );
  }, []);

  const prepare = useCallback(
    (request: WalletPayRequest, recipient: string, expectedSats?: number): void => {
      const run = generation.current;
      setBusy(true);
      void payFromWallet(request).then((result) => {
        if (run !== generation.current || !walletCanSend()) {
          return;
        }
        setBusy(false);
        if (
          result.kind === 'confirm' &&
          (expectedSats === undefined || result.amountSats === expectedSats)
        ) {
          sendRef.current = result.send;
          setState({
            step: 'confirm',
            recipient,
            amountSats: result.amountSats,
            feeSats: result.feeSats,
          });
          return;
        }
        setState({
          step: 'input',
          error: result.kind === 'insufficient' ? 'insufficient' : 'failed',
        });
      });
    },
    [],
  );

  /**
   * Pays `sats` to `target` the way **Continue** in the amount step does: the
   * relay asks the api for an invoice, an LNURL receiver is asked by the
   * wallet, and a request is prepared with that amount. The bounds are
   * already checked.
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
            if (run !== generation.current || !walletCanSend()) {
              return;
            }
            prepare({ type: 'input', input: invoice.pr }, target.recipient, sats);
          },
          (error: unknown) => {
            if (run !== generation.current || !walletCanSend()) {
              return;
            }
            setBusy(false);
            const reason = error instanceof LnurlRelayError ? error.reason : 'failed';
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
        prepare(
          {
            type: 'lnurl',
            request: target.request,
            amountSats: sats,
            ...(trimmed === '' ? {} : { comment: trimmed }),
          },
          target.recipient,
        );
        return;
      }
      prepare({ type: 'input', input: target.input, amountSats: sats }, target.recipient);
    },
    [session, prepare],
  );

  /**
   * Opens the amount step for `target`, or pays at once when its whole-sat
   * bounds are one amount (a point-of-sale charge): then no message is sent.
   */
  const askAmount = useCallback(
    (target: Exclude<WalletSendAmountTarget, { type: 'request' }>): void => {
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
    if (!ready || busy || state.step !== 'input') {
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
      void request.then(
        (payRequest) => {
          if (run !== generation.current || !walletCanSend()) {
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
          if (run !== generation.current || !walletCanSend()) {
            return;
          }
          setBusy(false);
          setState({ step: 'input', error: relayInputError(error) });
        },
      );
      return;
    }
    void parseWalletInput(text).then((parsed) => {
      if (run !== generation.current || !walletCanSend()) {
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
      if (target.type === 'onchain' || target.type === 'unsupported') {
        setBusy(false);
        setState({ step: 'input', error: target.type });
        return;
      }
      if (target.type === 'lnurl') {
        askAmount({ ...target, recipient: recipientOf(text, target.recipient) });
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
        );
        return;
      }
      setBusy(false);
      setComment('');
      setState({ step: 'amount', target, amountError: false });
    });
  }, [pin, inert, ready, busy, state.step, text, session, prepare, askAmount]);

  const submitAmount = useCallback(
    (sats: number | null): void => {
      if (inert) {
        setPinBusy(pin === 'send-amount-busy');
        return;
      }
      if (!ready || busy || state.step !== 'amount') {
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
    [pin, inert, ready, busy, state, comment, payAmount],
  );

  const confirm = useCallback((): void => {
    const send = sendRef.current;
    if (inert || !ready || busy || state.step !== 'confirm' || send === null) {
      return;
    }
    sendRef.current = null;
    const amountSats = state.amountSats;
    const run = generation.current;
    setBusy(true);
    void send().then((result) => {
      if (run !== generation.current) {
        return;
      }
      setBusy(false);
      if (result.kind === 'paid') {
        setTextState('');
        setComment('');
        setState({ step: 'sent', amountSats });
        return;
      }
      setState({
        step: 'input',
        error: result.kind === 'insufficient' ? 'insufficient' : 'failed',
      });
    });
  }, [inert, ready, busy, state]);

  const cancel = useCallback((): boolean => {
    if (inert || state.step === 'input') {
      return false;
    }
    if (state.step === 'confirm' && busy) {
      return true;
    }
    generation.current += 1;
    sendRef.current = null;
    setBusy(false);
    setState({ step: 'input', error: null });
    return true;
  }, [inert, state.step, busy]);

  return {
    state: pinned ?? state,
    busy: pinned === null ? busy : pin === 'send-confirm-sending' || pinBusy,
    text,
    setText,
    comment,
    setComment,
    submitInput,
    submitAmount,
    confirm,
    cancel,
  };
}
