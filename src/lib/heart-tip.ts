'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { CannotReceiveError, postMessageInvoice, WalletRequiredError } from '@/lib/api';
import { logInteraction } from '@/lib/interaction-log';
import { visualPin } from '@/lib/visual-pin';
import { canUnlockWallet, unlockWalletPhrase } from '@/lib/wallet/wallet-phrase';
import {
  listWalletPayments,
  payFromWallet,
  type WalletPayResult,
} from '@/lib/wallet/wallet-service';
import { needsWalletSetup } from '@/lib/wallet/wallet-setup';
import { useAuthStore } from '@/stores/auth-store';
import { useWalletStore, type WalletStatus } from '@/stores/wallet-store';

/** How long the filled heart and +1 stay after a paid send. */
export const HEART_TIP_PLUS_ONE_MS = 700;

/**
 * How long a heart whose send timed out blocks another heart on the same note
 * while the wallet's payment list does not show it at all.
 */
export const HEART_TIP_UNSETTLED_MS = 10 * 60_000;

/** How many of the newest wallet payments are searched for a timed-out heart. */
const HEART_TIP_LOOKUP_LIMIT = 50;

/** Catalog-backed alert after a heart click that did not pay. */
export type HeartTipAlert =
  | 'sunday'
  | 'needsBalance'
  | 'rateLimit'
  | 'authorWallet'
  | 'request'
  | 'payFailed'
  | 'unavailable'
  | 'pending';

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

/**
 * A heart whose send timed out: the Spark invoice it paid, when, and `sent`
 * once the SDK reported that the late send went out.
 */
type UnsettledHeart = { invoice: string; sinceMs: number; sent: boolean };

/**
 * Hearts whose send timed out, by note id, for this tab. The payment may still
 * complete, so another heart on that note waits until the outcome is known.
 */
const unsettledHearts = new Map<string, UnsettledHeart>();

/**
 * Note ids with a heart run in progress in this tab, across every board, so a
 * board mounted again during a send cannot start a second heart on that note.
 */
const heartsInFlight = new Set<string>();

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
 * True when a thrown invoice error is the api's code for a heart it cannot
 * issue as a fee-free Spark invoice.
 *
 * @param err - Caught rejection.
 * @returns Whether the api refused the heart as unavailable.
 */
