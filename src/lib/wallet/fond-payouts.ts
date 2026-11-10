import type { FondPayout, FondPayoutInvoice } from '@/lib/api-types';
import type { FondPayoutFailure } from '@/lib/api';
import { reportPaymentFailure, type PaymentFailure } from '@/lib/wallet/payment-failure';
import type { WalletPayResult, WalletSendResult } from '@/lib/wallet/wallet-service';
import type { WalletPayment, WalletPayRequest } from '@/lib/wallet/wallet-sdk';

/** How many newest wallet payments one history read covers. */
const FOND_PAYOUT_HISTORY_LIMIT = 100;

/** How many history reads one fresh send waits for its preimage. */
const FOND_PAYOUT_PREIMAGE_READS = 5;

/** How long the tick sleeps between those history reads. */
const FOND_PAYOUT_PREIMAGE_WAIT_MS = 2_000;

/** A 64-hex Lightning preimage, case-insensitive. */
const PREIMAGE = /^[0-9a-f]{64}$/i;

/**
 * Waits before the next wallet history read while a fresh send settles.
 *
 * @param ms - Milliseconds to wait.
 * @returns Resolves after that wait.
 */
export function waitForFondPayoutRead(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
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
  /** Asks the api for one payout's BOLT11. */
  postFondPayoutInvoice: (
    session: string,
    id: string,
  ) => Promise<{ ok: true; invoice: FondPayoutInvoice } | FondPayoutFailure>;
  /** Posts the preimage as proof of one payout. */
  postFondPayoutProof: (
    session: string,
    id: string,
    preimage: string,
  ) => Promise<{ ok: true } | FondPayoutFailure>;
  /** Prepares a payment from the in-app wallet. */
  payFromWallet: (request: WalletPayRequest) => Promise<WalletPayResult>;
  /** Reads the connected wallet's newest payments. */
  listWalletPayments: (page: { offset: number; limit: number }) => Promise<WalletPayment[]>;
  /** Waits before the next history read. */
  sleep: (ms: number) => Promise<void>;
}

/**
 * Summary of one loop step.
 */
export interface FondPayoutTickResult {
  /** Rows paid and proven in this step. */
  paid: number;
  /** Rows whose preimage the api accepted as proof. */
  proved: number;
  /** Rows left alone in this step. */
  skipped: number;
  /** `forbidden` on an api 403, `off` on a list 404, otherwise `null`. */
  stop: 'forbidden' | 'off' | null;
}

/** Payment hashes this tab remembers per payout id, filled when it asks for the invoice. */
const rememberedHashes = new Map<string, string>();

/**
 * Sends that timed out (`sentLate`) and did not resolve yet. While an id is
 * here its row is never paid again.
 */
const unresolvedSentLate = new Map<string, Promise<boolean>>();

/** Rows whose timed-out send the wallet confirmed as sent but not yet proven. */
const lateSends = new Set<string>();

/** How the tick finds the wallet send for one row. */
interface PayoutTarget {
  /** Payout row id. */
  id: string;
  /** Payment hash, when the row was invoiced by this tab. */
  paymentHash: string;
  /** BOLT11 to pay, absent for a `settling` row remembered by its hash. */
  bolt11: string | null;
}

/** What one row's invoice lookup found. */
type PayoutTargetLookup =
  { kind: 'target'; target: PayoutTarget } | { kind: 'stop'; stop: 'forbidden' } | { kind: 'skip' };

/**
 * The invoice to pay for one row, from this tab's memory or from the api.
 *
 * @param deps - Tick collaborators.
 * @param row - Payout row to invoice.
 * @returns The payout target, `forbidden` on a 403, or `skip` when the row is
 *   not payable now (including a 404, which means the row is gone).
 */
async function targetFor(deps: FondPayoutTickDeps, row: FondPayout): Promise<PayoutTargetLookup> {
  if (row.status === 'settling') {
    const listed = row.paymentHash;
    const paymentHash =
      typeof listed === 'string' && listed !== '' ? listed : rememberedHashes.get(row.id);
    if (paymentHash === undefined) {
      return { kind: 'skip' };
    }
    rememberedHashes.set(row.id, paymentHash);
    return { kind: 'target', target: { id: row.id, paymentHash, bolt11: null } };
  }
  const result = await deps.postFondPayoutInvoice(deps.session, row.id);
  if (!result.ok) {
    return result.status === 403 ? { kind: 'stop', stop: 'forbidden' } : { kind: 'skip' };
  }
  rememberedHashes.set(row.id, result.invoice.paymentHash);
  return {
    kind: 'target',
    target: {
      id: row.id,
      paymentHash: result.invoice.paymentHash,
      bolt11: result.invoice.bolt11,
    },
  };
}

