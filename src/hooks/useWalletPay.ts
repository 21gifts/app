'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { getE2eNow } from '@/lib/config';
import { canUnlockWallet, unlockWalletPhrase } from '@/lib/wallet/wallet-phrase';
import { payFromWallet, type WalletSendResult } from '@/lib/wallet/wallet-service';
import { useAuthStore } from '@/stores/auth-store';
import { useWalletStore } from '@/stores/wallet-store';

/**
 * How long a pay sheet keeps waiting on its long-poll after a send, before it
 * shows the neutral "not confirmed yet" sentence. A confirmation closes the
 * sheet earlier. Applies to a send that failed or timed out, and to a sent
 * payment whose screen has no long-poll that closes the sheet (repayment).
 */
export const WALLET_PAY_CONFIRM_WAIT_MS = 60_000;

/**
 * What the in-app pay slot of a pay sheet shows.
 *
 * - `fallback`: the existing desktop invoice QR plus Wallet of Satoshi button
 *   (smartphone: button only).
 * - `unlock`: one passkey prompt opens the wallet.
 * - `preparing`: the wallet opens or reads amount and fee.
 * - `confirm`: fee shown, **Pay from wallet** pays.
 * - `paying`: the payment is sent or was sent; the sheet's long-poll waits.
 * - `insufficient`: the balance does not cover the payment.
 * - `unconfirmed`: the sheet is still open {@link WALLET_PAY_CONFIRM_WAIT_MS}
 *   after a send (failed, timed out, or sent without a confirmation yet).
 */
export type WalletPayView =
  'fallback' | 'unlock' | 'preparing' | 'confirm' | 'paying' | 'insufficient' | 'unconfirmed';

/** State and actions of the in-app pay slot. */
export interface UseWalletPayResult {
  /** What the slot shows. */
  view: WalletPayView;
  /** Fee in whole sats from the prepare response, or `null` before it is known. */
  feeSats: number | null;
  /** Opens the wallet with the member's passkey. */
  unlock: () => void;
  /** Sends the prepared payment once. */
  pay: () => void;
}

type Phase =
  | 'idle'
  | 'unlocking'
  | 'preparing'
  | 'confirm'
  | 'paying'
  | 'insufficient'
  | 'unconfirmed'
  | 'failed';

const VISUAL_VIEWS: Record<string, WalletPayView> = {
  'wallet-pay-unlock': 'unlock',
  'wallet-pay-preparing': 'preparing',
  'wallet-pay-confirm': 'confirm',
  'wallet-pay-paying': 'paying',
  'wallet-pay-insufficient': 'insufficient',
  'wallet-pay-unconfirmed': 'unconfirmed',
};

/**
 * Pinned view from `?visual=wallet-pay-…`, honoured only in a Playwright build.
 *
 * @returns The pinned view, or `null`.
 */
function visualView(): WalletPayView | null {
  /* v8 ignore next 3 -- SSR has no window */
  if (typeof window === 'undefined') {
    return null;
  }
  if (getE2eNow() === null) {
    return null;
  }
  const visual = new URLSearchParams(window.location.search).get('visual');
  return visual === null ? null : (VISUAL_VIEWS[visual] ?? null);
}

/**
 * Chooses and runs the in-app pay path for one invoice. The in-app path is
 * offered only when `sparkInvoice` is a string and the member's wallet is
 * ready, opening, or can be unlocked with one passkey prompt; otherwise the
 * view is `fallback`. A ready wallet prepares at once so the fee is shown
 * before **Pay from wallet**; a prepared amount that differs from
 * `amountSats` falls back. A wallet that leaves `ready` before the send
 * starts over (unlock, opening, or the fallback). After `insufficient`, a
 * balance above the lowest one seen since (or a first known balance) prepares
 * again; a send is never retried on its own. Visual pins (`?visual=wallet-pay-…`)
 * apply only in a Playwright build, only with a `sparkInvoice`, and leave the
 * actions inert.
 *
 * @param sparkInvoice - Request the api issued for the in-app wallet, or `null`/`undefined`.
 * @param amountSats - Amount the sheet shows; a prepared payment of another amount is not offered.
 * @returns View, fee, and the unlock and pay actions.
 */
