'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useWalletSetup } from '@/hooks/useWalletSetup';
import { visualPin } from '@/lib/visual-pin';
import { canUnlockWallet } from '@/lib/wallet/wallet-phrase';
import { walletNeedsReload } from '@/lib/wallet/wallet-sdk';
import { needsWalletSetup } from '@/lib/wallet/wallet-setup';
import {
  connectWallet,
  payFromWallet,
  refreshWallet,
  type WalletSendResult,
} from '@/lib/wallet/wallet-service';
import { logInteraction } from '@/lib/interaction-log';
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
 * How often the pay slot reads the synced wallet balance while `insufficient`
 * shows, so Bitcoin that arrives without a wallet event still ends that view.
 */
export const WALLET_PAY_BALANCE_POLL_MS = 4_000;

/**
 * What the pay slot of a pay sheet shows. The in-app wallet is the only way
 * to pay; there is no other wallet to hand the payment to.
 *
 * - `unavailable`: this account has no wallet it can pay from here (the wallet
 *   is not configured, or the account cannot hold one).
 * - `preparing`: the wallet connects, its one-time setup runs in the
 *   background, or it reads amount and fee.
 * - `setupFailed`: the background wallet setup gave up; the inline setup note
 *   offers **Try again**.
 * - `confirm`: fee shown, **Send** pays.
 * - `paying`: the payment is sent or was sent; the sheet's long-poll waits.
 * - `insufficient`: the balance does not cover the payment; the slot reads the
 *   synced balance every {@link WALLET_PAY_BALANCE_POLL_MS} and prepares again
 *   once it covers amount and known fee.
 * - `failed`: the wallet could not connect or could not prepare this
 *   payment; **Try again** starts over.
 * - `unconfirmed`: the sheet is still open {@link WALLET_PAY_CONFIRM_WAIT_MS}
 *   after a send (failed, timed out, or sent without a confirmation yet).
 */
export type WalletPayView =
  | 'unavailable'
  | 'preparing'
  | 'confirm'
  | 'paying'
  | 'insufficient'
  | 'failed'
  | 'setupFailed'
  | 'unconfirmed';

/** State and actions of the pay slot. */
export interface UseWalletPayResult {
  /** What the slot shows. */
  view: WalletPayView;
  /** Fee in whole sats from the prepare response, or `null` before it is known. */
  feeSats: number | null;
  /**
   * Whole sats still missing while `insufficient` shows: amount plus the known
   * fee minus the balance, or `null` when the balance is unknown or covers that.
   */
  missingSats: number | null;
  /** Sends the prepared payment once. */
  pay: () => void;
  /** Starts over after `failed`: connects the wallet again or prepares again. */
  retry: () => void;
}

type Phase =
  'idle' | 'preparing' | 'confirm' | 'paying' | 'insufficient' | 'unconfirmed' | 'failed';

/** The invoice and sheet amount a prepared send belongs to. */
interface PreparedKey {
  input: string;
  amountSats: number;
}

/** A prepared send together with the invoice and amount it was prepared for. */
interface PreparedSend extends PreparedKey {
  send: () => Promise<WalletSendResult>;
}

/**
 * Whether a prepared send belongs to the invoice and amount the sheet shows now.
 *
 * @param key - Prepared send or its key, or `null`.
 * @param input - Current request text.
 * @param amountSats - Current sheet amount.
 * @returns `true` only for a prepared send of this invoice and amount.
 */
function preparedMatches<T extends PreparedKey>(
  key: T | null,
  input: string,
  amountSats: number,
): key is T {
  return key !== null && key.input === input && key.amountSats === amountSats;
}

const VISUAL_VIEWS: Record<string, WalletPayView> = {
  'wallet-pay-unavailable': 'unavailable',
  'wallet-pay-preparing': 'preparing',
  'wallet-pay-confirm': 'confirm',
  'wallet-pay-paying': 'paying',
  'wallet-pay-insufficient': 'insufficient',
  'wallet-pay-failed': 'failed',
  'wallet-pay-setup-failed': 'setupFailed',
  'wallet-pay-unconfirmed': 'unconfirmed',
};