/**
 * Whether a listed send belongs to this payout, matched by payment hash
 * (case-insensitive) or by BOLT11.
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
  return (
    target.bolt11 !== null &&
    typeof payment.info.invoice === 'string' &&
    payment.info.invoice === target.bolt11
  );
}

/**
 * The newest matching send of a payout, if any.
 *
 * @param deps - Tick collaborators.
 * @param target - The payout target.
 * @returns The matching payment, or `undefined` when no send matches.
 */
async function findPayment(
  deps: FondPayoutTickDeps,
  target: PayoutTarget,
): Promise<WalletPayment | undefined> {
  const payments = await deps.listWalletPayments({ offset: 0, limit: FOND_PAYOUT_HISTORY_LIMIT });
  return payments.find((payment) => matchesPayment(payment, target));
}

/**
 * A preimage from a matching send, or `null` when it is missing or not 64-hex.
 *
 * @param payment - Matching payment, if one was found.
 * @returns The normalized preimage, or `null`.
 */
function preimageOf(payment: WalletPayment | undefined): string | null {
  const preimage = payment?.info.preimage;
  return typeof preimage === 'string' && PREIMAGE.test(preimage) ? preimage.toLowerCase() : null;
}

/**
 * Polls the history for a fresh send's preimage.
 *
 * @param deps - Tick collaborators.
 * @param target - The payout target.
 * @returns The normalized preimage, `cancelled`, or `null` after the last read.
 */
async function waitForPreimage(
  deps: FondPayoutTickDeps,
  target: PayoutTarget,
): Promise<string | 'cancelled' | null> {
  for (let read = 0; read < FOND_PAYOUT_PREIMAGE_READS; read += 1) {
    if (deps.isCancelled()) {
      return 'cancelled';
    }
    await deps.sleep(FOND_PAYOUT_PREIMAGE_WAIT_MS);
    const preimage = preimageOf(await findPayment(deps, target));
    if (preimage !== null) {
      return preimage;
    }
  }
  return null;
}

/**
 * Reports one wallet outcome that did not pay the invoice. The failure carries
 * codes, amounts, and the rejection only; the BOLT11 and preimage never enter
 * it.
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
 * again; a send it rejects (`false`) is forgotten so a later tick may pay.
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
        lateSends.add(id);
      }
    },
    () => {
      unresolvedSentLate.delete(id);
    },
  );
}

/**
 * Pays one BOLT11 once and waits for its preimage.
 *
 * Only a `confirm` prepare proceeds to `send`, and only `paid` proceeds to the
 * preimage poll. No balance stops the whole tick (`insufficient`); every other
 * outcome skips the row.
 *
 * @param deps - Tick collaborators.
 * @param target - The payout target (its BOLT11 is present here).
 * @param bolt11 - The invoice to pay.
 * @returns The preimage, `insufficient`, `cancelled`, or `skipped`.
 */
