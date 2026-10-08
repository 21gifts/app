'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { CannotReceiveError, postMessageInvoice, WalletRequiredError } from '@/lib/api';
import { visualPin } from '@/lib/visual-pin';
import { canUnlockWallet, unlockWalletPhrase } from '@/lib/wallet/wallet-phrase';
import { payFromWallet, type WalletPayResult } from '@/lib/wallet/wallet-service';
import { needsWalletSetup } from '@/lib/wallet/wallet-setup';
import { useAuthStore } from '@/stores/auth-store';
import { useWalletStore, type WalletStatus } from '@/stores/wallet-store';

/** How long the filled heart and +1 stay after a paid send. */
export const HEART_TIP_PLUS_ONE_MS = 700;

/** Catalog-backed alert after a heart click that did not pay. */
export type HeartTipAlert =
  'sunday' | 'needsBalance' | 'rateLimit' | 'authorWallet' | 'request' | 'payFailed';

/** Per-message heart visuals for the forum board. */
export type HeartTipView = {
  /** True while the glyph is filled and scaled. */
  pressed: boolean;
  /** True after a paid send, while the +1 is shown. */
  plusOne: boolean;
  /** Inline `role="alert"` copy, or `null`. */
  alert: HeartTipAlert | null;
};

/** Result of one {@link sendHeartTip} run. */
export type HeartTipOutcome =
  { kind: 'noop' } | { kind: 'paid' } | { kind: 'alert'; alert: HeartTipAlert };

/** Inputs for one heart send. Wallet fields are the snapshot at click time. */
export type HeartTipInput = {
  /** Forum note or reply id. */
  messageId: string;
  /** Bearer session, or `null` when signed out. */
  sessionToken: string | null;
  /** True on a read-only board (signed-out living room). */
  readOnly: boolean;
  /** True when `documentElement.dataset.localSunday === '1'`. */
  isLocalSunday: boolean;
  /** Wallet lifecycle at click time. */
  walletStatus: WalletStatus;
  /** Confirmed balance when ready, otherwise `null`. */
  balanceSats: number | null;
  /** True when one-time wallet setup is still due. */
  needsWalletSetup: boolean;
  /** True when the account can unlock the in-app wallet. */
  canUnlockWallet: boolean;
};

/**
 * True when a thrown invoice error is the Sunday rest code.
 *
 * @param err - Caught rejection.
 * @returns Whether the api refused the heart because it is Sunday.
 */
function isSundayRestError(err: unknown): boolean {
  return err instanceof Error && /SUNDAY_REST/i.test(err.message);
}

/**
 * True when a thrown invoice error is the payment rate-limit copy.
 *
 * @param err - Caught rejection.
 * @returns Whether the message looks like a rate-limit error.
 */
function isRateLimitError(err: unknown): boolean {
  return err instanceof Error && /too many (messages|payments)/i.test(err.message);
}

/**
 * Maps an invoice rejection to the heart alert the board shows.
 *
 * @param err - Caught rejection from {@link postMessageInvoice}.
 * @returns The alert kind.
 */
function mapInvoiceError(err: unknown): HeartTipAlert {
  if (err instanceof WalletRequiredError) {
    return 'needsBalance';
  }
  if (err instanceof CannotReceiveError) {
    return 'authorWallet';
  }
  if (isSundayRestError(err)) {
    return 'sunday';
  }
  if (isRateLimitError(err)) {
    return 'rateLimit';
  }
  return 'request';
}

/**
 * True when the live wallet is ready with a confirmed zero balance.
 *
 * @returns Whether a heart must stop for {@link HeartTipAlert} `needsBalance`.
 */
function liveReadyBalanceIsZero(): boolean {
  const { status, balanceSats } = useWalletStore.getState();
  return status === 'ready' && balanceSats === 0;
}

/**
 * Pays a prepared heart invoice: `confirm` sends at once, even when the fee is
 * above ₿0. `insufficient` or a ready zero balance is `needsBalance`.
 *
 * @param result - Outcome of {@link payFromWallet}.
 * @returns Paid, or the alert to show.
 */
async function finishPreparedPay(result: WalletPayResult): Promise<HeartTipOutcome> {
  if (result.kind === 'insufficient' || liveReadyBalanceIsZero()) {
    return { kind: 'alert', alert: 'needsBalance' };
  }
  if (result.kind === 'confirm') {
    const sent = await result.send();
    if (sent.kind === 'paid') {
      return { kind: 'paid' };
    }
    if (sent.kind === 'insufficient') {
      return { kind: 'alert', alert: 'needsBalance' };
    }
    return { kind: 'alert', alert: 'request' };
  }
  if (result.kind === 'unlock') {
    return { kind: 'alert', alert: 'payFailed' };
  }
  return { kind: 'alert', alert: 'request' };
}

/**
 * Prepares the heart invoice in the in-app wallet and sends it. A locked but
 * unlockable wallet prompts once, then prepares and sends once.
 *
 * @param payInput - `sparkInvoice` when the api issued one, otherwise `pr`.
 * @param input - Click snapshot, including unlock eligibility.
 * @returns Paid, or the alert to show.
 */
