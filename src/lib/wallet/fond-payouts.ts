import type { FondPayout, FondPayoutInvoice } from '@/lib/api-types';
import type { FondPayoutFailure } from '@/lib/api';
import { getE2eNow } from '@/lib/config';
import { reportPaymentFailure, type PaymentFailure } from '@/lib/wallet/payment-failure';
import type { WalletPayResult, WalletSendResult } from '@/lib/wallet/wallet-service';
import type { WalletPayment, WalletPaymentPage, WalletPayRequest } from '@/lib/wallet/wallet-sdk';

/** How many newest wallet payments one history read covers. */
const FOND_PAYOUT_HISTORY_LIMIT = 100;

/** Sent payments the Playwright Fond wallet remembers for this tab. */
const e2eSends: WalletPayment[] = [];

/**
 * The fake Fond wallet for a Playwright build: a prepare that pays the input it
 * is given and records it as a completed send. Returns `null` in every other
 * build, so production and unit tests keep the real wallet functions.
 *
 * @returns The Playwright wallet fakes, or `null` outside a Playwright build.
 */
export function fondE2eWallet(): {
  payFromWallet: (request: WalletPayRequest) => Promise<WalletPayResult>;
  listWalletPayments: (page: WalletPaymentPage) => Promise<WalletPayment[]>;
} | null {
  if (getE2eNow() === null) {
    return null;
  }
  return {
    payFromWallet: async (request) => {
      if (request.type !== 'input') {
        return {
          kind: 'failed',
          failure: {
            stage: 'prepare',
            reason: 'sdk_error',
            method: 'lnurl',
            amountSats: request.amountSats,
            feeSats: null,
          },
        };
      }
      const invoice = request.input;
      return {
        kind: 'confirm',
        amountSats: 21,
        feeSats: 0,
        method: 'lightning',
        send: async () => {
          e2eSends.unshift({
            id: `fond-e2e-${String(e2eSends.length + 1)}`,
            direction: 'sent',
            amountSats: 21,
            feesSats: 0,
            timestamp: Date.now(),
            status: 'completed',
            method: 'lightning',
            senderComment: null,
            info: { invoice },
          });
          return { kind: 'paid' };
        },
      };
    },
    listWalletPayments: async () => e2eSends,
  };
}

/**
 * Collaborators of one {@link runFondPayoutTick} run. Every side effect is
 * injected so the step can be tested without a wallet or a network.
 */
export interface FondPayoutTickDeps {
  /** Bearer session of the Fond account. */
  session: string;
  /** Whether the loop was stopped (unmount, sign-out, or another account). */
  isCancelled: () => boolean;
  /** Lists today's open payouts. */
  fetchFondPayouts: (
    session: string,
  ) => Promise<{ ok: true; payouts: FondPayout[] } | FondPayoutFailure>;
  /** Asks the api for one payout's invoice. */
  postFondPayoutInvoice: (
    session: string,
    id: string,
  ) => Promise<{ ok: true; invoice: FondPayoutInvoice } | FondPayoutFailure>;
  /** Prepares a payment from the in-app wallet. */
  payFromWallet: (request: WalletPayRequest) => Promise<WalletPayResult>;
  /** Reads the connected wallet's newest payments. */
  listWalletPayments: (page: { offset: number; limit: number }) => Promise<WalletPayment[]>;
}

/**
 * Summary of one loop step.
 */
export interface FondPayoutTickResult {
  /** Rows paid in this step. */
  paid: number;
  /** Rows left alone in this step. */
  skipped: number;
  /** `forbidden` on an api 403, `off` on a list 404, otherwise `null`. */
  stop: 'forbidden' | 'off' | null;
}

/**
 * Sends that timed out (`sentLate`) and did not resolve yet. While an id is
 * here its row is never paid again.
 */
const unresolvedSentLate = new Map<string, Promise<boolean>>();

/**
 * Payout ids whose send this tab saw as `paid`, including a timed-out send the
 * wallet later confirmed. While an id is here its row is never paid again, even
 * after its send left the history window. Ids the api stops listing are
 * forgotten, because the api settled those rows.
 */
