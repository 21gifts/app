'use client';

import { captureMessage } from '@sentry/nextjs';
import { useCallback, useEffect, useRef, useState } from 'react';
import { CannotReceiveError, postMessageInvoice, WalletRequiredError } from '@/lib/api';
import { logInteraction } from '@/lib/interaction-log';
import { visualPin } from '@/lib/visual-pin';
import { reportPaymentFailure, type PaymentFailure } from '@/lib/wallet/payment-failure';
import { canUnlockWallet, unlockWalletPhrase } from '@/lib/wallet/wallet-phrase';
import {
  listWalletPayments,
  payFromWallet,
  type WalletPayResult,
} from '@/lib/wallet/wallet-service';
import { needsWalletSetup } from '@/lib/wallet/wallet-setup';
import { useAuthStore } from '@/stores/auth-store';
import { useWalletStore, type WalletStatus } from '@/stores/wallet-store';

/**
 * How long the filled heart and +1 stay after a tap: the length of the
 * `forum-heart-plus-one` animation, so the +1 finishes before the heart resets.
 */
export const HEART_TIP_PLUS_ONE_MS = 700;

/**
 * How long a heart whose send timed out blocks another heart on the same note
 * while the wallet's payment list does not show it at all.
 */
export const HEART_TIP_UNSETTLED_MS = 10 * 60_000;

/** How many of the newest wallet payments are searched for a timed-out heart. */
const HEART_TIP_LOOKUP_LIMIT = 50;

/**
 * Why a heart was not sent. `no_balance`, known from the wallet snapshot
 * before the tap, is shown to the member (the balance-required line) and is
 * not reported. `author_cannot_receive` (the api answered `cannot_receive`) is
 * reported and also shown, as the author-wallet line under the heart. Every
 * other reason is reported to error reporting, together with the message id,
 * and shows nothing. `insufficient_balance` is a balance the wallet found too
 * low only after the tap already showed the +1.
 */
export type HeartTipFailure =
  | 'sunday'
  | 'no_balance'
  | 'insufficient_balance'
  | 'wallet_setup_due'
  | 'author_cannot_receive'
  | 'rate_limited'
  | 'heart_unavailable'
  | 'request_failed'
  | 'payment_failed'
  | 'timeout_pending'
  | 'in_flight';

/** Per-message heart visuals for the forum board. */
export type HeartTipView = {
  /** True while the glyph is filled. */
  pressed: boolean;
  /** True while the +1 is shown. */
  plusOne: boolean;
  /** True after a tap the wallet balance cannot cover: shows the balance-required line. */
  needsBalance: boolean;
  /**
   * True after a heart the api refused because the author cannot receive
   * (`cannot_receive`): shows the author-wallet line. Missing reads as false;
   * the next tap clears it.
   */
  cannotReceive?: boolean;
  /**
   * Hearts this session that the server `heartCount` does not yet include.
   * Missing reads as 0 (`view?.extra ?? 0`). The hook always sets a number.
   */
  extra?: number;
};

/** sessionStorage key for hearts sent this tab session. */
const HEART_SENT_STORAGE_KEY = '21gifts.heart.sent';

/** One note's session hearts: server `base` at first tap, plus uncounted `extra`. */
type HeartSentEntry = { base: number; extra: number };

/** sessionStorage map of note id to {@link HeartSentEntry}. */
type HeartSentMap = Record<string, HeartSentEntry>;

/**
 * True when `value` is a non-negative integer.
 *
 * @param value - Unknown JSON value.
 * @returns Whether it can be a stored heart count.
 */
function isNonNegativeInt(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

/**
 * True when `value` is a stored heart-sent entry.
 *
 * @param value - Unknown JSON value.
 * @returns Whether it has integer `base` and `extra`.
 */
function isHeartSentEntry(value: unknown): value is HeartSentEntry {
  if (value === null || typeof value !== 'object') {
    return false;
  }
  const record = value as Record<string, unknown>;
  return isNonNegativeInt(record['base']) && isNonNegativeInt(record['extra']);
}

/**
 * Reads {@link HEART_SENT_STORAGE_KEY} in the browser. Missing, unreadable, or
 * corrupt JSON is an empty map. Never throws; never touches storage on the server.
 *
 * @returns The stored map, omitting invalid entries and extra-0 rows.
 */
function readHeartSentMap(): HeartSentMap {
  if (typeof sessionStorage === 'undefined') {
    return {};
  }
  try {
    const raw = sessionStorage.getItem(HEART_SENT_STORAGE_KEY);
    if (raw === null) {
      return {};
    }
    const parsed: unknown = JSON.parse(raw);
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {};
    }
    const next: HeartSentMap = {};
    for (const [id, entry] of Object.entries(parsed)) {
      if (isHeartSentEntry(entry) && entry.extra > 0) {
        next[id] = { base: entry.base, extra: entry.extra };
      }
    }
    return next;
  } catch {
    return {};
  }
}

