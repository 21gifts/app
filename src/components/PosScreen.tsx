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
import { useSpotRate } from '@/hooks/useSpotRate';
import { useWalletSetup } from '@/hooks/useWalletSetup';
import { giftsLightningAddress, openCryptoPayQrValue } from '@/lib/gifts-address';
import { logInteraction } from '@/lib/interaction-log';
import { CannotReceiveError, WalletRequiredError } from '@/lib/api';
import { committedFiatFigure, type FiatCode } from '@/lib/committed-fiat';
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
  parseAmountDraft,
  satsToFiatAmount,
  type FiatRateDay,
} from '@/lib/stats-money';
import { useAuthStore } from '@/stores/auth-store';

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
    return formatFiatDisplay(stored.amount, stored.code, numberFormat);
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
 * How long past its end a charge still counts as paid by a payment the
 * wallet receives. The api still marks a charge paid when the payment is
 * confirmed after it ran out.
 */
const POS_LATE_PAID_MS = 60_000;

/** Screenshot pin: the wallet reports the open charge paid the moment it shows (Playwright builds only). */
const POS_RECEIVED_VISUAL_PIN = 'pos-received';

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
    charge: null,
    history: [
      { ...open, status: 'cancelled' },
      ...state.history.filter((row) => row.id !== open.id),
    ],
  };
}

/** Till reads started and the newest one whose answer is on screen. */
type TillReads = { started: number; applied: number };

/** Number the next till read. */
function startRead(reads: { current: TillReads }): number {
  reads.current.started += 1;
  return reads.current.started;
}

/**
 * Apply the answer of read `seq` only when no newer read is already on
 * screen, so a slow refresh cannot replace a newer answer (such as a paid
 * charge) with an older one.
 */
function applyRead(reads: { current: TillReads }, seq: number, apply: () => void): void {
  if (seq > reads.current.applied) {
    reads.current.applied = seq;
    apply();
  }
}

/** Create or cancel that is still talking to the server, across page changes. */
let tillWrite: Promise<void> | null = null;

/** Paid charges already recorded as seen in this tab, so each is recorded once. */
const paidSeen = new Set<string>();

/**
 * A wallet payment as the till weighs it: its amount, fee and payment time,
 * and, for a payment of the api's Spark invoice of a charge (memo
 * `pos:<id>`, read by the wallet as `info.chargeId`), the id of that charge.
 */
type TillPayment = Pick<WalletPayment, 'amountSats' | 'feesSats' | 'timestamp'> & {
  chargeId?: string;
};

/**
 * What this tab's wallet settled for one session, shared by `/pos` and
 * `/pos/amount` so a page change keeps it: the last open charge (a payment
 * just after its end still counts), the charges the wallet saw paid before
 * the api may know it, and the paid charges whose confirmation was closed.
 */
type WalletSettled = {
  session: string | null;
  open: PosCharge | null;
  paid: Map<string, PosCharge>;
  /**
   * Payments that pay the open charge only in its late minute, each with that
   * charge, held until a read says whether a newer charge (another tab's) took it.
   */
  late: Array<{
    payment: TillPayment;
    charge: PosCharge;
  }>;
  /** The wallet payment that paid each charge in `paid`, so a later read can give it to its charge. */
  paidBy: Map<string, TillPayment>;
  closed: Set<string>;
  /** Payments no known open charge took (a till still reading the next one), newest last. */
  early: Array<TillPayment>;
  /**
   * A payment that names no charge paid the open charge on its amount and time
   * alone: one read checks whether another device's newer charge took it.
   */
  recheck: boolean;
  /**
   * The charge before a create that is on its way: a payment that pays it is
   * held like a late-minute one, so the read after the create gives it to the
   * new charge or to this one.
   */
  creatingAfter: PosCharge | null;
};

/** How many payments no known open charge took are kept for the next one. */
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
      late: [],
      paidBy: new Map(),
      closed: new Set(),
      early: [],
      recheck: false,
      creatingAfter: null,
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

