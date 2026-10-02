'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { getE2eNow } from '@/lib/config';
import { useWalletStore } from '@/stores/wallet-store';
import type { WalletPayRequest, WalletTarget } from '@/lib/wallet/wallet-sdk';
import {
  parseWalletInput,
  payFromWallet,
  type WalletSendResult,
} from '@/lib/wallet/wallet-service';

/**
 * Why the input step shows an alert.
 *
 * - `invalid`: not a payment request or address.
 * - `unreachable`: the receiver's server did not answer this browser.
 * - `onchain`: a base-chain Bitcoin address, not supported yet.
 * - `unsupported`: recognised but not payable from this wallet.
 * - `insufficient`: the balance does not cover amount and fee.
 * - `failed`: prepare or send failed, or the wallet had no connection when the
 *   text was read.
 */
export type WalletSendError =
  'invalid' | 'unreachable' | 'onchain' | 'unsupported' | 'insufficient' | 'failed';

/** Receiver that still needs an amount. */
export type WalletSendAmountTarget =
  Extract<WalletTarget, { type: 'request' }> | Extract<WalletTarget, { type: 'lnurl' }>;

/** Step of the `/wallet` send flow. */
export type WalletSendState =
  | { step: 'input'; error: WalletSendError | null }
  | { step: 'amount'; target: WalletSendAmountTarget; amountError: boolean }
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

/** Recipient, amount, and fee shown by the visual fixtures. */
export const WALLET_SEND_VISUAL_FIXTURE = {
  recipient: 'bob@example.com',
  amountSats: 2_100,
  feeSats: 0,
  minSats: 1,
  maxSats: 1_000_000,
  commentMaxLength: 140,
  requestRecipient: 'sp1qexample…a9f2',
} as const;

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
      return { step: 'input', error: null };
    case 'send-amount':
      return { step: 'amount', target: lnurl, amountError: false };
    case 'send-amount-error':
      return { step: 'amount', target: lnurl, amountError: true };
    case 'send-amount-request':
      return { step: 'amount', target: request, amountError: false };
    case 'send-amount-min':
      return { step: 'amount', target: request, amountError: true };
    case 'send-confirm':
    case 'send-confirm-sending':
      return {
        step: 'confirm',
        recipient: fixture.recipient,
        amountSats: fixture.amountSats,
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
      return { step: 'input', error: 'failed' };
    case 'send-insufficient':
      return { step: 'input', error: 'insufficient' };
    case 'send-error':
      return { step: 'input', error: 'unreachable' };
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
  if (target.type === 'lnurl') {
    return { min: target.minSats, max: target.maxSats };
  }
  return { min: 1, max: Number.MAX_SAFE_INTEGER };
}

/**
 * Drives the `/wallet` send flow: paste, read with the SDK's `parse`, an
 * amount (and optional comment) when the receiver asks for one, a confirm
 * step with amount, fee, and recipient, then one send. A base-chain address
 * shows that it is not supported yet. A receiver whose server this browser
 * cannot reach shows a plain error. Nothing is retried on its own. Visual
 * pins (`?visual=send-…`) apply only in a Playwright build and leave the
 * actions inert. When the wallet leaves `ready`, an open amount or confirm
 * step and any read or prepare in flight are dropped (a send in flight is
 * kept), so a later reconnect starts at the input.
 *
 * @returns The current step, drafts, and actions.
 */
export function useWalletSend(): UseWalletSendResult {
  const [state, setState] = useState<WalletSendState>({ step: 'input', error: null });
  const [busy, setBusy] = useState(false);
  const [text, setTextState] = useState('');
  const [comment, setComment] = useState('');
  const sendRef = useRef<(() => Promise<WalletSendResult>) | null>(null);
  const generation = useRef(0);
  const pin = visualName();
  const pinned = visualState(pin);
  const status = useWalletStore((store) => store.status);

  useEffect(
    () => () => {
      generation.current += 1;
    },
    [],
  );

  useEffect(() => {
    if (pinned !== null || status === 'ready') {
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
  }, [pinned, status, state.step, busy]);

  const setText = useCallback((value: string): void => {
    setTextState(value);
    setState((current) =>
      current.step === 'input' && current.error !== null ? { step: 'input', error: null } : current,
    );
  }, []);

  const prepare = useCallback((request: WalletPayRequest, recipient: string): void => {
    const run = generation.current;
    setBusy(true);
    void payFromWallet(request).then((result) => {
      if (run !== generation.current) {
        return;
      }
      setBusy(false);
      if (result.kind === 'confirm') {
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
  }, []);

  const submitInput = useCallback((): void => {
    if (pinned !== null || busy || state.step !== 'input') {
      return;
    }
    const run = generation.current;
    setBusy(true);
    void parseWalletInput(text).then((parsed) => {
      if (run !== generation.current) {
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
      if (target.type === 'request' && target.amountSats !== null && target.amountSats > 0) {
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
  }, [pinned, busy, state.step, text, prepare]);

  const submitAmount = useCallback(
    (sats: number | null): void => {
      if (pinned !== null || busy || state.step !== 'amount') {
        return;
      }
      const target = state.target;
      const { min, max } = walletSendBounds(target);
      if (sats === null || sats < min || sats > max) {
        setState({ step: 'amount', target, amountError: true });
        return;
      }
      if (target.type === 'lnurl') {
        const trimmed = comment.trim().slice(0, target.commentMaxLength);
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
    [pinned, busy, state, comment, prepare],
  );

  const confirm = useCallback((): void => {
    const send = sendRef.current;
    if (pinned !== null || busy || state.step !== 'confirm' || send === null) {
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
  }, [pinned, busy, state]);

  const cancel = useCallback((): boolean => {
    if (pinned !== null || state.step === 'input') {
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
  }, [pinned, state.step, busy]);

  return {
    state: pinned ?? state,
    busy: pinned === null ? busy : pin === 'send-confirm-sending',
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