async function payHeartInvoice(payInput: string, input: HeartTipInput): Promise<HeartTipOutcome> {
  const first = await payFromWallet({ type: 'input', input: payInput });
  if (first.kind === 'unlock') {
    if (!input.needsWalletSetup && input.canUnlockWallet) {
      const unlocked = await unlockWalletPhrase();
      if (unlocked !== 'unlocked') {
        return { kind: 'alert', alert: 'payFailed' };
      }
      const second = await payFromWallet({ type: 'input', input: payInput });
      return finishPreparedPay(second);
    }
    return { kind: 'alert', alert: 'request' };
  }
  return finishPreparedPay(first);
}

/**
 * Sends a 1-sat heart on a forum note or reply. No amount dialog, no gift
 * sheet, no comment text. A missing session or a read-only board is silent.
 * In a Playwright build, `?visual=heart-paid` (via {@link visualPin}) returns
 * paid without invoicing; that pin is ignored in production and does not
 * override signed-out or read-only. It is read before the Sunday check so a
 * Sunday clock cannot hide the shot.
 *
 * @param input - Click snapshot for one `messageId`.
 * @returns `noop`, `paid`, or an alert kind for the board.
 */
export async function sendHeartTip(input: HeartTipInput): Promise<HeartTipOutcome> {
  if (input.sessionToken === null || input.readOnly) {
    return { kind: 'noop' };
  }
  if (visualPin() === 'heart-paid') {
    return { kind: 'paid' };
  }
  if (input.isLocalSunday) {
    return { kind: 'alert', alert: 'sunday' };
  }
  if (
    input.walletStatus === 'ready' &&
    typeof input.balanceSats === 'number' &&
    input.balanceSats < 1
  ) {
    return { kind: 'alert', alert: 'needsBalance' };
  }
  if (input.needsWalletSetup) {
    return { kind: 'alert', alert: 'needsBalance' };
  }
  let invoice;
  try {
    invoice = await postMessageInvoice(
      input.sessionToken,
      input.messageId,
      1,
      undefined,
      undefined,
      true,
    );
  } catch (err) {
    return { kind: 'alert', alert: mapInvoiceError(err) };
  }
  const payInput =
    typeof invoice.sparkInvoice === 'string' && invoice.sparkInvoice !== ''
      ? invoice.sparkInvoice
      : invoice.pr;
  return payHeartInvoice(payInput, input);
}

/**
 * Heart-click machine for a forum board: vibrate, ignore a second click on the
 * same id while one run is in flight, and keep per-id pressed / +1 / alert.
 *
 * @param options - `readOnly` matches the board (`true` when signed out).
 * @returns Click handler and the per-id views to pass to the forum board.
 */
export function useHeartTip(options: { readOnly: boolean }): {
  onHeartTip: (messageId: string) => void;
  heartTipViews: Readonly<Record<string, HeartTipView>>;
} {
  const { readOnly } = options;
  const [heartTipViews, setHeartTipViews] = useState<Record<string, HeartTipView>>({});
  const inflightRef = useRef(new Set<string>());
  const timersRef = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      for (const timer of timers.values()) {
        clearTimeout(timer);
      }
      timers.clear();
    };
  }, []);

  const onHeartTip = useCallback(
    (messageId: string): void => {
      const sessionToken = useAuthStore.getState().session;
      if (sessionToken === null || readOnly) {
        return;
      }
      if (inflightRef.current.has(messageId)) {
        return;
      }
      inflightRef.current.add(messageId);
      if (typeof navigator.vibrate === 'function') {
        navigator.vibrate(10);
      }
      const existingTimer = timersRef.current.get(messageId);
      if (existingTimer !== undefined) {
        clearTimeout(existingTimer);
        timersRef.current.delete(messageId);
      }
      setHeartTipViews((prev) => ({
        ...prev,
        [messageId]: { pressed: true, plusOne: false, alert: null },
      }));
      const account = useAuthStore.getState().account;
      const wallet = useWalletStore.getState();
      const isLocalSunday =
        typeof document !== 'undefined' && document.documentElement.dataset['localSunday'] === '1';
      void sendHeartTip({
        messageId,
        sessionToken,
        readOnly,
        isLocalSunday,
        walletStatus: wallet.status,
        balanceSats: wallet.balanceSats,
        needsWalletSetup: needsWalletSetup(account),
        canUnlockWallet: canUnlockWallet(account),
      })
        .then((outcome) => {
          if (outcome.kind === 'paid') {
            setHeartTipViews((prev) => ({
              ...prev,
              [messageId]: { pressed: true, plusOne: true, alert: null },
            }));
            if (visualPin() === 'heart-paid') {
              return;
            }
            const timer = setTimeout(() => {
              timersRef.current.delete(messageId);
              setHeartTipViews((prev) => {
                const next = { ...prev };
                delete next[messageId];
                return next;
              });
            }, HEART_TIP_PLUS_ONE_MS);
            timersRef.current.set(messageId, timer);
            return;
          }
          /* v8 ignore start -- sendHeartTip cannot noop after the early return */
          if (outcome.kind !== 'alert') {
            setHeartTipViews((prev) => {
              const next = { ...prev };
              delete next[messageId];
              return next;
            });
            return;
          }
          /* v8 ignore stop */
          setHeartTipViews((prev) => ({
            ...prev,
            [messageId]: { pressed: false, plusOne: false, alert: outcome.alert },
          }));
        })
        .finally(() => {
          inflightRef.current.delete(messageId);
        });
    },
    [readOnly],
  );

  return { onHeartTip, heartTipViews };
}