/**
 * Whether `payment` pays `charge`: its amount, or its amount after the fee,
 * made (by the wallet's own payment time, compared in whole seconds,
 * {@link POS_PAID_TIME_GRAIN_MS}) from the second of the charge's creation
 * up to {@link POS_LATE_PAID_MS} after its end. While a charge is open
 * the receiving address takes no other amount, so the time tells a payment of
 * this charge from one of the charge before, however late the wallet reports it.
 */
function pays(charge: PosCharge, payment: TillPayment): boolean {
  // A payment that names its charge pays that charge and no other.
  if (payment.chargeId !== undefined) {
    return payment.chargeId === charge.id;
  }
  return (
    (payment.amountSats === charge.amountSats ||
      payment.amountSats + payment.feesSats === charge.amountSats) &&
    Math.floor(payment.timestamp / POS_PAID_TIME_GRAIN_MS) >=
      Math.floor(Date.parse(charge.createdAt) / POS_PAID_TIME_GRAIN_MS) &&
    payment.timestamp <= Date.parse(charge.expiresAt) + POS_LATE_PAID_MS
  );
}

/**
 * The open charge in `memory` is paid the moment this tab's wallet reports a
 * payment that {@link pays} it. No reading of the api in between. A payment
 * the known open charge does not take (the till is still reading the next
 * one) is kept and tried again once the next open charge is known. Works on
 * the memory it is given, so a session that ended meanwhile never touches the
 * memory of the next one.
 */
function settleOpen(memory: WalletSettled, payment: TillPayment): void {
  const open = memory.open;
  const before = memory.creatingAfter;
  if (open === null && before !== null && pays(before, payment)) {
    if (payment.chargeId !== undefined) {
      // It names the charge before: that charge, at once.
      markPaid(memory, before, payment);
      return;
    }
    // The charge before's, or the new one's, which only a read after the create tells.
    memory.late = [...memory.late, { payment, charge: before }];
    settledChanged();
    return;
  }
  if (open === null || !pays(open, payment)) {
    // Not this charge's: it may be the next one's, which the till has not read yet.
    memory.early = [...memory.early, payment].slice(-POS_EARLY_PAYMENTS);
    if (payment.chargeId !== undefined) {
      // It may name a charge the till already read (`settleNamed`).
      settledChanged();
    }
    return;
  }
  if (payment.chargeId === undefined && payment.timestamp > Date.parse(open.expiresAt)) {
    // Made in the late minute: another tab may have made a newer charge of this amount that took
    // the receiving address, which only the api knows. Held until the till has read it.
    memory.late = [...memory.late, { payment, charge: open }];
    settledChanged();
    return;
  }
  if (payment.chargeId === undefined) {
    memory.recheck = true;
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
  memory.paidBy.set(charge.id, payment);
  settledChanged();
}

/**
 * Settles the held late-minute payments, in the order the wallet reported
 * them, once the till has read after them: a newer charge that `state` shows,
 * that {@link pays} a payment and that no payment took yet, takes it (nothing
 * to confirm here when the api already shows that charge finished);
 * otherwise, and when the read failed (`state` is `null`), the charge it was
 * held for does, unless an earlier payment already paid that charge, when it
 * is kept like any payment no known charge took.
 */
function resolveLate(memory: WalletSettled, state: PosState | null): void {
  const held = memory.late;
  memory.late = [];
  const taken = new Set<string>();
  for (const { payment, charge } of held) {
    const newer =
      state === null
        ? undefined
        : tillCharges(state).find(
            (row) =>
              row.id !== charge.id &&
              !taken.has(row.id) &&
              !memory.paid.has(row.id) &&
              Date.parse(row.createdAt) > Date.parse(charge.createdAt) &&
              pays(row, payment),
          );
    if (newer !== undefined) {
      taken.add(newer.id);
      // The wallet saw the money arrive: paid here even when another tab cancelled it meanwhile.
      if (newer.status !== 'paid') {
        markPaid(memory, newer, payment);
      }
      continue;
    }
    if (!memory.paid.has(charge.id)) {
      markPaid(memory, charge, payment);
      continue;
    }
    memory.early = [...memory.early, payment].slice(-POS_EARLY_PAYMENTS);
  }
  settledChanged();
}

/**
 * A payment the wallet gave to a charge in its late minute belongs to a newer
 * charge the till did not know yet (another tab made it, and the receiving
 * address went to it) when `state` shows one that {@link pays} it too: move
 * the payment there, or drop it from the older charge when the api already
 * shows the newer one finished.
 */
function reassignPaid(memory: WalletSettled, state: PosState): void {
  let moved = false;
  for (const [id, payment] of [...memory.paidBy]) {
    const older = memory.paid.get(id);
    /* v8 ignore next 3 -- paid and paidBy are set together */
    if (older === undefined) {
      continue;
    }
    // Not a charge another payment already paid: one payment pays one charge.
    const newer = tillCharges(state).find(
      (row) =>
        row.id !== id &&
        !memory.paid.has(row.id) &&
        Date.parse(row.createdAt) > Date.parse(older.createdAt) &&
        pays(row, payment),
    );
    if (newer === undefined) {
      continue;
    }
    memory.paid.delete(id);
    memory.paidBy.delete(id);
    if (newer.status !== 'paid') {
      memory.paid.set(newer.id, {
        ...newer,
        status: 'paid',
        paidAt: new Date(payment.timestamp).toISOString(),
      });
      memory.paidBy.set(newer.id, payment);
    }
    moved = true;
  }
  if (moved) {
    settledChanged();
  }
}

/**
 * A kept payment that names a charge `state` lists, other than the charge on
 * screen, pays that charge at once, however long ago it ran out (the payment
 * names it, like {@link pays}); a paid or cancelled charge takes none. The charge on screen
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
              row.id === payment.chargeId &&
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
    // One this charge does not take stays kept: `pays` never lets it pay a charge made after it.
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
 * settled, left behind by a test. Production clears the write when the
 * request settles.
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
    if (session !== null) {
      const { chargeId } = payment.info;
      settleOpen(
        settledFor(session),
        chargeId === undefined
          ? {
              amountSats: payment.amountSats,
              feesSats: payment.feesSats,
              timestamp: payment.timestamp,
            }
          : {
              amountSats: payment.amountSats,
              feesSats: payment.feesSats,
              timestamp: payment.timestamp,
              chargeId,
            },
      );
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
  needsUsername: boolean;
  needsWallet: boolean;
  onCreate: (event: FormEvent) => Promise<void>;
  onCancel: () => Promise<void>;
  retryLoad: () => void;
  /** Closes the paid confirmation of charge `id` and reads the till again. */
  closePaid: (id: string) => void;
};