const paidPayouts = new Set<string>();

/** How the tick finds the wallet send for one row. */
interface PayoutTarget {
  /** Payout row id. */
  id: string;
  /** Payment hash of the invoice. */
  paymentHash: string;
  /** BOLT11 to pay when the Spark invoice is absent. */
  bolt11: string;
  /** Fee-free Spark invoice to pay when the api returned one. */
  sparkInvoice: string | null;
}

/** What one row's invoice lookup found. */
type PayoutTargetLookup =
  { kind: 'target'; target: PayoutTarget } | { kind: 'stop'; stop: 'forbidden' } | { kind: 'skip' };

/**
 * The invoice to pay for one row, from the api.
 *
 * @param deps - Tick collaborators.
 * @param row - Payout row to invoice.
 * @returns The payout target, `forbidden` on a 403, or `skip` when the row is
 *   not payable now (including a 404, which means the row is gone).
 */
async function targetFor(deps: FondPayoutTickDeps, row: FondPayout): Promise<PayoutTargetLookup> {
  if (row.status === 'settling') {
    return { kind: 'skip' };
  }
  const result = await deps.postFondPayoutInvoice(deps.session, row.id);
  if (!result.ok) {
    return result.status === 403 ? { kind: 'stop', stop: 'forbidden' } : { kind: 'skip' };
  }
  return {
    kind: 'target',
    target: {
      id: row.id,
      paymentHash: result.invoice.paymentHash,
      bolt11: result.invoice.bolt11,
      sparkInvoice: result.invoice.sparkInvoice,
    },
  };
}

/**
 * Whether a listed send belongs to this payout, matched by payment hash
 * (case-insensitive), by BOLT11, or by Spark invoice.
 *
 * @param payment - One wallet payment.
 * @param target - The payout target.
 * @returns Whether the send matches.
 */
function matchesPayment(payment: WalletPayment, target: PayoutTarget): boolean {
  if (payment.direction !== 'sent') {
    return false;
  }
  const hash = payment.info.paymentHash;
  if (typeof hash === 'string' && hash.toLowerCase() === target.paymentHash.toLowerCase()) {
    return true;
  }
  const invoice = payment.info.invoice;
  if (typeof invoice !== 'string') {
    return false;
  }
  return (
    invoice === target.bolt11 || (target.sparkInvoice !== null && invoice === target.sparkInvoice)
  );
}

/**
 * All matching sends of a payout, newest first.
 *
 * @param deps - Tick collaborators.
 * @param target - The payout target.
 * @returns Every matching payment, or an empty array when no send matches.
 */
async function findPayments(
  deps: FondPayoutTickDeps,
  target: PayoutTarget,
): Promise<WalletPayment[]> {
  const payments = await deps.listWalletPayments({ offset: 0, limit: FOND_PAYOUT_HISTORY_LIMIT });
  return payments.filter((payment) => matchesPayment(payment, target));
}

/**
 * Reports one wallet outcome that did not pay the invoice. The failure carries
 * codes, amounts, and the rejection only; the invoice never enters it.
 *
 * @param session - Session the payment ran under.
 * @param failure - What the wallet saw.
 * @param sentLate - `sentLate` of a send that timed out.
 */
function reportFondPayoutFailure(
  session: string,
  failure: PaymentFailure,
  sentLate?: Promise<boolean>,
): void {
  reportPaymentFailure(failure, 'fond_payout', { session, sentLate });
}

/**
 * A failure built for a collaborator that threw before it returned a failure.
 *
 * @param stage - Where the attempt threw.
 * @param error - The thrown rejection, reported by name and code only.
 * @returns The failure to report.
 */
function thrownFailure(stage: 'prepare' | 'send', error: unknown): PaymentFailure {
  return {
    stage,
    reason: 'sdk_error',
    method: 'lightning',
    amountSats: null,
    feeSats: null,
    error,
  };
}

/**
 * Remembers a timed-out send until its outcome is known. A send the wallet
 * later confirms (`true`) is treated as sent, so no tick pays the invoice
 * again (also after its send left the history window); a send it rejects
 * (`false`) is forgotten so a later tick may pay.
 *
 * @param id - Payout row id.
 * @param sentLate - Promise of the wallet's late outcome.
 */
