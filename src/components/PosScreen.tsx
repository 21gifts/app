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
import { onPaymentReceived } from '@/lib/wallet/wallet-service';
import type { AmountUnit } from '@/lib/api-types';
import { useAuthStore } from '@/stores/auth-store';
import {
  formatBitcoin,
  formatFiatDisplay,
  parseAmountDraft,
  satsToFiatAmount,
  type FiatCode,
  type FiatRateDay,
} from '@/lib/stats-money';

/**
 * Fiat under a till amount. A stored figure is shown as-is. With none, the
 * current spot stands beside the bitcoin and is not written onto the charge.
 */
function posFiatText(
  stored: { code: FiatCode; amount: string } | null,
  sats: number | null,
  rateDay: FiatRateDay | null,
  fiat: FiatCode,
  numberFormat: NumberFormatStyle,
): string | null {
  if (stored !== null) {
    return formatFiatDisplay(stored.amount, stored.code, numberFormat);
  }
  if (sats === null) {
    return null;
  }
  const spot = satsToFiatAmount(sats, rateDay, fiat);
  return spot === null ? null : formatFiatDisplay(spot, fiat, numberFormat);
}

/** Draft the till stores: trim, one comma to a dot, fraction digits kept, no trailing dot. */
function typedFiatDraft(draft: string): string {
  const dotted = draft.trim().replace(',', '.');
  if (dotted.endsWith('.')) {
    return dotted.slice(0, -1);
  }
  return dotted;
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

/** Screenshot pin: the open charge is paid the moment it shows (Playwright builds only). */
const POS_RECEIVED_VISUAL_PIN = 'pos-received';

/** The later-created of two charges, or the one that is not `null`. */
function newerCharge(a: PosCharge | null, b: PosCharge | null): PosCharge | null {
  if (a === null || b === null) {
    return a ?? b;
  }
  return Date.parse(b.createdAt) > Date.parse(a.createdAt) ? b : a;
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
 * What this tab's wallet settled for one session, shared by `/pos` and
 * `/pos/amount` so a page change keeps it: the last open charge (a payment
 * just after its end still counts), the charges the wallet saw paid before
 * the api may know it, and the paid charges whose confirmation was closed.
 */
type WalletSettled = {
  session: string | null;
  open: PosCharge | null;
  paid: Map<string, PosCharge>;
  closed: Set<string>;
  /** Payments no known open charge took (a till still reading the next one), newest last. */
  early: Array<Pick<WalletPayment, 'amountSats' | 'feesSats' | 'timestamp'>>;
  /** The currency figure fixed for each charge this tab created, by charge id. */
  figures: Map<string, PosFigure>;
};

/**
 * The currency figure of a charge: the digits the operator typed in that
 * currency when the charge was created. A charge typed in bitcoin has none.
 * Never priced from a rate (docs/fiat-amounts.md).
 */
type PosFigure = { amount: string; code: FiatCode };

/** How many payments no known open charge took are kept for the next one. */
const POS_EARLY_PAYMENTS = 20;

/** The wallet states when a payment was made in whole seconds; this much before creation counts. */
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
      closed: new Set(),
      early: [],
      figures: new Map(),
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
 * made (by the wallet's own payment time, whole seconds, so up to
 * {@link POS_PAID_TIME_GRAIN_MS} before creation) from the charge's creation
 * up to {@link POS_LATE_PAID_MS} after its end. While a charge is open
 * the receiving address takes no other amount, so the time tells a payment of
 * this charge from one of the charge before, however late the wallet reports it.
 */
function pays(
  charge: PosCharge,
  payment: Pick<WalletPayment, 'amountSats' | 'feesSats' | 'timestamp'>,
): boolean {
  return (
    (payment.amountSats === charge.amountSats ||
      payment.amountSats + payment.feesSats === charge.amountSats) &&
    payment.timestamp + POS_PAID_TIME_GRAIN_MS >= Date.parse(charge.createdAt) &&
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
function settleOpen(
  memory: WalletSettled,
  payment: Pick<WalletPayment, 'amountSats' | 'feesSats' | 'timestamp'>,
): void {
  const open = memory.open;
  if (open === null || !pays(open, payment)) {
    // Not this charge's: it may be the next one's, which the till has not read yet.
    memory.early = [
      ...memory.early,
      { amountSats: payment.amountSats, feesSats: payment.feesSats, timestamp: payment.timestamp },
    ].slice(-POS_EARLY_PAYMENTS);
    return;
  }
  memory.open = null;
  memory.paid.set(open.id, { ...open, status: 'paid', paidAt: new Date().toISOString() });
  settledChanged();
}

/** Make `charge` the open charge in `memory` and try the kept payments on it again; the rest stay kept. */
function armOpen(memory: WalletSettled, charge: PosCharge): void {
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

/** Remember `figure` as the currency figure of charge `id`, when there is one. */
function rememberFigure(memory: WalletSettled, id: string, figure: PosFigure | null): void {
  if (figure !== null) {
    memory.figures.set(id, figure);
  }
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
  chargeFiat: string | null;
  /** The currency figure fixed for `paid` when this tab created it, otherwise `null`. */
  paidFigure: PosFigure | null;
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
  const state = till.state;
  const [error, setError] = useState<string | null>(null);
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
  const [, setSettledVersion] = useState(0);
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
    if (session === null || busyRef.current) {
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
      try {
        const seq = startRead(reads);
        const next = await fetchPosState(session);
        if (!alive) {
          return;
        }
        whenCurrent(generation, mine, () => {
          applyRead(reads, seq, () => {
            setTill({ state: next, session });
          });
        });
      } catch {
        if (!alive || quiet) {
          return;
        }
        whenCurrent(generation, mine, () => {
          setError(t('pos.error'));
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
  const latest = newerCharge(serverPaid, [...walletPaid.values()].at(-1) ?? null);
  // A newer open charge hides an older paid one: its confirmation is over.
  const paid =
    latest !== null && !closed.has(latest.id) && newerCharge(charge, latest) === latest
      ? latest
      : null;
  const history =
    state === null
      ? []
      : state.history.map((row) => (row.status === 'paid' ? row : (walletPaid.get(row.id) ?? row)));
  const remaining = charge === null ? 0 : Date.parse(charge.expiresAt) - now;
  const chargeFiat = charge === null ? null : satsToFiatAmount(charge.amountSats, rateDay, fiat);
  const paidFigure = paid === null ? null : (memory.figures.get(paid.id) ?? null);
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
    if (charge !== null) {
      // A payment the wallet reported while this charge was still being read counts for it.
      armOpen(memory, charge);
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
  }, [charge, session, state, tillSession]);

  useEffect(() => {
    if (session === null) {
      return;
    }
    return onPaymentReceived((payment) => {
      settleOpen(settledFor(session), payment);
    });
  }, [session]);

  useEffect(() => {
    if (charge !== null && visualPin() === POS_RECEIVED_VISUAL_PIN) {
      settleOpen(settledFor(session), {
        amountSats: charge.amountSats,
        feesSats: 0,
        timestamp: Date.now(),
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
        whenCurrent(generation, mine, () => {
          applyRead(reads, seq, () => {
            setTill({ state: next, session });
          });
        });
      })
      .catch(() => {
        whenCurrent(generation, mine, () => {
          setError(t('pos.error'));
        });
      });
  }, [busy, charge, remaining, session, t]);

  async function onCreate(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (session === null || busyRef.current) {
      return;
    }
    const parsed = parseAmountDraft(shownUnit, amount, rateDay, fiat);
    if (parsed.kind === 'no-rate') {
      setError(t('pos.noRate', { code: fiat }));
      return;
    }
    if (shownUnit === 'fiat') {
      if (parsed.kind === 'invalid') {
        setError(t('amount.cannotConvert'));
        return;
      }
      if (parsed.kind === 'empty' || parsed.sats < 1) {
        setError(t('wallet.sendAmountMin', { min: formatBitcoin(1) }));
        return;
      }
    }
    if (parsed.kind !== 'sats' || !Number.isInteger(parsed.sats) || parsed.sats < 1) {
      setError(t('pos.badAmount'));
      return;
    }
    const amountSats = parsed.sats;
    busyRef.current = true;
    setBusy(true);
    const mine = ++generation.current;
    setError(null);
    // A new charge ends the late minute of the one before: a payment reported while it is being
    // created is kept and tried on the new charge once it is read (it pays it if `pays`). A failed
    // create gives the late minute back and tries the kept payments on the charge before.
    const creating = settledFor(session);
    const before = creating.open;
    creating.open = null;
    // The currency figure of the new charge: the digits typed in a currency. Bitcoin typed has
    // none, and none is made by converting the sats (docs/fiat-amounts.md).
    const figure =
      shownUnit === 'fiat'
        ? { amount: amount.trim().replace(',', '.').replace(/\.$/, ''), code: fiat }
        : null;
    const startedAt = Date.now();
    // The charges this till already knows: a lost create never takes one of them for its own.
    /* v8 ignore next -- the form is only shown once the till has an answer */
    const known = new Set((state === null ? [] : tillCharges(state)).map((row) => row.id));
    const work = (async (): Promise<void> => {
      try {
        const created = await createPosCharge(session, amountSats);
        rememberFigure(creating, created.id, figure);
        whenCurrent(generation, mine, () => {
          /* v8 ignore next -- the form is only shown once state.history is an array */
          const history = state?.history ?? [];
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
        if (!refused) {
          // The answer may be lost although the charge was made (and even paid): read the till once.
          try {
            const seq = startRead(reads);
            const next = await fetchPosState(session);
            // This create's charge: the amount requested, made no earlier than 30 s before the click
            // (the api's clock may lag) and after the one before. Any other charge the read finds is
            // set as the till's answer without this create's figure, and the error shows.
            const found = next.charge;
            const made =
              found !== null &&
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
              // The charge was made: the till shows it and counts the payments kept meanwhile.
              rememberFigure(creating, made.id, figure);
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
        // Back to the charge before, with any payment reported while the create was on its way.
        rearm(creating, before);
        whenCurrent(generation, mine, () => {
          if (err instanceof WalletRequiredError) {
            setError(t('pos.needWallet'));
          } else if (err instanceof CannotReceiveError) {
            setError(t('pos.cannotReceive'));
          } else if (message === 'Amount is outside the wallet range') {
            setError(t('pos.outside'));
          } else if (message === 'A payment is already open') {
            setError(t('pos.already'));
          } else if (message === 'Set a username first') {
            setError(t('pos.needUsername'));
          } else {
            setError(t('pos.error'));
          }
        });
      }
    })();
    trackTillWrite(work);
    try {
      await work;
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  async function onCancel(): Promise<void> {
    if (session === null || busyRef.current) {
      return;
    }
    busyRef.current = true;
    setBusy(true);
    const mine = ++generation.current;
    setError(null);
    // The memory of the session that cancels, even if another session signs in meanwhile.
    const cancelling = settledFor(session);
    // While the cancel is on its way the charge takes no payment: one reported meanwhile is kept,
    // and pays the charge only if the cancel fails.
    const cancelled = cancelling.open;
    cancelling.open = null;
    const work = (async (): Promise<void> => {
      try {
        await cancelPosCharge(session);
      } catch {
        // The answer may be lost although the api cancelled: read once, and make the charge
        // payable again only while it is still open (or when that read fails too).
        let stillOpen = true;
        try {
          const seq = startRead(reads);
          const next = await fetchPosState(session);
          stillOpen =
            next.charge !== null &&
            next.charge.status === 'pending' &&
            next.charge.id === cancelled?.id;
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
            setError(t('pos.error'));
          });
        }
        return;
      }
      try {
        const seq = startRead(reads);
        const next = await fetchPosState(session);
        whenCurrent(generation, mine, () => {
          applyRead(reads, seq, () => {
            setTill({ state: next, session });
          });
        });
      } catch {
        whenCurrent(generation, mine, () => {
          setError(t('pos.error'));
        });
      }
    })();
    trackTillWrite(work);
    try {
      await work;
    } finally {
      busyRef.current = false;
      setBusy(false);
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
    chargeFiat,
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
      setError(null);
      setReload((n) => n + 1);
    },
    closePaid: (id) => {
      settledFor(session).closed.add(id);
      settledChanged();
      setError(null);
      quietReload.current = true;
      setReload((n) => n + 1);
    },
  };
}

/**
 * Signed-in till QR. With no charge, **Set an amount** opens `/pos/amount`.
 * With a charge, this page shows the countdown, bitcoin, fiat, and Cancel.
 * It never asks the api on a timer: the moment this tab's wallet reports a
 * payment that pays the charge ({@link onPaymentReceived}: its amount, or
 * that amount after the fee, made from one second before its creation to a
 * minute after its end), the charge is paid, and
 * {@link PosPaidOverlay} fills the screen with **Paid**, bitcoin, and the
 * charge's fixed currency figure when this tab has one.
 * The till reads the api only on open, when the session or the language
 * changes, when a charge runs out, when the tab becomes visible again, after
 * Cancel, once after a create or cancel whose answer was lost, and when the
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
  const chargeText = posFiatText(
    till.chargeFiat,
    till.charge?.amountSats ?? null,
    till.rateDay,
    fiat,
    numberFormat,
  );
  const paidText = posFiatText(
    till.paidFiat,
    till.paid?.amountSats ?? null,
    till.rateDay,
    fiat,
    numberFormat,
  );

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
          amount={formatBitcoin(shownPaid.amountSats, numberFormat)}
          fiat={
            till.paidFigure === null
              ? null
              : formatFiatDisplay(till.paidFigure.amount, till.paidFigure.code, numberFormat)
          }
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
          openChargeId={till.charge?.id ?? null}
          rateDay={till.rateDay}
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