/**
 * Writes {@link HEART_SENT_STORAGE_KEY}. A storage error is ignored.
 *
 * @param map - Current session map.
 */
function writeHeartSentMap(map: HeartSentMap): void {
  if (typeof sessionStorage === 'undefined') {
    return;
  }
  try {
    sessionStorage.setItem(HEART_SENT_STORAGE_KEY, JSON.stringify(map));
  } catch {
    /* ignore quota / access errors; the tap and the payment still run */
  }
}

/**
 * Value signature of `heartCounts`: sorted `id:count` pairs. Equal numbers in a
 * new object identity must not reconcile again.
 *
 * @param counts - Id to server heart count.
 * @returns Stable signature string.
 */
function heartCountsSignature(counts: Readonly<Record<string, number>>): string {
  return Object.keys(counts)
    .sort()
    .map((id) => `${id}:${String(counts[id])}`)
    .join('|');
}

/**
 * Session extra for `id`, or 0 when the map has no row.
 *
 * @param map - Session map.
 * @param id - Note id.
 * @returns Extra hearts this session.
 */
function mapExtra(map: HeartSentMap, id: string): number {
  const entry = map[id];
  return entry === undefined ? 0 : entry.extra;
}

/** Result of one {@link sendHeartTip} run. */
export type HeartTipOutcome =
  { kind: 'noop' } | { kind: 'paid' } | { kind: 'failed'; reason: HeartTipFailure };

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
 * Maps an invoice rejection to the reason the heart was not sent.
 *
 * @param err - Caught rejection from {@link postMessageInvoice}.
 * @returns The reason code.
 */
function mapInvoiceError(err: unknown): HeartTipFailure {
  if (err instanceof WalletRequiredError) {
    return 'wallet_setup_due';
  }
  if (err instanceof CannotReceiveError) {
    return 'author_cannot_receive';
  }
  if (isSundayRestError(err)) {
    return 'sunday';
  }
  if (isRateLimitError(err)) {
    return 'rate_limited';
  }
  if (isHeartUnavailableError(err)) {
    return 'heart_unavailable';
  }
  return 'request_failed';
}

/**
 * True when the wallet snapshot already shows that the balance cannot cover
 * a 1-sat heart: the wallet is ready with less than 1 sat. In a Playwright
 * build, `?visual=heart-needs-balance` (via {@link visualPin}) forces it for
 * the screenshot; production ignores that pin.
 *
 * @param input - Click snapshot.
 * @returns Whether the heart stops with `no_balance` before any request.
 */
function lacksHeartBalance(input: HeartTipInput): boolean {
  if (visualPin() === 'heart-needs-balance') {
    return true;
  }
  return (
    input.walletStatus === 'ready' && typeof input.balanceSats === 'number' && input.balanceSats < 1
  );
}

/**
 * Reports a heart that was not sent to error reporting (a no-op while error
 * reporting is off). The event carries the reason code and the message id
 * only, and goes through the same scrubber as every other report.
 *
 * @param messageId - Note or reply the heart was for.
 * @param reason - Why it was not sent.
 */
function reportHeartFailure(messageId: string, reason: HeartTipFailure): void {
  captureMessage('Heart not sent', {
    level: 'error',
    fingerprint: ['heart-not-sent', reason],
    tags: { heart_reason: reason },
    extra: { messageId },
  });
}

/**
 * True when the live wallet is ready with a confirmed zero balance.
 *
 * @returns Whether a heart must stop with `insufficient_balance`.
 */
function liveReadyBalanceIsZero(): boolean {
  const { status, balanceSats } = useWalletStore.getState();
  return status === 'ready' && balanceSats === 0;
}

/**
 * Records a heart payment that did not go out as the member event
 * `payment_failed` (flow `heart`, 1 sat). Hearts are not sent to error
 * reporting as `Payment failed`: {@link sendHeartTip} reports them as
 * `Heart not sent`.
 *
 * @param failure - What the wallet saw.
 * @param input - Click snapshot: the session.
 * @param sentLate - `sentLate` of a send the app stopped waiting for.
 */