function rememberSentLate(id: string, sentLate: Promise<boolean>): void {
  unresolvedSentLate.set(id, sentLate);
  void sentLate.then(
    (sent) => {
      unresolvedSentLate.delete(id);
      if (sent) {
        paidPayouts.add(id);
      }
    },
    () => {
      unresolvedSentLate.delete(id);
    },
  );
}

/** What one row left the tick with. */
type RowOutcome = 'paid' | 'insufficient' | 'cancelled' | 'skipped';

/**
 * Pays one invoice once through the in-app wallet.
 *
 * Only a `confirm` prepare proceeds to `send`. No balance stops the whole tick
 * (`insufficient`); every other outcome skips the row.
 *
 * @param deps - Tick collaborators.
 * @param target - The payout target.
 * @returns `paid`, `insufficient`, `cancelled`, or `skipped`.
 */
async function payInvoice(deps: FondPayoutTickDeps, target: PayoutTarget): Promise<RowOutcome> {
  if (deps.isCancelled()) {
    return 'cancelled';
  }
  let prepared: WalletPayResult;
  try {
    prepared = await deps.payFromWallet({
      type: 'input',
      input: target.sparkInvoice ?? target.bolt11,
    });
  } catch (error) {
    reportFondPayoutFailure(deps.session, thrownFailure('prepare', error));
    return 'skipped';
  }
  if (prepared.kind === 'insufficient') {
    reportFondPayoutFailure(deps.session, prepared.failure);
    return 'insufficient';
  }
  if (prepared.kind !== 'confirm') {
    reportFondPayoutFailure(deps.session, prepared.failure);
    return 'skipped';
  }
  if (deps.isCancelled()) {
    return 'cancelled';
  }
  let sent: WalletSendResult;
  try {
    sent = await prepared.send();
  } catch (error) {
    reportFondPayoutFailure(deps.session, thrownFailure('send', error));
    return 'skipped';
  }
  if (sent.kind === 'insufficient') {
    reportFondPayoutFailure(deps.session, sent.failure);
    return 'insufficient';
  }
  if (sent.kind !== 'paid') {
    const sentLate = sent.kind === 'failed' ? sent.sentLate : undefined;
    reportFondPayoutFailure(deps.session, sent.failure, sentLate);
    if (sentLate !== undefined) {
      rememberSentLate(target.id, sentLate);
    }
    return 'skipped';
  }
  paidPayouts.add(target.id);
  if (deps.isCancelled()) {
    return 'cancelled';
  }
  return 'paid';
}

/**
 * Reads every earlier send for one payout row and pays it only when none is
 * completed or pending.
 *
 * Any `completed` or `pending` match skips the row, because the api worker will
 * mark it paid. No match or only `failed` matches falls through to paying the
 * row once. A row whose send this tab saw as paid (a `paid` send or a
 * timed-out send the wallet confirmed) is never paid again while the api still
 * lists it, even when its send is no longer in the history window. The history
 * check remains the guard across reloads.
 *
 * @param deps - Tick collaborators.
 * @param target - The payout target.
 * @returns `paid`, `insufficient`, `cancelled`, or `skipped`.
 */
async function payAndCheckHistory(
  deps: FondPayoutTickDeps,
  target: PayoutTarget,
): Promise<RowOutcome> {
  try {
    const matching = await findPayments(deps, target);
    if (
      matching.some((payment) => payment.status === 'completed' || payment.status === 'pending')
    ) {
      return 'skipped';
    }
  } catch {
    return 'skipped';
  }
  if (paidPayouts.has(target.id)) {
    return 'skipped';
  }
  return payInvoice(deps, target);
}