async function payAndWait(
  deps: FondPayoutTickDeps,
  target: PayoutTarget,
  bolt11: string,
): Promise<string | 'insufficient' | 'cancelled' | 'skipped'> {
  if (deps.isCancelled()) {
    return 'cancelled';
  }
  let prepared: WalletPayResult;
  try {
    prepared = await deps.payFromWallet({ type: 'input', input: bolt11 });
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
  try {
    const waited = await waitForPreimage(deps, target);
    return waited === 'cancelled' ? 'cancelled' : (waited ?? 'skipped');
  } catch {
    return 'skipped';
  }
}

/**
 * Finds an earlier send for one layout row, pays it if none is completed, and
 * posts the preimage as proof.
 *
 * A `completed` send with a 64-hex preimage is proven without paying again,
 * and a `completed` send without readable preimage skips the row; a `pending`
 * send skips the row; any other listed send falls through to paying the row
 * once. A row whose timed-out send the wallet confirmed is never paid, only
 * proven once its preimage appears. A `settling` row has no BOLT11 of its own,
 * so it is skipped when its hash matches no listed send.
 *
 * @param deps - Tick collaborators.
 * @param target - The payout target.
 * @returns `paid`, `insufficient`, `forbidden`, `cancelled`, or `skipped`.
 */
async function payAndProve(
  deps: FondPayoutTickDeps,
  target: PayoutTarget,
): Promise<'paid' | 'insufficient' | 'forbidden' | 'cancelled' | 'skipped'> {
  let preimage: string | null = null;
  try {
    const existing = await findPayment(deps, target);
    if (existing?.status === 'pending') {
      return 'skipped';
    }
    if (existing?.status === 'completed') {
      preimage = preimageOf(existing);
      if (preimage === null) {
        return 'skipped';
      }
    }
  } catch {
    return 'skipped';
  }
  if (preimage === null) {
    if (target.bolt11 === null || lateSends.has(target.id)) {
      return 'skipped';
    }
    const paid = await payAndWait(deps, target, target.bolt11);
    if (paid === 'insufficient' || paid === 'skipped' || paid === 'cancelled') {
      return paid;
    }
    preimage = paid;
  }
  if (deps.isCancelled()) {
    return 'cancelled';
  }
  const proof = await deps.postFondPayoutProof(deps.session, target.id, preimage);
  if (!proof.ok) {
    return proof.status === 403 ? 'forbidden' : 'skipped';
  }
  rememberedHashes.delete(target.id);
  lateSends.delete(target.id);
  return 'paid';
}

/** What one row left the tick with. */
type RowOutcome = 'paid' | 'insufficient' | 'forbidden' | 'cancelled' | 'skipped';

/**
 * Runs one Fond payout loop step: lists today's open rows, pays each one once
 * from the in-app wallet, and posts the preimage as proof.
 *
 * A `403` or `404` from the list stops the loop (`forbidden` / `off`). A `403`
 * from an invoice or proof request also stops it as `forbidden`; a `404` there
 * means that row is gone and is skipped, because the api answers an unknown id
 * the same way as an off surface. Every other list failure is retried by the
 * next tick. Rows are handled in list order, one at a time. A row that is
 * already pending, completed without a readable preimage, timed out, or whose
 * history cannot be read is skipped and never paid twice. An empty wallet
 * stops the whole tick. Cancellation returns at once at its next check.
 * Amounts come only from the BOLT11; the app never computes or rounds one.
 * The BOLT11, preimage, and address are never logged.
 *
 * @param deps - Session, api calls, wallet calls, and sleep.
 * @returns Counts of paid, proved, and skipped rows and the reason to stop.
 */
export async function runFondPayoutTick(deps: FondPayoutTickDeps): Promise<FondPayoutTickResult> {
  const summary: FondPayoutTickResult = { paid: 0, proved: 0, skipped: 0, stop: null };
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
    const outcome: RowOutcome = await payAndProve(deps, lookup.target);
    if (outcome === 'paid') {
      summary.paid += 1;
      summary.proved += 1;
    } else if (outcome === 'forbidden') {
      summary.stop = 'forbidden';
      return summary;
    } else if (outcome === 'insufficient') {
      return summary;
    } else if (outcome === 'cancelled') {
      return summary;
    } else {
      summary.skipped += 1;
    }
  }
  return summary;
}

/** The tick that is currently paying, shared by every caller until it settles. */
let inFlightTick: Promise<FondPayoutTickResult> | null = null;

/**
 * Runs at most one {@link runFondPayoutTick} at a time.
 *
 * An effect re-run while a tick is still in flight must not start a second
 * tick against the same rows: overlapping ticks could both read the same
 * stored BOLT11, see no send yet, and pay it twice. Every caller during a tick
 * receives that tick's promise; the guard is cleared when it settles, whether
 * it resolves or throws, so the next caller starts a fresh tick.
 *
 * @param deps - Session, api calls, wallet calls, and sleep for a new tick.
 * @returns The settled result of the single in-flight tick.
 */
export function runFondPayoutTickOnce(deps: FondPayoutTickDeps): Promise<FondPayoutTickResult> {
  if (inFlightTick !== null) {
    return inFlightTick;
  }
  const running = runFondPayoutTick(deps).finally(() => {
    inFlightTick = null;
  });
  inFlightTick = running;
  return running;
}