function recordHeartPaymentFailure(
  failure: PaymentFailure,
  input: HeartTipInput,
  sentLate?: Promise<boolean>,
): void {
  reportPaymentFailure({ ...failure, amountSats: 1 }, 'heart', {
    session: input.sessionToken,
    sentLate,
  });
}

/**
 * Pays a prepared heart invoice. `confirm` sends at once, but only when the
 * prepared payment is exactly 1 sat with a fee of ₿0; anything else is
 * `heart_unavailable` and nothing is sent. `insufficient` or a ready zero
 * balance is `insufficient_balance`. A sent heart is recorded as `heart_sent` under the session
 * of the click, also when the SDK finishes a send the app stopped waiting for.
 * A send that timed out (`sentLate`) is remembered for this note until its
 * outcome is known, so a retap waits instead of paying again: `sentLate`
 * `true` marks it sent, `false` forgets it. Every outcome that is not paid is
 * also recorded as `payment_failed` (see {@link recordHeartPaymentFailure}),
 * a prepared heart that is not 1 sat at ₿0 as `amount_mismatch`.
 *
 * @param result - Outcome of {@link payFromWallet}.
 * @param input - Click snapshot: the message id and the session.
 * @param invoice - Spark invoice that was prepared.
 * @returns Paid, or why the heart was not sent.
 */
