'use client';

import { Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type FormEvent, type ReactElement } from 'react';
import { AmountEntry } from '@/components/AmountEntry';
import { useFiatPreference } from '@/components/FiatPreferenceProvider';
import { useTranslations } from '@/components/LocaleProvider';
import { useNumberFormat } from '@/components/NumberFormatProvider';
import { PosHistory } from '@/components/PosHistory';
import { PosPaidOverlay } from '@/components/PosPaidOverlay';
import { QrCode } from '@/components/QrCode';
import { WalletSetupNote } from '@/components/WalletSetupNote';
import { Button, ButtonLink, Card } from '@/components/ui';
import { useSpotRateState } from '@/hooks/useSpotRate';
import { useWalletSetup } from '@/hooks/useWalletSetup';
import { giftsLightningAddress, openCryptoPayQrValue } from '@/lib/gifts-address';
import { PAY_POLL_MS } from '@/lib/payment-link';
import { logInteraction } from '@/lib/interaction-log';
import { CannotReceiveError, WalletRequiredError } from '@/lib/api';
import { committedFiatFigure, type FiatCode } from '@/lib/committed-fiat';
import { formatDefinedGoalAmount } from '@/lib/forum-goal';
import {
  cancelPosCharge,
  createPosCharge,
  fetchPosState,
  type PosCharge,
  type PosState,
} from '@/lib/pos';
import { profileQrLogo } from '@/lib/profile-qr-logo';
import { returnToView } from '@/lib/view-history';
import { visualPin } from '@/lib/visual-pin';
import type { WalletPayment } from '@/lib/wallet/wallet-sdk';
import { announceReceivedForE2e, onPaymentReceived } from '@/lib/wallet/wallet-service';
import type { AmountUnit } from '@/lib/api-types';
import type { NumberFormatStyle } from '@/lib/number-format';
import {
  formatBitcoin,
  formatFiatDisplay,
  draftUnit,
  parseAmountDraft,
  satsToFiatAmount,
  type FiatRateDay,
} from '@/lib/stats-money';
import { useAuthStore } from '@/stores/auth-store';
import { useWalletStore } from '@/stores/wallet-store';

/**
 * Fiat under a till amount. A stored figure is shown as-is. With none, the
 * current spot stands beside the bitcoin and is not written onto the charge.
 */
function posFiatText(
  stored: { code: FiatCode; amount: string } | null,
  sats: number,
  rateDay: FiatRateDay | null,
  fiat: FiatCode,
  numberFormat: NumberFormatStyle,
): string | null {
  if (stored !== null) {
    const exact = formatDefinedGoalAmount(stored.amount, stored.code, numberFormat);
    return exact === '' ? formatFiatDisplay(stored.amount, stored.code, numberFormat) : exact;
  }
  const spot = satsToFiatAmount(sats, rateDay, fiat);
  return spot === null ? null : formatFiatDisplay(spot, fiat, numberFormat);
}