function isHeartUnavailableError(err: unknown): boolean {
  return err instanceof Error && /HEART_UNAVAILABLE/.test(err.message);
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
  if (isHeartUnavailableError(err)) {
    return 'unavailable';
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
 * Pays a prepared heart invoice. `confirm` sends at once, but only when the
 * prepared payment is exactly 1 sat with a fee of ₿0; anything else is
 * `unavailable` and nothing is sent. `insufficient` or a ready zero balance is
 * `needsBalance`. A sent heart is recorded as `heart_sent` under the session
 * of the click, also when the SDK finishes a send the app stopped waiting for.
 * A send that timed out (`sentLate`) is remembered for this note until its
 * outcome is known, so a retap waits instead of paying again: `sentLate`
 * `true` marks it sent, `false` forgets it.
 *
 * @param result - Outcome of {@link payFromWallet}.
 * @param input - Click snapshot: the message id and the session.
 * @param invoice - Spark invoice that was prepared.
 * @returns Paid, or the alert to show.
 */
async function finishPreparedPay(
  result: WalletPayResult,
  input: HeartTipInput,
  invoice: string,
): Promise<HeartTipOutcome> {
  if (result.kind === 'insufficient' || liveReadyBalanceIsZero()) {
    return { kind: 'alert', alert: 'needsBalance' };
  }
  if (result.kind === 'confirm') {
    if (result.amountSats !== 1 || result.feeSats > 0) {
      return { kind: 'alert', alert: 'unavailable' };
    }
    const sent = await result.send();
    const recordHeart = (): void => {
      logInteraction(
        'heart_sent',
        { messageId: input.messageId, amountSats: 1 },
        input.sessionToken,
      );
    };
    if (sent.kind === 'paid') {
      recordHeart();
      return { kind: 'paid' };
    }
    if (sent.kind === 'insufficient') {
      return { kind: 'alert', alert: 'needsBalance' };
    }
    if (sent.kind === 'failed' && sent.sentLate !== undefined) {
      const held: UnsettledHeart = { invoice, sinceMs: Date.now(), sent: false };
      unsettledHearts.set(input.messageId, held);
      void sent.sentLate.then((late) => {
        if (late) {
          recordHeart();
          held.sent = true;
        } else if (unsettledHearts.get(input.messageId) === held) {
          unsettledHearts.delete(input.messageId);
        }
      });
      return { kind: 'alert', alert: 'pending' };
    }
    return { kind: 'alert', alert: 'request' };
  }
  if (result.kind === 'unlock') {
    return { kind: 'alert', alert: 'payFailed' };
  }
  return { kind: 'alert', alert: 'request' };
}

/**
 * Settles a heart on this note whose send timed out. A late send the SDK
 * reported as sent counts as paid and nothing new is sent. Otherwise the
 * wallet's newest payments decide: a completed payment is the heart that was asked for, so it counts
 * as paid and nothing new is sent. A failed payment, or one still missing
 * after {@link HEART_TIP_UNSETTLED_MS}, clears the note. A pending payment, a
 * payment not listed yet, or a list that cannot be read keeps it waiting.
 *
 * @param messageId - Note the heart is for.
 * @returns `clear` to send a new heart, `paid`, or `pending`.
 */
async function settleUnsettledHeart(messageId: string): Promise<'clear' | 'paid' | 'pending'> {
  const held = unsettledHearts.get(messageId);
  if (held === undefined) {
    return 'clear';
  }
  if (held.sent) {
    unsettledHearts.delete(messageId);
    return 'paid';
  }
  let payments;
  try {
    payments = await listWalletPayments({ offset: 0, limit: HEART_TIP_LOOKUP_LIMIT });
  } catch {
    return 'pending';
  }
  const match = payments.find(
    (payment) => payment.direction === 'sent' && payment.info.invoice === held.invoice,
  );
  if (match === undefined) {
    if (Date.now() - held.sinceMs < HEART_TIP_UNSETTLED_MS) {
      return 'pending';
    }
    unsettledHearts.delete(messageId);
    return 'clear';
  }
  if (match.status === 'pending') {
    return 'pending';
  }
  unsettledHearts.delete(messageId);
  return match.status === 'completed' ? 'paid' : 'clear';
}

/**
 * Prepares the heart invoice in the in-app wallet and sends it. A locked but
 * unlockable wallet prompts once, then prepares and sends once.
 *
 * @param sparkInvoice - The api's fee-free Spark invoice for this heart.
 * @param input - Click snapshot, including unlock eligibility.
 * @returns Paid, or the alert to show.
 */
async function payHeartInvoice(
  sparkInvoice: string,
  input: HeartTipInput,
): Promise<HeartTipOutcome> {
  const first = await payFromWallet({ type: 'input', input: sparkInvoice });
  if (first.kind === 'unlock') {
    if (!input.needsWalletSetup && input.canUnlockWallet) {
      const unlocked = await unlockWalletPhrase();
      if (unlocked !== 'unlocked') {
        return { kind: 'alert', alert: 'payFailed' };
      }
      const second = await payFromWallet({ type: 'input', input: sparkInvoice });
      return finishPreparedPay(second, input, sparkInvoice);
    }
    return { kind: 'alert', alert: 'request' };
  }
  return finishPreparedPay(first, input, sparkInvoice);
}

/**
 * Sends a 1-sat heart on a forum note or reply. No amount dialog, no gift
 * sheet, no comment text. A missing session or a read-only board is silent.
 * A heart is paid only through the api's fee-free Spark invoice, for exactly
 * 1 sat and a fee of ₿0: without a Spark invoice, or when the prepared payment
 * differs, nothing is sent and the alert is `unavailable` (never the
 * Lightning `pr`). While an earlier heart on the same note timed out and its
 * outcome is not known, or while another heart on the same note is still in
 * progress in this tab (also from a board mounted again), nothing is invoiced
 * and the alert is `pending`.
 * In a Playwright build, `?visual=heart-paid` (via {@link visualPin}) returns
 * paid and `?visual=heart-pending` returns the `pending` alert, both without
 * invoicing; those pins are ignored in production and do not override
 * signed-out or read-only. They are read before the Sunday check so a Sunday
 * clock cannot hide the shot.
 *
 * @param input - Click snapshot for one `messageId`.
 * @returns `noop`, `paid`, or an alert kind for the board.
 */
export async function sendHeartTip(input: HeartTipInput): Promise<HeartTipOutcome> {
  if (input.sessionToken === null || input.readOnly) {
    return { kind: 'noop' };
  }
  const pin = visualPin();
  if (pin === 'heart-paid') {
    return { kind: 'paid' };
  }
  if (pin === 'heart-pending') {
    return { kind: 'alert', alert: 'pending' };
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
  if (heartsInFlight.has(input.messageId)) {
    return { kind: 'alert', alert: 'pending' };
  }
  heartsInFlight.add(input.messageId);
  try {
    return await invoiceAndPayHeart(input.messageId, input.sessionToken, input);
  } finally {
    heartsInFlight.delete(input.messageId);
  }
}

/**
 * Settles an earlier timed-out heart on this note, then invoices and pays a
 * new one through the api's Spark invoice only.
 *
 * @param messageId - Note the heart is for.
 * @param sessionToken - Bearer session.
 * @param input - Click snapshot.
 * @returns Paid, or the alert to show.
 */
async function invoiceAndPayHeart(
  messageId: string,
  sessionToken: string,
  input: HeartTipInput,
): Promise<HeartTipOutcome> {
  const held = await settleUnsettledHeart(messageId);
  if (held === 'paid') {
    return { kind: 'paid' };
  }
  if (held === 'pending') {
    return { kind: 'alert', alert: 'pending' };
  }
  let invoice;
  try {
    invoice = await postMessageInvoice(sessionToken, messageId, 1, undefined, undefined, true);
  } catch (err) {
    return { kind: 'alert', alert: mapInvoiceError(err) };
  }
  if (typeof invoice.sparkInvoice !== 'string' || invoice.sparkInvoice === '') {
    return { kind: 'alert', alert: 'unavailable' };
  }
  return payHeartInvoice(invoice.sparkInvoice, input);
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
            [messageId]: {
              pressed: outcome.alert === 'pending',
              plusOne: false,
              alert: outcome.alert,
            },
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
