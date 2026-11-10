import type { FondPayout, FondPayoutInvoice } from '@/lib/api-types';
import type { FondPayoutFailure } from '@/lib/api';
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
  /** `forbidden` on an api 403, `off` on an api 404, otherwise `null`. */
  stop: 'forbidden' | 'off' | null;
}

/** Payment hashes this tab remembers per payout id, filled when it asks for the invoice. */
const rememberedHashes = new Map<string, string>();

/** How the tick finds the wallet send for one row. */
interface PayoutTarget {
  /** Payout row id. */
  id: string;
  /** Payment hash, when the row was invoiced by this tab. */
  paymentHash: string;
  /** BOLT11 to pay, absent for a `settling` row remembered by its hash. */
  bolt11: string | null;
}

/**
 * The invoice to pay for one row, from this tab's memory or from the api.
 *
 * @param deps - Tick collaborators.
 * @param row - Payout row to invoice.
 * @returns The payout target, or `null` when the row is not payable now.
 */
async function targetFor(deps: FondPayoutTickDeps, row: FondPayout): Promise<PayoutTarget | null> {
  if (row.status === 'settling') {
    const paymentHash = rememberedHashes.get(row.id);
    return paymentHash === undefined ? null : { id: row.id, paymentHash, bolt11: null };
  }
  const result = await deps.postFondPayoutInvoice(deps.session, row.id);
  if (!result.ok) {
    return null;
  }
  rememberedHashes.set(row.id, result.invoice.paymentHash);
  return {
    id: row.id,
    paymentHash: result.invoice.paymentHash,
    bolt11: result.invoice.bolt11,
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
 * @returns The normalized preimage, or `null` after the last read.
 */
async function waitForPreimage(
  deps: FondPayoutTickDeps,
  target: PayoutTarget,
): Promise<string | null> {
  for (let read = 0; read < FOND_PAYOUT_PREIMAGE_READS; read += 1) {
    await deps.sleep(FOND_PAYOUT_PREIMAGE_WAIT_MS);
    const preimage = preimageOf(await findPayment(deps, target));
    if (preimage !== null) {
      return preimage;
    }
  }
  return null;
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
 * @returns The preimage, `insufficient`, or `skipped`.
 */
async function payAndWait(
  deps: FondPayoutTickDeps,
  target: PayoutTarget,
  bolt11: string,
): Promise<string | 'insufficient' | 'skipped'> {
  let prepared: WalletPayResult;
  try {
    prepared = await deps.payFromWallet({ type: 'input', input: bolt11 });
  } catch {
    return 'skipped';
  }
  if (prepared.kind === 'insufficient') {
    return 'insufficient';
  }
  if (prepared.kind !== 'confirm') {
    return 'skipped';
  }
  let sent: WalletSendResult;
  try {
    sent = await prepared.send();
  } catch {
    return 'skipped';
  }
  if (sent.kind === 'insufficient') {
    return 'insufficient';
  }
  if (sent.kind !== 'paid') {
    return 'skipped';
  }
  try {
    return (await waitForPreimage(deps, target)) ?? 'skipped';
  } catch {
    return 'skipped';
  }
}

/**
 * Finds an earlier send for one layout row, pays it if none is completed, and
 * posts the preimage as proof.
 *
 * A `completed` send with a 64-hex preimage is proven without paying again; a
 * `pending` send skips the row; any other listed send falls through to paying
 * the row once. A `settling` row has no BOLT11 of its own, so it is skipped
 * when its remembered hash matches no listed send.
 *
 * @param deps - Tick collaborators.
 * @param target - The payout target.
 * @returns `paid`, `insufficient`, or `skipped`.
 */
async function payAndProve(
  deps: FondPayoutTickDeps,
  target: PayoutTarget,
): Promise<'paid' | 'insufficient' | 'skipped'> {
  let preimage: string | null = null;
  try {
    const existing = await findPayment(deps, target);
    if (existing?.status === 'pending') {
      return 'skipped';
    }
    if (existing?.status === 'completed') {
      preimage = preimageOf(existing);
    }
  } catch {
    return 'skipped';
  }
  if (preimage === null) {
    if (target.bolt11 === null) {
      return 'skipped';
    }
    const paid = await payAndWait(deps, target, target.bolt11);
    if (paid === 'insufficient' || paid === 'skipped') {
      return paid;
    }
    preimage = paid;
  }
  const proof = await deps.postFondPayoutProof(deps.session, target.id, preimage);
  if (!proof.ok) {
    return 'skipped';
  }
  rememberedHashes.delete(target.id);
  return 'paid';
}

/**
 * Runs one Fond payout loop step: lists today's open rows, pays each one once
 * from the in-app wallet, and posts the preimage as proof.
 *
 * A `403` or `404` from the list stops the loop (`forbidden` / `off`). Every
 * other list failure is retried by the next tick. Rows are handled in list
 * order, one at a time. A row that is already pending, or whose history
 * cannot be read, is skipped and never paid twice. An empty wallet stops the
 * whole tick. Amounts come only from the BOLT11; the app never computes or
 * rounds one. The BOLT11, preimage, and address are never logged.
 *
 * @param deps - Session, api calls, wallet calls, and sleep.
 * @returns Counts of paid, proved, and skipped rows and the reason to stop.
 */
export async function runFondPayoutTick(
  deps: FondPayoutTickDeps,
): Promise<FondPayoutTickResult> {
  const summary: FondPayoutTickResult = { paid: 0, proved: 0, skipped: 0, stop: null };
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
    const target = await targetFor(deps, row);
    if (target === null) {
      summary.skipped += 1;
      continue;
    }
    const outcome = await payAndProve(deps, target);
    if (outcome === 'paid') {
      summary.paid += 1;
      summary.proved += 1;
    } else if (outcome === 'insufficient') {
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
export function runFondPayoutTickOnce(
  deps: FondPayoutTickDeps,
): Promise<FondPayoutTickResult> {
  if (inFlightTick !== null) {
    return inFlightTick;
  }
  const running = runFondPayoutTick(deps).finally(() => {
    inFlightTick = null;
  });
  inFlightTick = running;
  return running;
}
