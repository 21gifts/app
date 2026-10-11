import { captureMessage } from '@sentry/nextjs';
import { logInteraction } from '@/lib/interaction-log';
import type { OnchainSpeed } from '@/lib/wallet/wallet-sdk';

/**
 * Where a payment stopped: `prepare` (reading amount and fee, before the
 * member sees **Send**), `confirm` (after **Send**, before the SDK is asked to
 * send), or `send` (the SDK's send itself).
 */
export type PayStage = 'prepare' | 'confirm' | 'send';

/** How the payment would have moved, as the wallet tells requests apart. */
export type PayMethod = 'lightning' | 'spark' | 'onchain' | 'lnurl' | 'unknown';

/**
 * Which feature started the payment: the wallet Send view (`send`), a shop's
 * point-of-sale charge read in that view (`pos`), a gift on a note, reply, or
 * habit comment (`gift`), a paid reaction (`reaction`), the posting fee
 * (`post_fee`), today's repayment of a credit (`repay`), the inbox pay sheet
 * (`inbox`), or a heart (`heart`).
 */
export type PayFlow =
  'send' | 'pos' | 'gift' | 'reaction' | 'post_fee' | 'repay' | 'inbox' | 'heart';

/**
 * Short code for why a payment did not go out. Never the error text itself.
 *
 * - Member state, not a fault: `unlock` (no wallet connection), `insufficient`,
 *   `below_minimum`.
 * - Wallet: `disconnected` (the connection changed meanwhile), `balance_read`
 *   (the balance read after prepare failed), `already_sent` (a prepared payment
 *   asked to send twice), `amount_mismatch` (the prepared amount is not the
 *   amount the screen asked for).
 * - SDK error shapes: `expired`, `no_route`, `timeout` (an SDK timeout, or the
 *   app stopped waiting for the send), `network`, `lnurl_error`, `sdk_error`
 *   (anything else).
 * - `sent_late`: a send the app stopped waiting for that the SDK still sent.
 * - Outside address relay through the api: `relay_not_payable`,
 *   `relay_not_found`, `relay_unreachable`, `relay_amount`, `relay_comment`,
 *   `relay_failed`.
 * - `app_error`: the screen's own handling threw.
 */
export type PayReason =
  | 'unlock'
  | 'insufficient'
  | 'below_minimum'
  | 'disconnected'
  | 'balance_read'
  | 'already_sent'
  | 'amount_mismatch'
  | 'expired'
  | 'no_route'
  | 'timeout'
  | 'network'
  | 'lnurl_error'
  | 'sdk_error'
  | 'sent_late'
  | 'relay_not_payable'
  | 'relay_not_found'
  | 'relay_unreachable'
  | 'relay_amount'
  | 'relay_comment'
  | 'relay_failed'
  | 'app_error';

/** One payment that did not go out, as the wallet or the screen saw it. */
export interface PaymentFailure {
  /** Where it stopped. */
  stage: PayStage;
  /** Why. */
  reason: PayReason;
  /** How it would have moved. */
  method: PayMethod;
  /** Whole sats the receiver would have got, or `null` before that is known. */
  amountSats: number | null;
  /** Whole sats of fee quoted (the chosen speed on the base chain), or `null`. */
  feeSats: number | null;
  /** Fee of each speed of a base-chain quote. */
  onchainFees?: Record<OnchainSpeed, number>;
  /** The SDK's or api's rejection; only its name, code, and scrubbed message are reported. */
  error?: unknown;
}

/** Reasons that are the member's state, not a fault: never sent to error reporting. */
const MEMBER_STATE: ReadonlySet<PayReason> = new Set(['unlock', 'insufficient', 'below_minimum']);

/**
 * Name, code, and message of a rejection. The SDK throws plain `Error`s whose
 * message starts with its error kind (`Network error: …`); that kind is the
 * code. The api relay's error carries its own `reason`. The message is kept
 * whole: cutting it before the scrubber runs could split a recovery phrase
 * below the length the scrubber recognises.
 *
 * @param error - Rejection, or `undefined`.
 * @returns The three fields, each `null` when absent.
 */