export function useWalletPay(
  sparkInvoice: string | null | undefined,
  amountSats: number,
): UseWalletPayResult {
  const status = useWalletStore((state) => state.status);
  const balanceSats = useWalletStore((state) => state.balanceSats);
  const account = useAuthStore((state) => state.account);
  const [phase, setPhase] = useState<Phase>('idle');
  const [feeSats, setFeeSats] = useState<number | null>(null);
  const sendRef = useRef<(() => Promise<WalletSendResult>) | null>(null);
  const generation = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const insufficientBalance = useRef<number | null>(null);
  const input = typeof sparkInvoice === 'string' && sparkInvoice !== '' ? sparkInvoice : null;
  const pinned = input === null ? null : visualView();
  const usable =
    input !== null &&
    pinned === null &&
    canUnlockWallet(account) &&
    (status === 'ready' || status === 'locked' || status === 'connecting');

  useEffect(() => {
    generation.current += 1;
    sendRef.current = null;
    setPhase('idle');
    setFeeSats(null);
    return () => {
      generation.current += 1;
      if (timer.current !== null) {
        clearTimeout(timer.current);
        timer.current = null;
      }
    };
  }, [input]);

  useEffect(() => {
    if (!usable || status !== 'ready' || phase !== 'idle' || input === null) {
      return;
    }
    const run = generation.current;
    setPhase('preparing');
    void payFromWallet({ type: 'input', input }).then((result) => {
      if (run !== generation.current) {
        return;
      }
      if (result.kind === 'confirm' && result.amountSats !== amountSats) {
        setPhase('failed');
      } else if (result.kind === 'confirm') {
        sendRef.current = result.send;
        setFeeSats(result.feeSats);
        setPhase('confirm');
      } else if (result.kind === 'insufficient') {
        insufficientBalance.current = useWalletStore.getState().balanceSats;
        setPhase('insufficient');
      } else {
        setPhase('failed');
      }
    });
  }, [usable, status, phase, input, amountSats]);

  useEffect(() => {
    if (phase !== 'insufficient' || balanceSats === null) {
      return;
    }
    const seen = insufficientBalance.current;
    if (seen !== null && balanceSats <= seen) {
      insufficientBalance.current = balanceSats;
      return;
    }
    generation.current += 1;
    insufficientBalance.current = null;
    setPhase('idle');
  }, [phase, balanceSats]);

  useEffect(() => {
    if (status === 'ready' || (phase !== 'preparing' && phase !== 'confirm')) {
      return;
    }
    generation.current += 1;
    sendRef.current = null;
    setFeeSats(null);
    setPhase('idle');
  }, [status, phase]);

  const unlock = useCallback((): void => {
    if (pinned !== null || phase !== 'idle') {
      return;
    }
    const run = generation.current;
    setPhase('unlocking');
    void unlockWalletPhrase().then((result) => {
      if (run !== generation.current) {
        return;
      }
      setPhase(result === 'failed' ? 'failed' : 'idle');
    });
  }, [pinned, phase]);

  const pay = useCallback((): void => {
    const send = sendRef.current;
    if (pinned !== null || phase !== 'confirm' || send === null) {
      return;
    }
    sendRef.current = null;
    const run = generation.current;
    setPhase('paying');
    void send().then((result) => {
      if (run !== generation.current) {
        return;
      }
      if (result.kind === 'insufficient') {
        insufficientBalance.current = useWalletStore.getState().balanceSats;
        setPhase('insufficient');
        return;
      }
      timer.current = setTimeout(() => {
        timer.current = null;
        if (run === generation.current) {
          setPhase('unconfirmed');
        }
      }, WALLET_PAY_CONFIRM_WAIT_MS);
    });
  }, [pinned, phase]);

  if (pinned !== null) {
    return { view: pinned, feeSats: 0, unlock, pay };
  }
  let view: WalletPayView;
  switch (phase) {
    case 'preparing':
    case 'confirm':
    case 'paying':
    case 'insufficient':
    case 'unconfirmed':
      view = phase;
      break;
    case 'failed':
      view = 'fallback';
      break;
    default:
      if (!usable) {
        view = 'fallback';
      } else if (status === 'locked' && phase === 'idle') {
        view = 'unlock';
      } else {
        view = 'preparing';
      }
  }
  return { view, feeSats, unlock, pay };
}