async function finishPreparedPay(
  result: WalletPayResult,
  input: HeartTipInput,
  invoice: string,
): Promise<HeartTipOutcome> {
  if (result.kind !== 'confirm') {
    recordHeartPaymentFailure(result.failure, input);
    return {
      kind: 'failed',
      reason:
        result.kind === 'insufficient' || liveReadyBalanceIsZero()
          ? 'insufficient_balance'
          : 'payment_failed',
    };
  }
  if (liveReadyBalanceIsZero()) {
    recordHeartPaymentFailure(
      {
        stage: 'prepare',
        reason: 'insufficient',
        method: result.method,
        amountSats: 1,
        feeSats: result.feeSats,
      },
      input,
    );
    return { kind: 'failed', reason: 'insufficient_balance' };
  }
  if (result.amountSats !== 1 || result.feeSats > 0) {
    recordHeartPaymentFailure(
      {
        stage: 'prepare',
        reason: 'amount_mismatch',
        method: result.method,
        amountSats: 1,
        feeSats: result.feeSats,
      },
      input,
    );
    return { kind: 'failed', reason: 'heart_unavailable' };
  }
  const sent = await result.send();
  const recordHeart = (): void => {
    logInteraction('heart_sent', { messageId: input.messageId, amountSats: 1 }, input.sessionToken);
  };
  if (sent.kind === 'paid') {
    recordHeart();
    return { kind: 'paid' };
  }
  const sentLate = sent.kind === 'failed' ? sent.sentLate : undefined;
  recordHeartPaymentFailure(sent.failure, input, sentLate);
  if (sent.kind === 'insufficient') {
    return { kind: 'failed', reason: 'insufficient_balance' };
  }
  if (sentLate !== undefined) {
    const held: UnsettledHeart = { invoice, sinceMs: Date.now(), sent: false };
    unsettledHearts.set(input.messageId, held);
    void sentLate.then((late) => {
      if (late) {
        recordHeart();
        held.sent = true;
      } else if (unsettledHearts.get(input.messageId) === held) {
        unsettledHearts.delete(input.messageId);
      }
    });
    return { kind: 'failed', reason: 'timeout_pending' };
  }
  return { kind: 'failed', reason: 'payment_failed' };
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
  // `sentLate` may have reported the send while the list was being read.
  if (held.sent) {
    unsettledHearts.delete(messageId);
    return 'paid';
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
 * @returns Paid, or why the heart was not sent.
 */
async function payHeartInvoice(
  sparkInvoice: string,
  input: HeartTipInput,
): Promise<HeartTipOutcome> {
  const first = await payFromWallet({ type: 'input', input: sparkInvoice });
  if (first.kind === 'unlock') {
    if (!input.needsWalletSetup && input.canUnlockWallet) {
      const unlocked = await unlockWalletPhrase();
      if (unlocked === 'unlocked') {
        const second = await payFromWallet({ type: 'input', input: sparkInvoice });
        return finishPreparedPay(second, input, sparkInvoice);
      }
    }
    recordHeartPaymentFailure(first.failure, input);
    return { kind: 'failed', reason: 'payment_failed' };
  }
  return finishPreparedPay(first, input, sparkInvoice);
}

/**
 * Sends a 1-sat heart on a forum note or reply. No amount dialog, no gift
 * sheet, no comment text. A missing session or a read-only board is silent.
 * A heart is paid only through the api's fee-free Spark invoice, for exactly
 * 1 sat and a fee of ₿0: without a Spark invoice, or when the prepared payment
 * differs, nothing is sent and the reason is `heart_unavailable` (never the
 * Lightning `pr`). While an earlier heart on the same note timed out and its
 * outcome is not known, nothing is invoiced and the reason is
 * `timeout_pending`; while another heart on the same note is still in
 * progress in this tab (also from a board mounted again), it is `in_flight`.
 * A heart that is not sent is reported to error reporting with its reason
 * code and the message id only, except `no_balance`, which is expected.
 * In a Playwright build, `?visual=heart-paid` (via {@link visualPin}) returns
 * paid without invoicing, `?visual=heart-needs-balance` returns
 * `no_balance`, and `?visual=heart-cannot-receive` returns
 * `author_cannot_receive` without invoicing; those pins are ignored in production and do not override
 * signed-out or read-only. They are read before the Sunday check so a Sunday
 * clock cannot hide the shot.
 *
 * @param input - Click snapshot for one `messageId`.
 * @returns `noop`, `paid`, or why the heart was not sent.
 */
export async function sendHeartTip(input: HeartTipInput): Promise<HeartTipOutcome> {
  const outcome = await runHeartTip(input);
  if (outcome.kind === 'failed' && outcome.reason !== 'no_balance') {
    reportHeartFailure(input.messageId, outcome.reason);
  }
  return outcome;
}

/**
 * The checks and the payment of {@link sendHeartTip}, without the report.
 *
 * @param input - Click snapshot for one `messageId`.
 * @returns `noop`, `paid`, or why the heart was not sent.
 */
async function runHeartTip(input: HeartTipInput): Promise<HeartTipOutcome> {
  if (input.sessionToken === null || input.readOnly) {
    return { kind: 'noop' };
  }
  if (visualPin() === 'heart-paid') {
    return { kind: 'paid' };
  }
  // Playwright build only: the api refused the heart because the author cannot receive.
  if (visualPin() === 'heart-cannot-receive') {
    return { kind: 'failed', reason: 'author_cannot_receive' };
  }
  if (lacksHeartBalance(input)) {
    return { kind: 'failed', reason: 'no_balance' };
  }
  if (input.isLocalSunday) {
    return { kind: 'failed', reason: 'sunday' };
  }
  if (input.needsWalletSetup) {
    return { kind: 'failed', reason: 'wallet_setup_due' };
  }
  if (heartsInFlight.has(input.messageId)) {
    return { kind: 'failed', reason: 'in_flight' };
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
 * @returns Paid, or why the heart was not sent.
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
    return { kind: 'failed', reason: 'timeout_pending' };
  }
  let invoice;
  try {
    invoice = await postMessageInvoice(sessionToken, messageId, 1, undefined, undefined, true);
  } catch (err) {
    return { kind: 'failed', reason: mapInvoiceError(err) };
  }
  if (typeof invoice.sparkInvoice !== 'string' || invoice.sparkInvoice === '') {
    return { kind: 'failed', reason: 'heart_unavailable' };
  }
  return payHeartInvoice(invoice.sparkInvoice, input);
}

/**
 * Applies server `heartCounts` to the session map. An id missing from
 * `heartCounts` is not treated as 0: it is not reconciled and not deleted.
 * Equal numbers in a new object identity are skipped. Partial growth persists
 * `base` immediately so a later run cannot subtract the same growth twice.
 *
 * @param counts - Id to server heart count of notes the board shows.
 * @param force - True on the first run after reading storage.
 * @param sentRef - Session map (source of truth).
 * @param lastSignatureRef - Last applied value signature.
 * @param lastAppliedRef - Last applied per-id server counts.
 * @param setHeartTipViews - View setter (functional).
 */
function reconcileHeartCounts(
  counts: Readonly<Record<string, number>>,
  force: boolean,
  sentRef: { current: HeartSentMap },
  lastSignatureRef: { current: string | null },
  lastAppliedRef: { current: Record<string, number> },
  setHeartTipViews: (
    update: (prev: Record<string, HeartTipView>) => Record<string, HeartTipView>,
  ) => void,
): void {
  const signature = heartCountsSignature(counts);
  if (!force && lastSignatureRef.current === signature) {
    return;
  }
  const prevApplied = lastAppliedRef.current;
  lastSignatureRef.current = signature;
  const nextApplied: Record<string, number> = {};
  for (const id of Object.keys(counts)) {
    const server = counts[id];
    if (server !== undefined) {
      nextApplied[id] = server;
    }
  }
  lastAppliedRef.current = nextApplied;

  const ids = new Set<string>();
  if (force) {
    for (const id of Object.keys(sentRef.current)) {
      if (counts[id] !== undefined) {
        ids.add(id);
      }
    }
  } else {
    for (const id of Object.keys(counts)) {
      const server = counts[id];
      if (server !== undefined && prevApplied[id] !== server) {
        ids.add(id);
      }
    }
  }

  const extraById = new Map<string, number>();
  const map = sentRef.current;
  let changed = false;
  for (const id of ids) {
    const server = counts[id] as number;
    const entry = map[id];
    if (entry === undefined) {
      continue;
    }
    if (server >= entry.base + entry.extra) {
      delete map[id];
      extraById.set(id, 0);
      changed = true;
    } else if (server > entry.base && server < entry.base + entry.extra) {
      const nextExtra = entry.extra - (server - entry.base);
      map[id] = { base: server, extra: nextExtra };
      extraById.set(id, nextExtra);
      changed = true;
    }
  }
  if (changed) {
    writeHeartSentMap(map);
  }

  setHeartTipViews((prev) => {
    let next: Record<string, HeartTipView> | null = null;
    const write = (id: string, view: HeartTipView): void => {
      if (next === null) {
        next = { ...prev };
      }
      next[id] = view;
    };
    if (force) {
      for (const [id, entry] of Object.entries(map)) {
        if (entry.extra > 0 && extraById.get(id) === undefined) {
          write(id, {
            pressed: true,
            plusOne: false,
            needsBalance: false,
            extra: entry.extra,
          });
        }
      }
    }
    for (const [id, extra] of extraById) {
      const current = (next ?? prev)[id];
      const plusOne = current !== undefined && current.plusOne;
      write(id, {
        pressed: extra > 0 || plusOne,
        plusOne,
        needsBalance: current !== undefined && current.needsBalance,
        extra,
      });
    }
    return next ?? prev;
  });
}

/**
 * Ends the +1 on one heart. A missing row is returned unchanged.
 * `pressed` stays only while this session still has `extra`.
 *
 * @param prev - Current per-id views.
 * @param messageId - Note whose +1 ends.
 * @returns The next view map.
 */
export function endHeartPlusOne(
  prev: Readonly<Record<string, HeartTipView>>,
  messageId: string,
): Record<string, HeartTipView> {
  const current = prev[messageId];
  if (current === undefined) {
    return prev;
  }
  const extra = current.extra ?? 0;
  return {
    ...prev,
    [messageId]: { ...current, plusOne: false, pressed: extra > 0 },
  };
}

/**
 * Heart-click machine for a forum board: on every tap of a signed-in,
 * writable board, vibrate and show the filled heart with its +1 at once for
 * {@link HEART_TIP_PLUS_ONE_MS}, while {@link sendHeartTip} pays in the
 * background. After 700 ms only the +1 leaves; the fill and `extra` remain.
 * Session hearts not yet in the server `heartCount` are `extra`. A second tap
 * sends another heart and counts up; there is no undo. A heart that is not
 * sent rolls back that tap's `extra`; it is also reported, and a refusal
 * because the author cannot receive also shows the author-wallet line
 * (`cannotReceive` on the view). The one exception
 * is a wallet snapshot whose balance cannot cover the heart: then there is no
 * vibrate, no new fill, and no +1, only the balance-required line, and
 * nothing is sent. A signed-out or read-only tap does nothing.
 *
 * @param options - `readOnly` matches the board (`true` when signed out).
 *   `heartCounts` maps shown note ids to the server heart count; omit for `{}`.
 * @returns Click handler and the per-id views to pass to the forum board.
 */
export function useHeartTip(options: {
  readOnly: boolean;
  heartCounts?: Readonly<Record<string, number>>;
}): {
  onHeartTip: (messageId: string) => void;
  heartTipViews: Readonly<Record<string, HeartTipView>>;
} {
  const { readOnly } = options;
  const heartCounts = options.heartCounts ?? {};
  const [heartTipViews, setHeartTipViews] = useState<Record<string, HeartTipView>>({});
  const timersRef = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const sentRef = useRef<HeartSentMap>({});
  const heartCountsRef = useRef(heartCounts);
  heartCountsRef.current = heartCounts;
  const lastSignatureRef = useRef<string | null>(null);
  const lastAppliedRef = useRef<Record<string, number>>({});
  const didReadRef = useRef(false);

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      for (const timer of timers.values()) {
        clearTimeout(timer);
      }
      timers.clear();
    };
  }, []);

  useEffect(() => {
    const force = !didReadRef.current;
    if (force) {
      sentRef.current = readHeartSentMap();
      didReadRef.current = true;
    }
    reconcileHeartCounts(
      heartCounts,
      force,
      sentRef,
      lastSignatureRef,
      lastAppliedRef,
      setHeartTipViews,
    );
  }, [heartCounts]);

  const onHeartTip = useCallback(
    (messageId: string): void => {
      const sessionToken = useAuthStore.getState().session;
      if (sessionToken === null || readOnly) {
        return;
      }
      const account = useAuthStore.getState().account;
      const wallet = useWalletStore.getState();
      const isLocalSunday =
        typeof document !== 'undefined' && document.documentElement.dataset['localSunday'] === '1';
      const input: HeartTipInput = {
        messageId,
        sessionToken,
        readOnly,
        isLocalSunday,
        walletStatus: wallet.status,
        balanceSats: wallet.balanceSats,
        needsWalletSetup: needsWalletSetup(account),
        canUnlockWallet: canUnlockWallet(account),
      };
      const existingTimer = timersRef.current.get(messageId);
      if (existingTimer !== undefined) {
        clearTimeout(existingTimer);
        timersRef.current.delete(messageId);
      }
      if (lacksHeartBalance(input)) {
        setHeartTipViews((prev) => {
          const extra = mapExtra(sentRef.current, messageId);
          if (extra > 0) {
            return {
              ...prev,
              [messageId]: {
                pressed: true,
                plusOne: false,
                needsBalance: true,
                extra,
              },
            };
          }
          return {
            ...prev,
            [messageId]: {
              pressed: false,
              plusOne: false,
              needsBalance: true,
              extra: 0,
            },
          };
        });
        return;
      }
      if (typeof navigator.vibrate === 'function') {
        navigator.vibrate(10);
      }
      const map = sentRef.current;
      const existing = map[messageId];
      const extra = existing === undefined ? 1 : existing.extra + 1;
      if (existing === undefined) {
        const server = heartCountsRef.current[messageId];
        map[messageId] = {
          base: server === undefined ? 0 : server,
          extra,
        };
      } else {
        map[messageId] = { base: existing.base, extra };
      }
      writeHeartSentMap(map);
      setHeartTipViews((prev) => ({
        ...prev,
        [messageId]: { pressed: true, plusOne: true, needsBalance: false, extra },
      }));
      if (visualPin() !== 'heart-paid') {
        const timer = setTimeout(() => {
          timersRef.current.delete(messageId);
          setHeartTipViews((prev) => endHeartPlusOne(prev, messageId));
        }, HEART_TIP_PLUS_ONE_MS);
        timersRef.current.set(messageId, timer);
      }
      void sendHeartTip(input).then((outcome) => {
        if (outcome.kind === 'paid') {
          return;
        }
        const sent = sentRef.current;
        const entry = sent[messageId];
        if (entry !== undefined) {
          const nextExtra = entry.extra - 1;
          if (nextExtra <= 0) {
            delete sent[messageId];
          } else {
            sent[messageId] = { base: entry.base, extra: nextExtra };
          }
          writeHeartSentMap(sent);
        }
        setHeartTipViews((prev) => {
          const current = prev[messageId];
          const nextExtra = mapExtra(sentRef.current, messageId);
          const plusOne = current !== undefined && current.plusOne;
          const needsBalance = current !== undefined && current.needsBalance;
          const cannotReceive =
            outcome.kind === 'failed' && outcome.reason === 'author_cannot_receive';
          return {
            ...prev,
            [messageId]: {
              pressed: nextExtra > 0 || plusOne,
              plusOne,
              needsBalance,
              extra: nextExtra,
              ...(cannotReceive ? { cannotReceive: true } : {}),
            },
          };
        });
      });
    },
    [readOnly],
  );

  return { onHeartTip, heartTipViews };
}