function errorFields(error: unknown): {
  errorName: string | null;
  errorCode: string | null;
  errorMessage: string | null;
} {
  if (error === undefined) {
    return { errorName: null, errorCode: null, errorMessage: null };
  }
  const message = error instanceof Error ? error.message : String(error);
  const reason = (error as { reason?: unknown } | null)?.reason;
  const kind = /^([A-Za-z][A-Za-z ]{0,40}?) error:/.exec(message)?.[1];
  let errorCode: string | null = null;
  if (typeof reason === 'string') {
    errorCode = reason;
  } else if (kind !== undefined) {
    errorCode = kind.toLowerCase().replace(/ /g, '_');
  }
  return {
    errorName: error instanceof Error ? error.name : typeof error,
    errorCode,
    errorMessage: message,
  };
}

/**
 * Sends one `Payment failed` report to error reporting (a no-op while error
 * reporting is off). The raw message goes into `extra`, which the one
 * scrubber in `src/lib/sentry.ts` cleans before anything leaves the device.
 *
 * @param failure - The failure.
 * @param reason - Reason reported (the failure's own, or `sent_late`).
 * @param flow - Feature that started the payment.
 */
function capturePaymentFailure(failure: PaymentFailure, reason: PayReason, flow: PayFlow): void {
  captureMessage('Payment failed', {
    level: 'error',
    fingerprint: ['payment-failed', failure.stage, reason],
    tags: {
      pay_stage: failure.stage,
      pay_reason: reason,
      pay_method: failure.method,
      pay_flow: flow,
    },
    extra: {
      amountSats: failure.amountSats,
      feeSats: failure.feeSats,
      onchainFees: failure.onchainFees ?? null,
      ...errorFields(failure.error),
    },
  });
}

/**
 * Records `payment_failed` for the member: stage, reason, method, flow, and
 * amount, all scalars.
 *
 * @param failure - The failure.
 * @param flow - Feature that started the payment.
 * @param session - Session the payment ran under, when known.
 */
function logPaymentFailure(
  failure: PaymentFailure,
  flow: PayFlow,
  session: string | null | undefined,
): void {
  logInteraction(
    'payment_failed',
    {
      stage: failure.stage,
      reason: failure.reason,
      method: failure.method,
      flow,
      amountSats: failure.amountSats,
    },
    session,
  );
}

/**
 * Reports a payment that did not go out. Every failure is recorded as the
 * member event `payment_failed`. It is also sent to error reporting as
 * `Payment failed` (one issue per stage and reason), except member state
 * (`unlock`, `insufficient`, `below_minimum`) and hearts, which keep their own
 * `Heart not sent` report. A send the app stopped waiting for (`timeout`
 * with `sentLate`) is reported to error reporting at once; the member event
 * follows only when `sentLate` resolves `false`, and a send that still went
 * out is reported once more as `sent_late` instead (it was paid, so no member
 * event).
 *
 * @param failure - What the wallet or the screen saw.
 * @param flow - Feature that started the payment.
 * @param options - `session` the payment ran under (the event is dropped when
 *   it is no longer the current one); `sentLate` of a timed-out send.
 */
export function reportPaymentFailure(
  failure: PaymentFailure,
  flow: PayFlow,
  options: { session?: string | null; sentLate?: Promise<boolean> | undefined } = {},
): void {
  const { session, sentLate } = options;
  const toSentry = flow !== 'heart' && !MEMBER_STATE.has(failure.reason);
  if (toSentry) {
    capturePaymentFailure(failure, failure.reason, flow);
  }
  if (failure.reason === 'timeout' && sentLate !== undefined) {
    void sentLate.then((sent) => {
      if (!sent) {
        logPaymentFailure(failure, flow, session);
      } else if (toSentry) {
        capturePaymentFailure(failure, 'sent_late', flow);
      }
    });
    return;
  }
  logPaymentFailure(failure, flow, session);
}