/**
 * Runs one Fond payout loop step: lists today's open rows and pays each one
 * once from the in-app wallet.
 *
 * A `403` or `404` from the list stops the loop (`forbidden` / `off`). A `403`
 * from an invoice request also stops it as `forbidden`; a `404` there means
 * that row is gone and is skipped, because the api answers an unknown id the
 * same way as an off surface. Every other list failure is retried by the next
 * tick. `settling` rows are skipped without asking for an invoice. Rows are
 * handled in list order, one at a time. Before paying, the newest 100 wallet
 * sends are read and every send that matches the payment hash, BOLT11, or
 * Spark invoice is collected: any `completed` or `pending` match skips the row,
 * and only no match or only `failed` matches pays it. A row whose history
 * cannot be read is skipped and never paid twice. A row whose send this tab
 * saw as paid is skipped even after its send left the newest 100; the history
 * stays the guard across reloads. Ids the list no longer returns are forgotten,
 * so the set stays small. An empty wallet stops the whole tick. Cancellation
 * returns at once at its next check. Amounts come only from the invoice; the
 * app never computes or rounds one. The invoice and address are never logged.
 *
 * @param deps - Session, api calls, and wallet calls.
 * @returns Counts of paid and skipped rows and the reason to stop.
 */
export async function runFondPayoutTick(deps: FondPayoutTickDeps): Promise<FondPayoutTickResult> {
  const summary: FondPayoutTickResult = { paid: 0, skipped: 0, stop: null };
  if (deps.isCancelled()) {
    return summary;
  }
  const list = await deps.fetchFondPayouts(deps.session);
  if (!list.ok) {
    if (list.status === 404) {
      summary.stop = 'off';
    } else if (list.status === 403) {
      summary.stop = 'forbidden';
    }
    return summary;
  }
  const listed = new Set(list.payouts.map((row) => row.id));
  for (const id of paidPayouts) {
    if (!listed.has(id)) {
      paidPayouts.delete(id);
    }
  }
  for (const row of list.payouts) {
    if (deps.isCancelled()) {
      return summary;
    }
    if (unresolvedSentLate.has(row.id)) {
      summary.skipped += 1;
      continue;
    }
    const lookup = await targetFor(deps, row);
    if (lookup.kind === 'stop') {
      summary.stop = lookup.stop;
      return summary;
    }
    if (lookup.kind === 'skip') {
      summary.skipped += 1;
      continue;
    }
    const outcome = await payAndCheckHistory(deps, lookup.target);
    if (outcome === 'paid') {
      summary.paid += 1;
    } else if (outcome === 'insufficient' || outcome === 'cancelled') {
      return summary;
    } else {
      summary.skipped += 1;
    }
  }
  return summary;
}

/** The tick that is currently paying, and the session that started it. */
let inFlightTick: { session: string; promise: Promise<FondPayoutTickResult> } | null = null;

/**
 * Runs at most one {@link runFondPayoutTick} at a time.
 *
 * An effect re-run while a tick is still in flight must not start a second
 * tick against the same rows: overlapping ticks could both read the same
 * stored invoice, see no send yet, and pay it twice. A caller with the same
 * session receives the running tick's promise. A caller with a different
 * session waits for that tick to settle, ignoring its result or rejection,
 * and then starts its own tick. The guard is cleared when a tick settles,
 * whether it resolves or throws, so the next caller can start a fresh tick.
 *
 * @param deps - Session, api calls, and wallet calls for a new tick.
 * @returns The result of the caller's own session's tick.
 */
export function runFondPayoutTickOnce(deps: FondPayoutTickDeps): Promise<FondPayoutTickResult> {
  const running = inFlightTick;
  if (running === null) {
    return startFondPayoutTick(deps);
  }
  if (running.session === deps.session) {
    return running.promise;
  }
  return running.promise.then(
    () => runFondPayoutTickOnce(deps),
    () => runFondPayoutTickOnce(deps),
  );
}

/**
 * Starts one tick and installs it as the module-level guard.
 *
 * @param deps - Session, api calls, and wallet calls for the new tick.
 * @returns The running tick's promise.
 */
function startFondPayoutTick(deps: FondPayoutTickDeps): Promise<FondPayoutTickResult> {
  const running = runFondPayoutTick(deps).finally(() => {
    inFlightTick = null;
  });
  inFlightTick = { session: deps.session, promise: running };
  return running;
}