/** Shared till state for the QR page and the amount page. */
function usePosTillState(): PosTillState {
  const { t } = useTranslations();
  const { fiat } = useFiatPreference();
  const refreshed = useRef<string | null>(null);
  const generation = useRef(0);
  const reads = useRef<TillReads>({ started: 0, applied: 0 });
  const account = useAuthStore((state) => state.account);
  const session = useAuthStore((state) => state.session);
  const rateDay = useSpotRate(session !== null);
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
  const memory = settledFor(session);
  const lateHeld = memory.late.length > 0;
  // The read asked for by a held late-minute payment: it settles once a read from then on answers.
  const lateRead = useRef<number | null>(null);
  useEffect(() => {
    // A read of the session before never answers for this session's late-minute payments.
    lateRead.current = null;
  }, [session]);
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
    void (async (): Promise<void> => {
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
        let applied = false;
        whenCurrent(generation, mine, () => {
          applyRead(reads, seq, () => {
            applied = true;
            setTill({ state: next, session });
            // The till answered: an earlier failed read no longer holds.
            if (readFailed.current) {
              readFailed.current = false;
              setErrorState(null);
            }
          });
        });
        // A create or cancel overtook this read: its answer still says which charge a held
        // late-minute payment paid.
        if (!applied && lateRead.current !== null && seq >= lateRead.current) {
          lateRead.current = null;
          const memory = settledFor(session);
          reassignPaid(memory, next);
          resolveLate(memory, next);
        }
      } catch {
        // Without the read, a held late-minute payment goes to the open charge it paid.
        if (alive && lateRead.current !== null && seq >= lateRead.current) {
          lateRead.current = null;
          resolveLate(settledFor(session), null);
        }
        // A newer read already answered, so this failure says nothing about the till now.
        if (!alive || quiet || seq < reads.current.applied) {
          return;
        }
        whenCurrent(generation, mine, () => {
          readFailed.current = true;
          setErrorState({ message: t('pos.error'), session });
        });
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
  // next one shows, so two payments settled at once both confirm.
  const latest = [serverPaid, ...walletPaid.values()].reduce<PosCharge | null>(
    (newest, row) => (row === null || closed.has(row.id) ? newest : newerCharge(newest, row)),
    null,
  );
  // A newer open charge hides an older paid one: its confirmation is over.
  const paid = latest !== null && newerCharge(charge, latest) === latest ? latest : null;
  // Every confirmation a newer open charge hides, not only the newest: none comes back after it.
  const hiddenPaidIds =
    charge === null
      ? ''
      : [serverPaid, ...walletPaid.values()]
          .filter(
            (row): row is PosCharge =>
              row !== null && !closed.has(row.id) && newerCharge(charge, row) === charge,
          )
          .map((row) => row.id)
          .join(' ');
  const history =
    state === null
      ? []
      : state.history.map((row) => (row.status === 'paid' ? row : (walletPaid.get(row.id) ?? row)));
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
      reassignPaid(memory, state);
      if (
        memory.late.length > 0 &&
        lateRead.current !== null &&
        reads.current.applied >= lateRead.current
      ) {
        lateRead.current = null;
        resolveLate(memory, state);
      }
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
      // payment just after its end still counts.
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
    // A held late-minute payment asks the api once (not on a timer) which charge it paid.
    // Read the memory now: the arming effect of this same commit may just have settled it.
    if (
      lateHeld &&
      session !== null &&
      lateRead.current === null &&
      settledFor(session).late.length > 0
    ) {
      lateRead.current = reads.current.started + 1;
      quietReload.current = state !== null;
      setReload((n) => n + 1);
    }
  }, [lateHeld, session, state]);

  useEffect(() => {
    // Paid at once on its amount and time alone: one read (not on a timer) shows whether another
    // device cancelled that charge and made a newer one of that amount, which then takes it.
    const settled = settledFor(session);
    if (session !== null && settled.recheck) {
      settled.recheck = false;
      quietReload.current = state !== null;
      setReload((n) => n + 1);
    }
  }, [session, settledVersion, state]);

  useEffect(() => {
    // A confirmation a newer open charge hid is over: it does not come back once that charge ends.
    for (const id of hiddenPaidIds.split(' ')) {
      if (id !== '') {
        settledFor(session).closed.add(id);
      }
    }
  }, [hiddenPaidIds, session]);

  useEffect(() => {
    if (charge !== null && visualPin() === POS_RECEIVED_VISUAL_PIN) {
      // Through the wallet listener, as if this tab's wallet had received the charge amount.
      announceReceivedForE2e({
        id: `pos-received-${charge.id}`,
        direction: 'received',
        amountSats: charge.amountSats,
        feesSats: 0,
        timestamp: Date.now(),
        status: 'completed',
        method: 'spark',
        senderComment: null,
        info: {},
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

  useEffect(() => {
    if (
      session === null ||
      busy ||
      charge === null ||
      remaining > 0 ||
      refreshed.current === charge.id
    ) {
      return;
    }
    refreshed.current = charge.id;
    const mine = generation.current;
    const seq = startRead(reads);
    fetchPosState(session)
      .then((next) => {
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
  }, [busy, charge, remaining, session, t]);

  async function onCreate(event: FormEvent): Promise<void> {
    event.preventDefault();
    /* v8 ignore next 3 -- the form shows only on this session's answered till, and is disabled while busy */
    if (session === null || busyRef.current) {
      return;
    }
    const parsed = parseAmountDraft(shownUnit, amount, rateDay, fiat);
    if (parsed.kind === 'no-rate') {
      showError(t('pos.noRate', { code: fiat }));
      return;
    }
    if (shownUnit === 'fiat') {
      if (parsed.kind === 'invalid') {
        showError(t('amount.cannotConvert'));
        return;
      }
      if (parsed.kind === 'empty' || parsed.sats < 1) {
        showError(t('wallet.sendAmountMin', { min: formatBitcoin(1) }));
        return;
      }
    }
    if (parsed.kind !== 'sats' || !Number.isInteger(parsed.sats) || parsed.sats < 1) {
      showError(t('pos.badAmount'));
      return;
    }
    const amountSats = parsed.sats;
    busyRef.current = true;
    setBusy(true);
    const mine = ++generation.current;
    showError(null);
    // While the create is on its way the charge before takes no payment at once: one that pays it
    // is held until a read after the create shows whether the new charge took it; any other is kept
    // and tried on the new charge once it is read (it pays it if `pays`). A failed create gives the
    // late minute back and tries the kept payments on the charge before.
    const creating = settledFor(session);
    const before = creating.open;
    creating.open = null;
    creating.creatingAfter = before;
    // The currency figure stored with the new charge: the digits typed in a currency. Bitcoin
    // typed sends none, and none is made by converting the sats (docs/fiat-amounts.md).
    const typed =
      shownUnit === 'fiat'
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
      } catch {
        known = null;
      }
      try {
        const created = await createPosCharge(session, amountSats, typed);
        whenCurrent(generation, mine, () => {
          /* v8 ignore next -- the form is only shown once state.history is an array */
          const history = freshHistory ?? state?.history ?? [];
          setTill({ state: { charge: created, history: [created, ...history] }, session });
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
              }
            });
            if (made !== null) {
              // The charge was made: the till shows it, with the figure stored on it, and counts the
              // payments kept meanwhile.
              if (made.status === 'paid') {
                // Already paid while the answer was lost: confirm it like a payment the wallet saw.
                creating.paid.set(made.id, made);
                settledChanged();
              }
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
      const seq = startRead(reads);
      try {
        const next = await fetchPosState(session);
        whenCurrent(generation, mine, () => {
          applyRead(reads, seq, () => {
            setTill({ state: next, session });
          });
        });
      } catch {
        whenCurrent(generation, mine, () => {
          // The api cancelled: without its answer the till still drops the charge it showed.
          applyRead(reads, seq, () => {
            setTill((prev) =>
              /* v8 ignore next 3 -- Cancel shows only on this session's answered till */
              prev.session === session && prev.state !== null
                ? { state: withoutOpenCharge(prev.state), session }
                : prev,
            );
          });
          readFailed.current = true;
          setErrorState({ message: t('pos.error'), session });
        });
      }
    })();
    trackTillWrite(work);
    try {
      await work;
    } finally {
      busyRef.current = false;
      setBusy(false);
      runSkippedLoad();
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
  };
}

/**
 * Signed-in till QR. With no charge, **Set an amount** opens `/pos/amount`.
 * With a charge, this page shows the countdown, bitcoin, the currency figure
 * stored with the charge when it was typed in a currency, and Cancel.
 * It never asks the api on a timer: the moment this tab's wallet reports a
 * payment that pays the charge ({@link onPaymentReceived}: its amount, or
 * that amount after the fee, made from the second of its creation to its
 * end; one made in the minute after its end is held until one read of the
 * api shows which charge it paid), the charge is paid, and
 * {@link PosPaidOverlay} fills the screen with **Paid**, bitcoin, and the
 * currency figure stored with the charge when there is one.
 * The till reads the api only on open, right before each create, on **Try again**
 * after a failed load,
 * when the session or the language changes, when a charge runs out, when the tab becomes visible again, after
 * Cancel, once after a create or cancel whose answer was lost, once when a
 * payment pays the open charge only in its late minute, once after a
 * payment that names no charge pays the open charge (whether another
 * device's newer charge of that amount took it), and when the
 * confirmation is closed. A paid charge
 * the api returns also opens the confirmation. Under the till, once it has
 * loaded, {@link PosHistory} lists the past charges, a charge the wallet saw
 * paid already as paid. An
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
        <PosHistory history={till.history} openChargeId={till.charge?.id ?? null} />
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
          />
          <Button type="submit" disabled={till.busy}>
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