/** Remaining time as m:ss. */
function formatLeft(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

/** Apply `apply` only while `mine` is still the latest till request. */
function whenCurrent(latest: { readonly current: number }, mine: number, apply: () => void): void {
  if (latest.current === mine) {
    apply();
  }
}

/**
 * How long past its end a Lightning payment the wallet receives can still be
 * the charge's: the api still marks a charge paid when the payment is
 * confirmed after it ran out, so the till keeps asking it that long.
 */
const POS_LATE_PAID_MS = 60_000;

/**
 * Screenshot pin: the wallet reports a payment of the open charge's Spark invoice the moment the
 * charge shows (Playwright builds only).
 */
const POS_RECEIVED_VISUAL_PIN = 'pos-received';

/**
 * Pin: the wallet reports a Lightning payment of the open charge's amount that names no charge
 * the moment the charge shows (Playwright builds only). It pays nothing; the till asks the api.
 */
const POS_UNNAMED_VISUAL_PIN = 'pos-received-unnamed';

/** The later-created of two charges, or the one that is not `null`. */
function newerCharge(a: PosCharge | null, b: PosCharge | null): PosCharge | null {
  if (a === null || b === null) {
    return a ?? b;
  }
  return Date.parse(b.createdAt) > Date.parse(a.createdAt) ? b : a;
}

/** `state` after its open charge was cancelled: no open charge, and that charge listed as cancelled. */
function withoutOpenCharge(state: PosState): PosState {
  const open = state.charge;
  /* v8 ignore next 3 -- Cancel shows only while the newest read has the charge open */
  if (open === null || open.status !== 'pending') {
    return state;
  }
  return {
    ...state,
    charge: null,
    history: [
      { ...open, status: 'cancelled' },
      ...state.history.filter((row) => row.id !== open.id),
    ],
  };
}

/** Till reads started, the newest answer on screen, and the oldest a cancel still shows. */
type TillReads = { started: number; applied: number; floor: number };

/** Number the next till read. */
function startRead(reads: { current: TillReads }): number {
  reads.current.started += 1;
  return reads.current.started;
}

/**
 * Apply the answer of read `seq` only when it is still new enough to show.
 * A slow refresh cannot replace a newer answer, and a read already in flight
 * cannot put a charge back after a successful cancel moved the floor past it.
 */
function applyRead(reads: { current: TillReads }, seq: number, apply: () => void): void {
  if (seq < reads.current.floor || seq <= reads.current.applied) {
    return;
  }
  reads.current.applied = seq;
  apply();
}

/** Create or cancel that is still talking to the server, across page changes. */
let tillWrite: Promise<void> | null = null;

/** Paid charges already recorded as seen in this tab, so each is recorded once. */
const paidSeen = new Set<string>();

/**
 * A wallet payment that names a charge: a payment of the api's Spark invoice
 * of a charge (memo `pos:<id>`, read by the wallet as `info.chargeId`), with
 * its amount, fee and payment time. Only such a payment is tied to a charge by
 * an identifier, so only such a payment pays one on this till.
 */
type TillPayment = Pick<WalletPayment, 'amountSats' | 'feesSats' | 'timestamp'> & {
  chargeId: string;
};

/**
 * A Lightning payment the wallet received that names no charge: its amount,
 * fee and payment time. `GET /pos` does not return the payment hashes of the
 * BOLT11 invoices the api handed out for a charge, so the till cannot tell a
 * payment of the charge from another payment of that amount (the static
 * sticker QR, a grant, another member). It pays no charge; while it could be
 * the open charge's ({@link mayPay}), the till asks the api, which knows.
 */
type UnnamedReceipt = Pick<WalletPayment, 'amountSats' | 'feesSats' | 'timestamp'>;

/**
 * What this tab's wallet settled for one session, shared by `/pos` and
 * `/pos/amount` so a page change keeps it: the last open charge (the api
 * still marks a payment just after its end), the charges the wallet saw paid
 * before the api may know it, a lost create the api already showed paid, and
 * the paid charges whose confirmation was closed.
 */
type WalletSettled = {
  session: string | null;
  open: PosCharge | null;
  paid: Map<string, PosCharge>;
  /**
   * A create whose answer was lost, when the read after it already showed the
   * new charge paid. The till confirms it after that page is gone, even when
   * a later read fails or no longer returns it. Not a payment this tab's
   * wallet saw, so it is not in `paid`.
   */
  reported: Map<string, PosCharge>;
  closed: Set<string>;
  /** Payments that name a charge no known open charge is (a till still reading the next one), by payment time. */
  early: Array<TillPayment>;
  /** Lightning payments that name no charge, by payment time: each may make the till ask the api. */
  unnamed: Array<UnnamedReceipt>;
  /** A payment arrived that the till cannot settle itself: one read shows what the api knows. */
  recheck: boolean;
  /**
   * The charge before a create that is on its way: a payment that names it
   * still pays it while no charge is open.
   */
  creatingAfter: PosCharge | null;
  /** Ids of every charge a read of this session listed. */
  seen: Set<string>;
};

/**
 * How many payments no known open charge took, and how many Lightning
 * payments that name no charge, are kept: the newest by the wallet's payment
 * time, so old payments a connection lists never push out a new one.
 */
const POS_EARLY_PAYMENTS = 20;

/** The wallet states when a payment was made in whole seconds: payment and creation are compared in these. */
const POS_PAID_TIME_GRAIN_MS = 1_000;

let walletSettled: WalletSettled | null = null;

/** Tills that re-render when {@link walletSettled} changes. */
const walletSettledListeners = new Set<() => void>();

/** The settled memory of `session`; another session starts it over. */
function settledFor(session: string | null): WalletSettled {
  if (walletSettled === null || walletSettled.session !== session) {
    walletSettled = {
      session,
      open: null,
      paid: new Map(),
      reported: new Map(),
      closed: new Set(),
      early: [],
      unnamed: [],
      recheck: false,
      creatingAfter: null,
      seen: new Set(),
    };
  }
  return walletSettled;
}

/** Re-render every till after the settled memory changed. */
function settledChanged(): void {
  for (const listener of walletSettledListeners) {
    listener();
  }
}

/** Whether `amountSats`, or `amountSats` after `feesSats`, is the amount of `charge`. */
function fitsAmount(
  charge: PosCharge,
  payment: Pick<WalletPayment, 'amountSats' | 'feesSats'>,
): boolean {
  return (
    payment.amountSats === charge.amountSats ||
    payment.amountSats + payment.feesSats === charge.amountSats
  );
}

/**
 * Whether `payment` pays `charge`: it names that charge (the charge's Spark
 * invoice) and carries its amount. Amount and time alone never pay a charge.
 */
function pays(charge: PosCharge, payment: TillPayment): boolean {
  return payment.chargeId === charge.id && fitsAmount(charge, payment);
}

/**
 * Whether a Lightning payment that names no charge could be the payment of
 * `charge`: its amount, or its amount after the fee, made (by the wallet's own
 * payment time, compared in whole seconds, {@link POS_PAID_TIME_GRAIN_MS})
 * from the second of the charge's creation up to {@link POS_LATE_PAID_MS}
 * after its end. It does not pay the charge: it only makes the till ask the
 * api, which knows the invoices it handed out for the charge.
 */
function mayPay(charge: PosCharge, receipt: UnnamedReceipt): boolean {
  return (
    fitsAmount(charge, receipt) &&
    Math.floor(receipt.timestamp / POS_PAID_TIME_GRAIN_MS) >=
      Math.floor(Date.parse(charge.createdAt) / POS_PAID_TIME_GRAIN_MS) &&
    receipt.timestamp <= Date.parse(charge.expiresAt) + POS_LATE_PAID_MS
  );
}

/**
 * The open charge in `memory` is paid the moment this tab's wallet reports a
 * payment that {@link pays} it. No reading of the api in between. A payment
 * that names another charge is kept and tried again once the next open charge
 * is known, or settled by {@link settleNamed} when a read lists the charge it
 * names. Works on the memory it is given, so a session that ended meanwhile
 * never touches the memory of the next one.
 */
function settleOpen(memory: WalletSettled, payment: TillPayment): void {
  const open = memory.open;
  const before = memory.creatingAfter;
  if (open === null && before !== null && pays(before, payment)) {
    // It names the charge before, while a create is on its way: that charge, at once.
    markPaid(memory, before, payment);
    return;
  }
  if (open === null || !pays(open, payment)) {
    // Not this charge's: it may name the next one, which the till has not read yet, or one the
    // till already read (`settleNamed`).
    keepEarly(memory, payment);
    settledChanged();
    return;
  }
  markPaid(memory, open, payment);
}

/** Charge `charge` is paid by `payment` on this till. */
function markPaid(memory: WalletSettled, charge: PosCharge, payment: TillPayment): void {
  if (memory.open?.id === charge.id) {
    memory.open = null;
  }
  // Paid when the wallet made the payment, not when this tab matched it.
  memory.paid.set(charge.id, {
    ...charge,
    status: 'paid',
    paidAt: new Date(payment.timestamp).toISOString(),
  });
  settledChanged();
}

/**
 * A kept payment that names a charge `state` lists, other than the charge on
 * screen, pays that charge at once, however long ago it ran out, when it
 * carries its amount ({@link pays}); a paid or cancelled charge takes none. The charge on screen
 * takes payments only as the open charge, so none pays it while Cancel is on
 * its way.
 */
function settleNamed(memory: WalletSettled, state: PosState): void {
  const kept: TillPayment[] = [];
  for (const payment of memory.early) {
    const named =
      payment.chargeId === undefined || payment.chargeId === state.charge?.id
        ? undefined
        : state.history.find(
            (row) =>
              pays(row, payment) &&
              row.status !== 'paid' &&
              row.status !== 'cancelled' &&
              !memory.paid.has(row.id),
          );
    if (named === undefined) {
      kept.push(payment);
      continue;
    }
    markPaid(memory, named, payment);
  }
  memory.early = kept;
}

/** Keeps `payment` for the next open charge, among the newest by payment time. */
function keepEarly(memory: WalletSettled, payment: TillPayment): void {
  memory.early = [...memory.early, payment]
    .sort((a, b) => a.timestamp - b.timestamp)
    .slice(-POS_EARLY_PAYMENTS);
}

/** Keeps `receipt`, a Lightning payment that names no charge, among the newest by payment time. */
function keepUnnamed(memory: WalletSettled, receipt: UnnamedReceipt): void {
  memory.unnamed = [...memory.unnamed, receipt]
    .sort((a, b) => a.timestamp - b.timestamp)
    .slice(-POS_EARLY_PAYMENTS);
}

/**
 * Whether the till asks the api again for the open charge in `memory`: a
 * Lightning payment that names no charge could be its payment ({@link mayPay}),
 * made at most {@link POS_LATE_PAID_MS} before `now`, and the wallet did not pay
 * the charge by its Spark invoice. Ends once a read shows the charge paid,
 * cancelled or gone before its end (the arming effect drops it), and one minute
 * after the last such payment, so one made in the last second of the charge's
 * late minute still gets its reads.
 */
function asksApi(memory: WalletSettled, now: number): boolean {
  const open = memory.open;
  return (
    open !== null &&
    !memory.paid.has(open.id) &&
    memory.unnamed.some(
      (receipt) => mayPay(open, receipt) && now <= receipt.timestamp + POS_LATE_PAID_MS,
    )
  );
}

/**
 * When `state` shows the open charge in `memory` paid and this tab's wallet
 * received a Lightning payment that could be its payment ({@link mayPay}), the
 * api tied that payment to the charge (it knows the charge's invoices): the
 * charge counts as paid by this tab's wallet, with the api's payment time, so
 * the amount page returns to the till for its confirmation as it does for a
 * payment that names the charge.
 */
function confirmAsked(memory: WalletSettled, state: PosState): void {
  const open = memory.open;
  if (open === null || !memory.unnamed.some((receipt) => mayPay(open, receipt))) {
    return;
  }
  const row = tillCharges(state).find((candidate) => candidate.id === open.id);
  if (row?.status === 'paid') {
    memory.paid.set(row.id, row);
    settledChanged();
  }
}

/** Till reads of one session that are on their way. */
type ReadsInFlight = { session: string | null; count: number };

/** The count of reads on their way for `session`; another session starts it over at none. */
function inFlightFor(ref: { current: ReadsInFlight }, session: string | null): ReadsInFlight {
  if (ref.current.session !== session) {
    ref.current = { session, count: 0 };
  }
  return ref.current;
}

/** Make `charge` the open charge in `memory` and try the kept payments on it again; the rest stay kept. */
function armOpen(memory: WalletSettled, charge: PosCharge): void {
  // A charge this tab's wallet already paid takes no further payment, even while the api still
  // shows it open.
  if (memory.paid.has(charge.id)) {
    return;
  }
  memory.open = charge;
  const early = memory.early;
  memory.early = [];
  for (const payment of early) {
    // One that names another charge stays kept.
    settleOpen(memory, payment);
  }
}

/** Every charge a till answer names: its current charge and its history. */
function tillCharges(state: PosState): PosCharge[] {
  return state.charge === null ? state.history : [state.charge, ...state.history];
}

/** Whether a till answer shows charge `id` paid or cancelled: no further payment is its. */
function finishedIn(state: PosState, id: string): boolean {
  return tillCharges(state).some(
    (row) => row.id === id && (row.status === 'paid' || row.status === 'cancelled'),
  );
}

/** Make `charge` the open charge in `memory` again, when there was one. */
function rearm(memory: WalletSettled, charge: PosCharge | null): void {
  if (charge !== null) {
    armOpen(memory, charge);
  }
}

/** How far the api's clock may run behind this one when a lost create is matched to its charge. */
const POS_CREATE_SKEW_MS = 30_000;

/** Create answers that say for certain no charge was made. */
const POS_CREATE_REFUSALS = new Set([
  'Amount is outside the wallet range',
  'A payment is already open',
  'Set a username first',
]);

/**
 * Drop a till write, the paid charges recorded as seen, and what the wallet
 * settled, left behind by a test, and stop listening to the wallet so the
 * next test listens afresh. Production clears the write when the request
 * settles.
 */
export function resetPosTillWriteForTests(): void {
  tillWrite = null;
  paidSeen.clear();
  walletSettled = null;
  walletListening?.();
  walletListening = null;
}

/** Stops listening to this tab's wallet; set once a till page has listened. */
let walletListening: (() => void) | null = null;

/**
 * Listen to this tab's wallet for good once a signed-in till page opened, so a
 * payment that lands while the member is on another page still pays (or is
 * kept for) the open charge of the signed-in session.
 */
function listenToWallet(): void {
  if (walletListening !== null) {
    return;
  }
  walletListening = onPaymentReceived((payment) => {
    const session = useAuthStore.getState().session;
    if (session === null) {
      return;
    }
    const { chargeId } = payment.info;
    const memory = settledFor(session);
    if (chargeId === undefined) {
      // A payment that names no charge pays none: its amount and time do not tie it to a charge.
      // Only a Lightning one can be a till payment (the till's address takes the charge amount over
      // Lightning); the api knows whether it paid one of the charge's invoices, so one read asks it,
      // and while it could be the open charge's the till keeps asking (`asksApi`). A Spark transfer
      // without that name, or an on-chain deposit, is someone else's money.
      if (payment.method === 'lightning') {
        keepUnnamed(memory, {
          amountSats: payment.amountSats,
          feesSats: payment.feesSats,
          timestamp: payment.timestamp,
        });
        memory.recheck = true;
        settledChanged();
      }
      return;
    }
    const till: TillPayment = {
      amountSats: payment.amountSats,
      feesSats: payment.feesSats,
      timestamp: payment.timestamp,
      chargeId,
    };
    settleOpen(memory, till);
    if (memory.early.includes(till) && !memory.seen.has(chargeId)) {
      // It names a charge no read listed: one read shows whether another tab or device opened the
      // charge it pays. Only for a payment the wallet just reported, not a kept one tried again.
      memory.recheck = true;
      settledChanged();
    }
  });
}

/** Remember `work` until it settles so a later till load does not race it. */
function trackTillWrite(work: Promise<void>): void {
  const tracked = work.finally(() => {
    if (tillWrite === tracked) {
      tillWrite = null;
    }
  });
  tillWrite = tracked;
}

/** Values shared by the QR page and the amount page. */
type PosTillState = {
  address: string | null;
  qr: string | null;
  showQr: boolean;
  state: PosState | null;
  /** Session whose till read or create produced `state`. */
  stateSession: string | null;
  error: string | null;
  charge: PosState['charge'];
  /** The paid charge the full-screen confirmation shows, until it is closed. */
  paid: PosState['charge'];
  /** Whether `paid` is one this tab's wallet saw paid (not only the api). */
  paidByWallet: boolean;
  /** Past charges, with a charge the wallet saw paid already shown as paid. */
  history: PosState['history'];
  /** Payments the wallet received without a till charge, newest first, from the last read. */
  received: PosState['received'];
  remaining: number;
  /** The currency figure stored with the open charge, otherwise `null` (the till shows the current spot). */
  chargeFigure: { code: FiatCode; amount: string } | null;
  /** The currency figure stored with `paid`, otherwise `null` (the till shows the current spot). */
  paidFigure: { code: FiatCode; amount: string } | null;
  amount: string;
  setAmount: (value: string) => void;
  shownUnit: AmountUnit;
  setShownUnit: (value: AmountUnit) => void;
  busy: boolean;
  rateDay: FiatRateDay | null;
  canCharge: boolean;
  amountError: string | null;
  loadingAlert: boolean;
  needsUsername: boolean;
  needsWallet: boolean;
  onCreate: (event: FormEvent) => Promise<void>;
  onCancel: () => Promise<void>;
  retryLoad: () => void;
  /** Closes the paid confirmation of charge `id` and reads the till again. */
  closePaid: (id: string) => void;
  /** Reads the till again; a failure stays quiet while the till already shows an answer. */
  readAgain: () => void;
};

/** Shared till state for the QR page and the amount page. */
function usePosTillState(): PosTillState {
  const { t } = useTranslations();
  const { fiat } = useFiatPreference();
  const refreshed = useRef<string | null>(null);
  const generation = useRef(0);
  const reads = useRef<TillReads>({ started: 0, applied: 0, floor: 0 });
  const account = useAuthStore((state) => state.account);
  const session = useAuthStore((state) => state.session);
  const { rateDay, loading: rateLoading } = useSpotRateState(session !== null);
  const rateSettled = !rateLoading;
  // The till and the session whose read or create produced it, set together so
  // an effect of one render never pairs one member's till with another's session.
  const [till, setTill] = useState<{ state: PosState | null; session: string | null }>({
    state: null,
    session: null,
  });
  // Another session's till is never shown, not even while this session's read is on its way.
  const state = till.session === session ? till.state : null;
  // An error belongs to the session whose read, create or cancel set it: another session never sees it.
  const [errorState, setErrorState] = useState<{ message: string; session: string } | null>(null);
  const error = errorState !== null && errorState.session === session ? errorState.message : null;
  // Whether the error shown is a failed till read, which the next read that comes in clears.
  const readFailed = useRef(false);
  // A load skipped while a create or cancel was on its way, run once that ends.
  const skippedLoad = useRef(false);

  /** Runs the load a session or language change asked for while a create or cancel was on its way. */
  function runSkippedLoad(): void {
    if (skippedLoad.current) {
      skippedLoad.current = false;
      setReload((n) => n + 1);
    }
  }

  /** Shows `message` (or clears the error), which no later till read takes away. */
  function showError(message: string | null): void {
    readFailed.current = false;
    setErrorState(message === null || session === null ? null : { message, session });
  }
  const [amount, setAmount] = useState('');
  const [amountTouched, setAmountTouched] = useState(false);
  const [loadingAlert, setLoadingAlert] = useState(false);
  const [shownUnit, setShownUnit] = useState<AmountUnit>(account?.amountUnit ?? 'btc');
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  busyRef.current = busy;
  const [now, setNow] = useState(() => Date.now());
  const [showQr, setShowQr] = useState(false);
  const [reload, setReload] = useState(0);
  // The read after a closed confirmation fails quietly: the till already shows what it needs.
  const quietReload = useRef(false);
  const [settledVersion, setSettledVersion] = useState(0);
  // Counts the till reads of the load effect that settled, so the api is asked again only after
  // the read before answered or failed.
  const [readsSettled, setReadsSettled] = useState(0);
  // How many till reads of this session (of the load effect, or the 0:00 read) are on their way:
  // the next ask waits until none is, so a slow read is never cut off and its answer never
  // dropped. A read of the session before counts only for that session.
  const readsInFlight = useRef<ReadsInFlight>({ session, count: 0 });
  const memory = settledFor(session);
  const walletPaid = memory.paid;
  const closed = memory.closed;

  useEffect(() => {
    setShowQr(true);
  }, []);

  useEffect(() => {
    const listener = (): void => {
      setSettledVersion((n) => n + 1);
    };
    walletSettledListeners.add(listener);
    return () => {
      walletSettledListeners.delete(listener);
    };
  }, []);

  useEffect(() => {
    // A locale or session change must not start a load that shares the
    // generation of an in-flight create or cancel.
    if (session === null) {
      return;
    }
    if (busyRef.current) {
      skippedLoad.current = true;
      return;
    }
    let alive = true;
    const mine = generation.current;
    const pending = tillWrite;
    const quiet = quietReload.current;
    quietReload.current = false;
    const inFlight = inFlightFor(readsInFlight, session);
    inFlight.count += 1;
    void (async (): Promise<void> => {
      try {
        if (pending !== null) {
          await pending;
        }
        if (!alive) {
          return;
        }
        const seq = startRead(reads);
        try {
          const next = await fetchPosState(session);
          if (!alive) {
            return;
          }
          whenCurrent(generation, mine, () => {
            applyRead(reads, seq, () => {
              setTill({ state: next, session });
              // The till answered: an earlier failed read no longer holds.
              if (readFailed.current) {
                readFailed.current = false;
                setErrorState(null);
              }
            });
          });
        } catch {
          // A newer read already answered, so this failure says nothing about the till now.
          if (!alive || quiet || seq < reads.current.applied) {
            return;
          }
          whenCurrent(generation, mine, () => {
            readFailed.current = true;
            setErrorState({ message: t('pos.error'), session });
          });
        }
      } finally {
        // Also a read a later load replaced: it was on its way until now.
        inFlight.count -= 1;
        setReadsSettled((n) => n + 1);
      }
    })();
    return () => {
      alive = false;
    };
  }, [reload, session, t]);

  const username = account?.username ?? null;
  /* v8 ignore next -- this client screen always runs in a browser */
  const host = typeof window === 'undefined' ? '21.gifts' : window.location.hostname;
  const address = giftsLightningAddress(username, host);
  const qr = openCryptoPayQrValue(username, host);
  const shown = state?.charge ?? null;
  const pending = shown !== null && shown.status === 'pending' ? shown : null;
  const charge = pending !== null && !walletPaid.has(pending.id) ? pending : null;
  const serverPaid = shown !== null && shown.status === 'paid' ? shown : null;
  // The newest paid charge whose confirmation is not closed yet, by creation; once it is closed the
  // next one shows, so two payments settled at once both confirm. A lost create the api already
  // showed paid stays here after that read is gone.
  const confirmed = [serverPaid, ...walletPaid.values(), ...memory.reported.values()];
  const latest = confirmed.reduce<PosCharge | null>(
    (newest, row) => (row === null || closed.has(row.id) ? newest : newerCharge(newest, row)),
    null,
  );
  // A newer open charge hides an older paid one: its confirmation is over.
  const paid = latest !== null && newerCharge(charge, latest) === latest ? latest : null;
  // Every confirmation a newer open charge hides, not only the newest: none comes back after it.
  const hiddenPaidIds =
    charge === null
      ? ''
      : confirmed
          .filter(
            (row): row is PosCharge =>
              row !== null && !closed.has(row.id) && newerCharge(charge, row) === charge,
          )
          .map((row) => row.id)
          .join(' ');
  const history =
    state === null
      ? []
      : (() => {
          const rows = state.history.map((row) =>
            row.status === 'paid' ? row : (walletPaid.get(row.id) ?? row),
          );
          // A lost create the api already showed paid stays in History after Done,
          // even when a later read no longer returns it. It is not a wallet payment.
          const seen = new Set(rows.map((row) => row.id));
          const remembered = [...memory.reported.values()].filter((row) => !seen.has(row.id));
          return [...remembered.reverse(), ...rows];
        })();
  const remaining = charge === null ? 0 : Date.parse(charge.expiresAt) - now;
  // Only a figure stored with the charge (typed, else its stored snapshot in the viewer's
  // currency), never one priced from a rate (docs/fiat-amounts.md).
  const chargeFigure = charge === null ? null : committedFiatFigure(charge, fiat);
  const paidFigure = paid === null ? null : committedFiatFigure(paid, fiat);
  const needsUsername = account !== null && (account.username ?? '') === '';
  const needsWallet =
    account !== null && (account.username ?? '') !== '' && account.sparkWalletVerified !== true;
  const canCharge = (account?.username ?? '') !== '' && account?.sparkWalletVerified === true;

  useEffect(() => {
    if (charge === null) {
      return;
    }
    // The clock stood still while no charge was open: the countdown starts from now.
    setNow(Date.now());
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => {
      clearInterval(timer);
    };
  }, [charge]);

  const tillSession = till.session;
  useEffect(() => {
    // Only a till this session read says which charge is open, not one left from the session before.
    if (tillSession !== session) {
      return;
    }
    const memory = settledFor(session);
    /* v8 ignore next -- a till this session read always has an answer */
    if (state !== null) {
      for (const row of tillCharges(state)) {
        memory.seen.add(row.id);
      }
      confirmAsked(memory, state);
    }
    if (charge !== null) {
      // A payment the wallet reported while this charge was still being read counts for it. Not
      // while a create or cancel is on its way: the charge takes no payment then, and a failed
      // cancel arms it again itself.
      if (!busyRef.current) {
        armOpen(memory, charge);
      }
    } else if (
      memory.open !== null &&
      (Date.now() < Date.parse(memory.open.expiresAt) ||
        /* v8 ignore next -- a till this session read always has an answer */
        (state !== null && finishedIn(state, memory.open.id)))
    ) {
      // Gone before its end (cancelled elsewhere, or paid per the api), or read as paid or
      // cancelled after it: no further payment belongs to it. One that only ran out stays, so a
      // payment just after its end still counts, and the till still asks the api about it.
      memory.open = null;
    }
  }, [busy, charge, session, state, tillSession]);

  useEffect(() => {
    // A payment that names a charge this read lists pays it now, not at the next read.
    if (tillSession === session && state !== null) {
      settleNamed(settledFor(session), state);
    }
  }, [session, settledVersion, state, tillSession]);

  useEffect(() => {
    if (session !== null) {
      listenToWallet();
    }
  }, [session]);

  useEffect(() => {
    // A payment the till cannot settle itself arrived: one read shows what the api knows (whether
    // it paid the open charge, or which charge a payment names). Quiet once the till has an answer.
    // After a read on its way, never beside it, so that read is not cut off.
    const settled = settledFor(session);
    if (session !== null && settled.recheck && inFlightFor(readsInFlight, session).count === 0) {
      settled.recheck = false;
      quietReload.current = state !== null;
      setReload((n) => n + 1);
    }
  }, [readsSettled, session, settledVersion, state]);

  // A Lightning payment that names no charge could be the open charge's: only the api, which
  // knows the invoices it handed out for the charge, can say so. Until a read shows the charge
  // paid (or cancelled, or gone before its end) the till asks again, each time {@link PAY_POLL_MS} after the read
  // before settled, and at most until {@link POS_LATE_PAID_MS} after that payment. The first
  // ask follows the read the payment asked for at once (`recheck`), never runs beside a read on
  // its way, and so never cuts one off.
  const asking = session !== null && asksApi(memory, Date.now());
  useEffect(() => {
    if (!asking || session === null || inFlightFor(readsInFlight, session).count > 0) {
      return;
    }
    const timer = setTimeout(() => {
      if (
        inFlightFor(readsInFlight, session).count === 0 &&
        asksApi(settledFor(session), Date.now())
      ) {
        quietReload.current = true;
        setReload((n) => n + 1);
      }
    }, PAY_POLL_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [asking, readsSettled, session]);

  useEffect(() => {
    // A confirmation a newer open charge hid is over: it does not come back once that charge ends.
    for (const id of hiddenPaidIds.split(' ')) {
      if (id !== '') {
        settledFor(session).closed.add(id);
      }
    }
  }, [hiddenPaidIds, session]);

  // Charges the unnamed pin already reported: each read returns a new charge object, and the pin
  // reports each charge once, as the wallet tells each payment once.
  const unnamedPinned = useRef(new Set<string>());
  useEffect(() => {
    const pin = visualPin();
    if (
      charge !== null &&
      pin === POS_UNNAMED_VISUAL_PIN &&
      !unnamedPinned.current.has(charge.id)
    ) {
      unnamedPinned.current.add(charge.id);
      // Through the wallet listener, as if this tab's wallet had received the charge amount over
      // Lightning from a payment that names no charge (the sticker QR, a grant, another member).
      announceReceivedForE2e({
        id: `pos-received-unnamed-${charge.id}`,
        direction: 'received',
        amountSats: charge.amountSats,
        feesSats: 0,
        timestamp: Date.now(),
        status: 'completed',
        method: 'lightning',
        senderComment: null,
        info: {},
      });
    }
    if (charge !== null && pin === POS_RECEIVED_VISUAL_PIN) {
      // Through the wallet listener, as if this tab's wallet had received the charge's Spark
      // invoice, which names the charge.
      announceReceivedForE2e({
        id: `pos-received-${charge.id}`,
        direction: 'received',
        amountSats: charge.amountSats,
        feesSats: 0,
        timestamp: Date.now(),
        status: 'completed',
        method: 'spark',
        senderComment: null,
        info: { purpose: 'shop', chargeId: charge.id },
      });
    }
  }, [charge, session]);

  useEffect(() => {
    // Back on the tab, read the till once: it may have changed while it was hidden.
    const onVisible = (): void => {
      if (document.visibilityState === 'visible') {
        setReload((n) => n + 1);
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  const unit = draftUnit(shownUnit, account?.amountUnit, amount);
  const amountParsed = parseAmountDraft(unit, amount, rateDay, fiat);
  const amountBlank = amount.trim() === '';
  let amountError: string | null = null;
  if (amountBlank) {
    if (amountTouched && unit !== 'fiat') {
      amountError = t('pos.badAmount');
    }
  } else if (!(unit === 'fiat' && !rateSettled && amountParsed.kind === 'no-rate')) {
    if (amountParsed.kind === 'no-rate') {
      amountError = t('pos.noRate', { code: fiat });
    } else if (unit === 'fiat' && amountParsed.kind === 'invalid') {
      amountError = t('amount.cannotConvert');
    } else if (unit === 'fiat' && amountParsed.kind === 'sats' && amountParsed.sats < 1) {
      amountError = null;
    } else if (
      amountParsed.kind !== 'sats' ||
      !Number.isInteger(amountParsed.sats) ||
      amountParsed.sats < 1
    ) {
      amountError = t('pos.badAmount');
    }
  }

  useEffect(() => {
    // At 0:00 the till reads once. Not beside a read of the load effect on its way, and none of
    // the reads a payment asks for starts beside this one (`readsInFlight`), so neither cuts the other off.
    if (
      session === null ||
      busy ||
      charge === null ||
      remaining > 0 ||
      refreshed.current === charge.id ||
      inFlightFor(readsInFlight, session).count > 0
    ) {
      return;
    }
    refreshed.current = charge.id;
    const mine = generation.current;
    const seq = startRead(reads);
    const inFlight = inFlightFor(readsInFlight, session);
    inFlight.count += 1;
    const settled = (): void => {
      inFlight.count -= 1;
      setReadsSettled((n) => n + 1);
    };
    fetchPosState(session)
      .then((next) => {
        settled();
        // Another session signed in meanwhile: this answer is not its till.
        if (useAuthStore.getState().session !== session) {
          return;
        }
        whenCurrent(generation, mine, () => {
          applyRead(reads, seq, () => {
            setTill({ state: next, session });
            if (readFailed.current) {
              readFailed.current = false;
              setErrorState(null);
            }
          });
        });
      })
      .catch(() => {
        settled();
        // A newer read already answered, or another session signed in: this failure says nothing
        // about the till now.
        if (seq < reads.current.applied || useAuthStore.getState().session !== session) {
          return;
        }
        whenCurrent(generation, mine, () => {
          readFailed.current = true;
          setErrorState({ message: t('pos.error'), session });
        });
      });
  }, [busy, charge, readsSettled, remaining, session, t]);

  useEffect(() => {
    if (!loadingAlert || !rateSettled) {
      return;
    }
    setLoadingAlert(false);
    setErrorState(null);
  }, [loadingAlert, rateSettled]);

  async function onCreate(event: FormEvent): Promise<void> {
    event.preventDefault();
    /* v8 ignore next 3 -- the form shows only on this session's answered till, and is disabled while busy */
    if (session === null || busyRef.current) {
      return;
    }
    if (loadingAlert && !rateSettled) {
      return;
    }
    const parsed = parseAmountDraft(unit, amount, rateDay, fiat);
    setAmountTouched(true);
    if (unit === 'fiat' && !rateSettled && parsed.kind === 'no-rate') {
      showError(t('pos.rateLoading', { code: fiat }));
      setLoadingAlert(true);
      return;
    }
    if (parsed.kind === 'no-rate') {
      // The amount field already announces the missing rate.
      return;
    }
    if (unit === 'fiat') {
      if (parsed.kind === 'invalid') {
        return;
      }
      if (parsed.kind === 'empty' || parsed.sats < 1) {
        showError(t('wallet.sendAmountMin', { min: formatBitcoin(1) }));
        return;
      }
    }
    if (parsed.kind !== 'sats' || !Number.isInteger(parsed.sats) || parsed.sats < 1) {
      // A blank or unusable bitcoin draft is the field error, once the submit marks it touched.
      return;
    }
    const amountSats = parsed.sats;
    busyRef.current = true;
    setBusy(true);
    const mine = ++generation.current;
    showError(null);
    // While the create is on its way no charge is open: a payment that names the charge before still
    // pays it; any other is kept and tried on the new charge once it is read (it pays it if `pays`).
    // A failed create makes the charge before open again and tries the kept payments on it.
    const creating = settledFor(session);
    const before = creating.open;
    creating.open = null;
    creating.creatingAfter = before;
    // The currency figure stored with the new charge: the digits typed in a currency. Bitcoin
    // typed sends none, and none is made by converting the sats (docs/fiat-amounts.md).
    const typed =
      unit === 'fiat'
        ? { amountCurrency: fiat, amount: amount.trim().replace(',', '.').replace(/\.$/, '') }
        : undefined;
    const startedAt = Date.now();
    const work = (async (): Promise<void> => {
      // The charges that exist right before this create, read now (the amount page does not read
      // again on its own): a lost create never takes one of them for its own. When that read
      // fails, which charges existed is unknown, so a lost create takes over none.
      let known: Set<string> | null;
      // The history of that read: the new charge goes on top of it, not of an older answer.
      let freshHistory: PosCharge[] | null = null;
      let freshReceived: PosState['received'] | null = null;
      const seqBefore = startRead(reads);
      try {
        const fresh = await fetchPosState(session);
        if (
          fresh.charge !== null &&
          fresh.charge.status === 'pending' &&
          !creating.paid.has(fresh.charge.id)
        ) {
          // Another tab opened a charge meanwhile: the api would refuse this create, and that
          // charge is the till's open charge, so the till shows it (and arms it) and creates none.
          whenCurrent(generation, mine, () => {
            applyRead(reads, seqBefore, () => {
              setTill({ state: fresh, session });
            });
            setAmount('');
          });
          return;
        }
        known = new Set(tillCharges(fresh).map((row) => row.id));
        freshHistory = fresh.history;
        freshReceived = fresh.received;
      } catch {
        known = null;
      }
      try {
        const created = await createPosCharge(session, amountSats, typed);
        whenCurrent(generation, mine, () => {
          /* v8 ignore next -- the form is only shown once state.history is an array */
          const history = freshHistory ?? state?.history ?? [];
          /* v8 ignore next -- the form is only shown once state.received is an array */
          const received = freshReceived ?? state?.received ?? [];
          setTill({
            state: { charge: created, history: [created, ...history], received },
            session,
          });
          setAmount('');
        });
      } catch (err) {
        /* v8 ignore next -- createPosCharge only rejects with Error */
        const message = err instanceof Error ? err.message : '';
        const refused =
          err instanceof WalletRequiredError ||
          err instanceof CannotReceiveError ||
          POS_CREATE_REFUSALS.has(message);
        // Whether the read after a lost answer shows a newer charge (open or paid): the receiving
        // address then went to it, so a payment of this amount is not the charge before's.
        let newer = false;
        if (!refused) {
          // The answer may be lost although the charge was made (and even paid): read the till once.
          try {
            const seq = startRead(reads);
            const next = await fetchPosState(session);
            // This create's charge: the amount requested, made no earlier than 30 s before the click
            // (the api's clock may lag) and after the one before. Any other charge the read finds is
            // set as the till's answer, and the error shows.
            const found = next.charge;
            newer =
              found !== null &&
              (before === null ||
                (found.id !== before.id &&
                  Date.parse(found.createdAt) > Date.parse(before.createdAt)));
            const made =
              found !== null &&
              known !== null &&
              !known.has(found.id) &&
              found.amountSats === amountSats &&
              Date.parse(found.createdAt) >= startedAt - POS_CREATE_SKEW_MS &&
              (before === null || Date.parse(found.createdAt) > Date.parse(before.createdAt))
                ? found
                : null;
            whenCurrent(generation, mine, () => {
              applyRead(reads, seq, () => {
                setTill({ state: next, session });
              });
              if (made !== null) {
                setAmount('');
                if (made.status === 'paid') {
                  // Remember it for the till. A later read that fails, or no longer returns it,
                  // still confirms it. Not `paid`: this tab's wallet did not see the payment, so
                  // the amount page stays and can create the next charge.
                  creating.reported.set(made.id, made);
                  settledChanged();
                }
              }
            });
            if (made !== null) {
              // The charge was made: the till shows it, with the figure stored on it, and counts the
              // payments kept meanwhile. A read that already shows it paid is only the api's
              // report. This tab's wallet did not see that payment, so it is not stored as one
              // the wallet paid. The amount page can create the next charge.
              // The till confirms that read, including after this page is gone.
              return;
            }
          } catch {
            // Unknown: fall back to the charge before.
          }
        }
        if (message === 'A payment is already open') {
          // Another tab opened a charge after the read right before this create: read once, so the
          // till shows that charge and arms it for the wallet.
          try {
            const seq = startRead(reads);
            const next = await fetchPosState(session);
            whenCurrent(generation, mine, () => {
              applyRead(reads, seq, () => {
                setTill({ state: next, session });
              });
            });
          } catch {
            // The error below shows either way.
          }
        }
        // Back to the charge before, with any payment reported while the create was on its way; a
        // read applied above that no longer shows it open ends it again (the arming effect). Not
        // when that read shows a newer charge: a payment of this amount now belongs to it.
        if (!newer) {
          rearm(creating, before);
        }
        whenCurrent(generation, mine, () => {
          if (err instanceof WalletRequiredError) {
            showError(t('pos.needWallet'));
          } else if (err instanceof CannotReceiveError) {
            showError(t('pos.cannotReceive'));
          } else if (message === 'Amount is outside the wallet range') {
            showError(t('pos.outside'));
          } else if (message === 'A payment is already open') {
            showError(t('pos.already'));
          } else if (message === 'Set a username first') {
            showError(t('pos.needUsername'));
          } else {
            showError(t('pos.error'));
          }
        });
      }
    })();
    trackTillWrite(work);
    try {
      await work;
    } finally {
      creating.creatingAfter = null;
      busyRef.current = false;
      setBusy(false);
      runSkippedLoad();
    }
  }

  async function onCancel(): Promise<void> {
    /* v8 ignore next 3 -- Cancel shows only on this session's answered till, and is disabled while busy */
    if (session === null || busyRef.current) {
      return;
    }
    busyRef.current = true;
    setBusy(true);
    const mine = ++generation.current;
    showError(null);
    // The memory of the session that cancels, even if another session signs in meanwhile.
    const cancelling = settledFor(session);
    // While the cancel is on its way the charge takes no payment: one reported meanwhile is kept,
    // and pays the charge only if the cancel fails.
    // The charge on screen: the arming effect may not have armed it yet when Cancel was pressed.
    const cancelled = charge;
    cancelling.open = null;
    let wentThrough = false;
    let reconcileSeq = 0;
    const work = (async (): Promise<void> => {
      try {
        await cancelPosCharge(session);
      } catch {
        // The answer may be lost although the api cancelled: read once, and make the charge
        // payable again only while that read shows it not cancelled (still open, or run out, when a
        // payment made before its end still counts), or when that read fails too.
        let stillOpen = true;
        try {
          const seq = startRead(reads);
          const next = await fetchPosState(session);
          const row = tillCharges(next).find((candidate) => candidate.id === cancelled?.id);
          stillOpen = row !== undefined && (row.status === 'pending' || row.status === 'expired');
          whenCurrent(generation, mine, () => {
            applyRead(reads, seq, () => {
              setTill({ state: next, session });
            });
          });
        } catch {
          // Unknown: keep it payable.
        }
        if (stillOpen) {
          rearm(cancelling, cancelled);
          whenCurrent(generation, mine, () => {
            showError(t('pos.error'));
          });
        }
        return;
      }
      // The cancel went through. Drop the charge now. Reads already in flight
      // stay below the floor, so they cannot put that charge back. The floor is
      // not an answer.
      wentThrough = true;
      whenCurrent(generation, mine, () => {
        setTill((prev) =>
          /* v8 ignore next 3 -- Cancel shows only on this session's answered till */
          prev.session === session && prev.state !== null
            ? { state: withoutOpenCharge(prev.state), session }
            : prev,
        );
      });
      reconcileSeq = startRead(reads);
      reads.current.floor = reconcileSeq;
    })();
    trackTillWrite(work);
    try {
      await work;
    } finally {
      busyRef.current = false;
      setBusy(false);
      runSkippedLoad();
    }
    // The follow-up read only reconciles. It is not part of the cancel the next
    // load waits for, so a read that never returns leaves the till free.
    if (!wentThrough) {
      return;
    }
    const deliver = (apply: () => void): void => {
      // A newer read is already on screen.
      if (reads.current.applied >= reconcileSeq) {
        return;
      }
      whenCurrent(generation, mine, apply);
    };
    try {
      const next = await fetchPosState(session);
      deliver(() => {
        reads.current.applied = reconcileSeq;
        setTill({ state: next, session });
      });
    } catch {
      deliver(() => {
        // This follow-up belongs to the session that cancelled. A later session's
        // failed read does not move `applied`, so this failure must not replace
        // that session's error. The next session would otherwise keep the loader.
        if (useAuthStore.getState().session !== session) {
          return;
        }
        readFailed.current = true;
        setErrorState({ message: t('pos.error'), session });
      });
    }
  }

  return {
    address,
    qr,
    showQr,
    state,
    stateSession: till.session,
    error,
    charge,
    paid,
    paidByWallet: paid !== null && walletPaid.has(paid.id),
    history,
    received: state?.received ?? [],
    remaining,
    chargeFigure,
    paidFigure,
    amount,
    setAmount,
    shownUnit,
    setShownUnit,
    busy,
    rateDay,
    canCharge,
    amountError,
    loadingAlert,
    needsUsername,
    needsWallet,
    onCreate,
    onCancel,
    retryLoad: () => {
      showError(null);
      setReload((n) => n + 1);
    },
    closePaid: (id) => {
      settledFor(session).closed.add(id);
      settledChanged();
      showError(null);
      // Quiet only when the till already shows an answer: before the first one, a failure must show.
      quietReload.current = state !== null;
      setReload((n) => n + 1);
    },
    readAgain: () => {
      quietReload.current = state !== null;
      setReload((n) => n + 1);
    },
  };
}

/**
 * Signed-in till QR. With no charge, **Set an amount** opens `/pos/amount`.
 * With a charge, this page shows the countdown, bitcoin, the currency figure
 * stored with the charge when it was typed in a currency, and Cancel.
 * The moment this tab's wallet reports a payment that names the open charge
 * (its Spark invoice, memo `pos:<id>`) with its amount, the charge is paid,
 * and {@link PosPaidOverlay} fills the screen with **Paid**, bitcoin, and the
 * currency figure stored with the charge when there is one. A payment that
 * names no charge never pays one, whatever its amount and time: the till does
 * not know the payment hashes of the BOLT11 invoices the api handed out for
 * the charge, so a Lightning payment of the charge is confirmed when a read of
 * the api returns the charge `paid`.
 * The till reads the api on open, right before each create, on **Try again**
 * after a failed load,
 * when the session or the language changes, when a charge runs out, when the tab becomes visible again,
 * after every read of this tab's wallet (a received payment, each wallet sync, and the five-minute
 * wallet refresh; such a read fails quietly once the till shows an answer), after
 * Cancel, once after a create or cancel whose answer was lost, once after a
 * create the api refuses because a payment is already open, once after a
 * Lightning payment that names no charge, or a payment that names a charge
 * no read listed, and when the
 * confirmation is closed. While a Lightning payment that names no charge could
 * be the open charge's (its amount, made from the second the charge was
 * created to one minute after its end), it reads again `PAY_POLL_MS` after
 * each read settled, until a read shows the charge paid, cancelled or gone before its end,
 * and at most until one minute after that payment; once a read shows the
 * charge paid, it counts as paid by this tab's wallet. A paid charge
 * the api returns also opens the confirmation. A lost create the api already
 * shows paid is remembered for the session and still confirmed here when a
 * later read fails or no longer returns it; it is not a payment this tab's
 * wallet saw. Under the till, once it has
 * loaded, {@link PosHistory} lists the past charges, a charge the wallet saw
 * paid already as paid, together with the payments the api lists as received
 * without a charge. An
 * account whose wallet is not verified sees **Set up your wallet first.**
 * (to `/wallet`), or the inline setup note once the background wallet setup
 * gave up; while that setup is due or gave up, the address and its QR stay
 * hidden, because the address is not registered yet.
 *
 * @returns The point-of-sale card.
 */
export function PosTill(): ReactElement {
  const { t } = useTranslations();
  const { numberFormat } = useNumberFormat();
  const { fiat } = useFiatPreference();
  const till = usePosTillState();
  const chargeText =
    till.charge === null
      ? null
      : posFiatText(till.chargeFigure, till.charge.amountSats, till.rateDay, fiat, numberFormat);
  const setup = useWalletSetup();
  const shownPaid = till.paid;
  const paidId = till.paid?.id ?? null;
  const paidSats = till.paid?.amountSats ?? 0;
  // The session whose read showed the charge, or before any read the session the wallet memory is
  // for, so a confirmation closed before the first read is still recorded.
  const session = useAuthStore((state) => state.session);
  const paidFor = till.stateSession ?? session;
  // A payment that reached the wallet without a charge shows in History once the api lists it:
  // read the till again on every wallet read, as the /wallet payment list does.
  const syncCount = useWalletStore((state) => state.syncCount);
  const readSync = useRef(syncCount);
  // The latest till's read; only a new wallet read asks for it, not every render.
  const readAgain = useRef(till.readAgain);
  readAgain.current = till.readAgain;
  useEffect(() => {
    if (readSync.current === syncCount) {
      return;
    }
    readSync.current = syncCount;
    readAgain.current();
  }, [syncCount]);
  useEffect(() => {
    if (paidId !== null && paidFor !== null && !paidSeen.has(paidId)) {
      paidSeen.add(paidId);
      // Recorded where the paid charge shows, for the member whose till showed it.
      logInteraction('pos_charge_paid_seen', { chargeId: paidId, amountSats: paidSats }, paidFor);
    }
  }, [paidId, paidSats, paidFor]);

  return (
    <Card surface={false}>
      <h1 className="text-center text-2xl font-semibold tracking-tight text-app-fg sm:text-3xl">
        {t('pos.title')}
      </h1>
      {till.address !== null && !setup.due && !setup.failed ? (
        <div className="flex flex-col items-stretch gap-3 border-t border-app-border pt-6">
          <p className="text-center text-xs tracking-widest text-app-subtle uppercase">
            {t('profile.giftsHeading')}
          </p>
          <p className="min-w-0 truncate text-center font-mono text-sm text-app-fg">
            {till.address}
          </p>
          {till.showQr && till.qr !== null ? (
            <div className="flex justify-center">
              <QrCode value={till.qr} label={t('profile.giftsQr')} logo={profileQrLogo} />
            </div>
          ) : null}
        </div>
      ) : null}
      {till.needsUsername ? (
        <p className="text-center text-sm text-app-fg">
          <Link href="/settings#address" className="underline">
            {t('pos.needUsername')}
          </Link>
        </p>
      ) : null}
      {till.needsWallet && setup.failed ? <WalletSetupNote /> : null}
      {till.needsWallet && !setup.failed ? (
        <p className="text-center text-sm text-app-fg">
          <Link href="/wallet" className="underline">
            {t('pos.needWallet')}
          </Link>
        </p>
      ) : null}
      {till.state === null && till.error === null ? (
        <Loader2 aria-hidden="true" className="mx-auto h-8 w-8 animate-spin text-app-subtle" />
      ) : null}
      {till.charge !== null ? (
        <div className="flex flex-col items-center gap-3">
          <p className="text-center text-sm text-app-subtle">
            {t('pos.left', { time: formatLeft(till.remaining) })}
          </p>
          <p className="text-center text-2xl font-semibold tabular-nums lining-nums text-app-fg">
            {formatBitcoin(till.charge.amountSats, numberFormat)}
          </p>
          {chargeText === null ? null : (
            <p className="text-center text-sm text-app-subtle">{chargeText}</p>
          )}
          <Button
            type="button"
            variant="secondary"
            disabled={till.busy}
            onClick={() => void till.onCancel()}
          >
            {t('pos.cancel')}
          </Button>
        </div>
      ) : null}
      {shownPaid !== null ? (
        <PosPaidOverlay
          key={shownPaid.id}
          amount={formatBitcoin(shownPaid.amountSats, numberFormat)}
          fiat={posFiatText(
            till.paidFigure,
            shownPaid.amountSats,
            till.rateDay,
            fiat,
            numberFormat,
          )}
          onClose={() => {
            till.closePaid(shownPaid.id);
          }}
        />
      ) : null}
      {till.state !== null && till.charge === null && till.paid === null && till.canCharge ? (
        <ButtonLink href="/pos/amount">{t('wallet.setAmount')}</ButtonLink>
      ) : null}
      {till.error !== null ? (
        <p role="alert" className="text-center text-sm text-app-danger">
          {till.error}
        </p>
      ) : null}
      {till.state !== null ? (
        <PosHistory
          history={till.history}
          received={till.received}
          openChargeId={till.charge?.id ?? null}
        />
      ) : null}
    </Card>
  );
}

/**
 * Amount-only page. No QR and no other till actions. Confirming returns to
 * `/pos`, which then shows Cancel, the countdown, and the amount. A charge
 * this tab's wallet saw paid whose confirmation is not closed returns to
 * `/pos`, which shows it full screen; a closed one, or one only the api
 * reports paid, does not block a new one. It leaves with
 * {@link returnToView}, once: opened from `/pos`, that is a step back, so
 * `/pos` keeps its own back (the view before it, or `/welcome`).
 *
 * @returns The amount card.
 */
export function PosAmount(): ReactElement {
  const { t } = useTranslations();
  const router = useRouter();
  const till = usePosTillState();
  const account = useAuthStore((state) => state.account);
  const left = useRef(false);

  useEffect(() => {
    if (left.current) {
      return;
    }
    // A payment this tab's wallet received while the amount page is up is confirmed on the till.
    if (till.charge !== null || till.paidByWallet || (account !== null && !till.canCharge)) {
      left.current = true;
      returnToView('/pos', router);
    }
    /* next/navigation's identity is not stable */
  }, [account, till.canCharge, till.charge, till.paidByWallet]);

  return (
    <Card surface={false}>
      <h1 className="text-center text-2xl font-semibold tracking-tight text-app-fg sm:text-3xl">
        {t('pos.amount')}
      </h1>
      {till.state === null && till.error === null ? (
        <Loader2 aria-hidden="true" className="mx-auto h-8 w-8 animate-spin text-app-subtle" />
      ) : null}
      {till.state !== null && till.charge === null && !till.paidByWallet && till.canCharge ? (
        <form
          className="flex w-full flex-col gap-3"
          noValidate
          onSubmit={(event) => void till.onCreate(event)}
        >
          <AmountEntry
            keypad
            label={t('pos.amount')}
            placeholder={t('pos.amountPlaceholder')}
            value={till.amount}
            onValueChange={till.setAmount}
            onUnitChange={till.setShownUnit}
            disabled={till.busy}
            rateDay={till.rateDay}
            {...(till.amountError === null ? {} : { error: till.amountError })}
          />
          <Button
            type="submit"
            disabled={till.busy || till.amountError !== null || till.loadingAlert}
          >
            {t('pos.create')}
          </Button>
        </form>
      ) : null}
      {till.error !== null ? (
        <p role="alert" className="text-center text-sm text-app-danger">
          {till.error}
        </p>
      ) : null}
      {till.state === null && till.error !== null ? (
        <Button type="button" onClick={till.retryLoad}>
          {t('login.retry')}
        </Button>
      ) : null}
    </Card>
  );
}

/**
 * `/pos` QR page. The amount keypad lives on `/pos/amount`.
 *
 * @returns The point-of-sale card.
 */
export function PosScreen(): ReactElement {
  return <PosTill />;
}