/**
 * Pinned view from `?visual=wallet-pay-…`, honoured only in a Playwright build.
 *
 * @returns The pinned view, or `null`.
 */
function visualView(): WalletPayView | null {
  const visual = visualPin();
  return visual === null ? null : (VISUAL_VIEWS[visual] ?? null);
}

/**
 * Runs the in-app wallet payment of one invoice. The wallet pays
 * `sparkInvoice` when the api issued one, otherwise the payment request `pr`.
 * The view is `unavailable` when the wallet is not configured or the member
 * cannot hold it. A signed-in member's wallet is open in this tab
 * (`OnboardingGate` shows the login otherwise), so there is no unlock step:
 * once the wallet is `ready` the slot prepares at once so the fee is shown
 * before **Send**. While the one-time wallet setup is still due the
 * slot shows `preparing`, and prepares once the setup is done; a setup that
 * gave up shows `setupFailed`. A prepared amount that differs from
 * `amountSats`, a failed prepare, and a wallet in `error` show `failed`. A
 * wallet that leaves
 * `ready` before the send or while `insufficient` shows, or an account that
 * stops being able to pay from it then, starts over. After
 * `insufficient`, a balance that covers amount and the known fee and is above
 * the one held when that prepare or send started, or the lowest one seen since
 * (or a first known balance that covers them), prepares again and ends at
 * `confirm`; a send is never retried on its own. While `insufficient` shows,
 * the slot reads the synced balance every {@link WALLET_PAY_BALANCE_POLL_MS},
 * one read at a time; a failed read leaves the wallet and the view as they
 * are, and the next one tries again. `missingSats` is amount plus the known fee minus the
 * balance. A new request or a new
 * `amountSats` starts over, and a send prepared for an earlier one is never
 * shown or paid. Visual pins (`?visual=wallet-pay-…`) apply only in a
 * Playwright build and leave the actions inert.
 *
 * @param sparkInvoice - Request the api issued for the in-app wallet, or `null`/`undefined`.
 * @param pr - Payment request of the same invoice, paid when there is no `sparkInvoice`.
 * @param amountSats - Amount the sheet shows; a prepared payment of another amount is not offered.
 * @returns View, fee, missing amount, and the pay and retry actions.
 */
export function useWalletPay(
  sparkInvoice: string | null | undefined,
  pr: string,
  amountSats: number,
): UseWalletPayResult {
  const status = useWalletStore((state) => state.status);
  const balanceSats = useWalletStore((state) => state.balanceSats);
  const account = useAuthStore((state) => state.account);
  const [phase, setPhase] = useState<Phase>('idle');
  const [feeSats, setFeeSats] = useState<number | null>(null);
  const sendRef = useRef<PreparedSend | null>(null);
  const [preparedFor, setPreparedFor] = useState<PreparedKey | null>(null);
  const generation = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const insufficientBalance = useRef<number | null>(null);
  const input = typeof sparkInvoice === 'string' && sparkInvoice !== '' ? sparkInvoice : pr;
  const pinned = visualView();
  const usable = pinned === null && status !== 'disabled' && canUnlockWallet(account);
  const setupDue = needsWalletSetup(account);
  const setupFailed = useWalletSetup().failed;
  const canPay = usable && !setupDue;

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
  }, [input, amountSats]);

  const sendPrepared = useCallback(
    (send: () => Promise<WalletSendResult>, run: number, sats: number): void => {
      const balanceBefore = useWalletStore.getState().balanceSats;
      setPhase('paying');
      void send().then((result) => {
        if (run !== generation.current) {
          return;
        }
        if (result.kind === 'insufficient') {
          insufficientBalance.current = balanceBefore;
          setPhase('insufficient');
          return;
        }
        if (result.kind === 'paid') {
          logInteraction('gift_sent', { amountSats: sats });
        }
        timer.current = setTimeout(() => {
          timer.current = null;
          if (run === generation.current) {
            setPhase('unconfirmed');
          }
        }, WALLET_PAY_CONFIRM_WAIT_MS);
      });
    },
    [],
  );

  useEffect(() => {
    if (!canPay || status !== 'ready' || phase !== 'idle') {
      return;
    }
    const run = generation.current;
    const balanceBefore = useWalletStore.getState().balanceSats;
    setPhase('preparing');
    void payFromWallet({ type: 'input', input }).then((result) => {
      if (run !== generation.current) {
        return;
      }
      if (result.kind === 'confirm' && result.amountSats !== amountSats) {
        setPhase('failed');
      } else if (result.kind === 'confirm') {
        sendRef.current = { send: result.send, input, amountSats };
        setPreparedFor({ input, amountSats });
        setFeeSats(result.feeSats);
        setPhase('confirm');
      } else if (result.kind === 'insufficient') {
        insufficientBalance.current = balanceBefore;
        setFeeSats(result.feeSats ?? null);
        setPhase('insufficient');
      } else {
        setPhase('failed');
      }
    });
  }, [canPay, status, phase, input, amountSats]);

  useEffect(() => {
    if (phase !== 'insufficient' || balanceSats === null) {
      return;
    }
    const seen = insufficientBalance.current;
    const covers = balanceSats >= amountSats + (feeSats ?? 0);
    if (!covers || (seen !== null && balanceSats <= seen)) {
      if (seen === null || balanceSats < seen) {
        insufficientBalance.current = balanceSats;
      }
      return;
    }
    generation.current += 1;
    insufficientBalance.current = null;
    setPhase('idle');
  }, [phase, balanceSats, amountSats, feeSats]);

  useEffect(() => {
    if (phase !== 'insufficient' || status !== 'ready' || !canPay) {
      return;
    }
    let reading = false;
    const poll = setInterval(() => {
      if (reading) {
        return;
      }
      reading = true;
      void refreshWallet({ ensureSynced: true, ignoreFailure: true }).finally(() => {
        reading = false;
      });
    }, WALLET_PAY_BALANCE_POLL_MS);
    return () => {
      clearInterval(poll);
    };
  }, [phase, status, canPay]);

  useEffect(() => {
    if (
      (status === 'ready' && canPay) ||
      (phase !== 'preparing' && phase !== 'confirm' && phase !== 'insufficient')
    ) {
      return;
    }
    generation.current += 1;
    insufficientBalance.current = null;
    sendRef.current = null;
    setFeeSats(null);
    setPhase('idle');
  }, [status, canPay, phase]);

  const pay = useCallback((): void => {
    const prepared = sendRef.current;
    if (
      pinned !== null ||
      !canPay ||
      phase !== 'confirm' ||
      !preparedMatches(prepared, input, amountSats)
    ) {
      return;
    }
    sendRef.current = null;
    sendPrepared(prepared.send, generation.current, prepared.amountSats);
  }, [pinned, canPay, phase, input, amountSats, sendPrepared]);

  const retry = useCallback((): void => {
    if (pinned !== null) {
      return;
    }
    generation.current += 1;
    insufficientBalance.current = null;
    sendRef.current = null;
    setFeeSats(null);
    setPhase('idle');
    if (useWalletStore.getState().status !== 'error') {
      return;
    }
    if (walletNeedsReload()) {
      window.location.reload();
      return;
    }
    void connectWallet();
  }, [pinned]);

  if (pinned !== null) {
    return { view: pinned, feeSats: 0, missingSats: amountSats, pay, retry };
  }
  let view: WalletPayView;
  if (!usable) {
    view = 'unavailable';
  } else if (setupDue && setupFailed) {
    view = 'setupFailed';
  } else if (setupDue && phase === 'idle') {
    view = 'preparing';
  } else if (phase === 'idle' && status === 'error') {
    view = 'failed';
  } else if (phase === 'idle') {
    view = 'preparing';
  } else if (phase === 'confirm') {
    view = preparedMatches(preparedFor, input, amountSats) ? 'confirm' : 'preparing';
  } else {
    view = phase;
  }
  const missing = amountSats + (feeSats ?? 0) - (balanceSats ?? 0);
  const missingSats =
    phase === 'insufficient' && balanceSats !== null && missing > 0 ? missing : null;
  return { view, feeSats, missingSats, pay, retry };
}
