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
import { QrCode } from '@/components/QrCode';
import { Button, ButtonLink, Card } from '@/components/ui';
import { useSpotRate } from '@/hooks/useSpotRate';
import { giftsLightningAddress, openCryptoPayQrValue } from '@/lib/gifts-address';
import { CannotReceiveError, WalletRequiredError } from '@/lib/api';
import { cancelPosCharge, createPosCharge, fetchPosState, type PosState } from '@/lib/pos';
import { profileQrLogo } from '@/lib/profile-qr-logo';
import type { AmountUnit } from '@/lib/api-types';
import {
  formatBitcoin,
  formatFiatDisplay,
  parseAmountDraft,
  satsToFiatAmount,
  type FiatRateDay,
} from '@/lib/stats-money';
import { useAuthStore } from '@/stores/auth-store';

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

/** How often the till asks whether an open charge is paid. */
const POS_POLL_MS = 3_000;

/**
 * How long past its end the till keeps asking about a charge. The api still
 * marks a charge paid when the payment is confirmed after it ran out, and
 * shows a paid charge for one minute.
 */
const POS_LATE_PAID_MS = 60_000;

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

/**
 * Drop a till write left behind by a test. Production clears it when the
 * request settles.
 */
export function resetPosTillWriteForTests(): void {
  tillWrite = null;
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
  error: string | null;
  charge: PosState['charge'];
  paid: PosState['charge'];
  remaining: number;
  chargeFiat: string | null;
  paidFiat: string | null;
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
  const [state, setState] = useState<PosState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [shownUnit, setShownUnit] = useState<AmountUnit>(account?.amountUnit ?? 'btc');
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  busyRef.current = busy;
  const [now, setNow] = useState(() => Date.now());
  const [showQr, setShowQr] = useState(false);
  const [reload, setReload] = useState(0);
  const [watchUntil, setWatchUntil] = useState<number | null>(null);

  useEffect(() => {
    setShowQr(true);
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
            setState(next);
          });
        });
      } catch {
        if (!alive) {
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
  const charge = shown !== null && shown.status === 'pending' ? shown : null;
  const paid = shown !== null && shown.status === 'paid' ? shown : null;
  const remaining = charge === null ? 0 : Date.parse(charge.expiresAt) - now;
  const chargeFiat = charge === null ? null : satsToFiatAmount(charge.amountSats, rateDay, fiat);
  const paidFiat = paid === null ? null : satsToFiatAmount(paid.amountSats, rateDay, fiat);
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

  const chargeEnd = charge === null ? null : Date.parse(charge.expiresAt);
  useEffect(() => {
    if (chargeEnd !== null) {
      setWatchUntil(chargeEnd + POS_LATE_PAID_MS);
    }
  }, [chargeEnd]);

  useEffect(() => {
    if (paid !== null) {
      setWatchUntil(null);
    }
  }, [paid]);

  useEffect(() => {
    // While a charge is open, and for a minute after it ran out, ask the api
    // every few seconds whether it is paid.
    if (session === null || busy || watchUntil === null) {
      return;
    }
    let alive = true;
    const timer = setInterval(() => {
      if (Date.now() > watchUntil) {
        clearInterval(timer);
        setWatchUntil(null);
        return;
      }
      const mine = generation.current;
      const seq = startRead(reads);
      fetchPosState(session).then(
        (next) => {
          if (alive) {
            whenCurrent(generation, mine, () => {
              applyRead(reads, seq, () => {
                setState(next);
              });
            });
          }
        },
        () => {
          // The next poll, or the refresh at expiry, tries again.
        },
      );
    }, POS_POLL_MS);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [busy, session, watchUntil]);

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
            setState(next);
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
    if (shownUnit === 'fiat' && parsed.kind === 'invalid') {
      setError(t('amount.cannotConvert'));
      return;
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
    const work = (async (): Promise<void> => {
      try {
        const created = await createPosCharge(session, amountSats);
        whenCurrent(generation, mine, () => {
          /* v8 ignore next -- the form is only shown once state.history is an array */
          const history = state?.history ?? [];
          setState({ charge: created, history: [created, ...history] });
          setAmount('');
        });
      } catch (err) {
        whenCurrent(generation, mine, () => {
          /* v8 ignore next -- createPosCharge only rejects with Error */
          const message = err instanceof Error ? err.message : t('pos.error');
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
    const work = (async (): Promise<void> => {
      try {
        await cancelPosCharge(session);
        const seq = startRead(reads);
        const next = await fetchPosState(session);
        whenCurrent(generation, mine, () => {
          setWatchUntil(null);
          applyRead(reads, seq, () => {
            setState(next);
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
    error,
    charge,
    paid,
    remaining,
    chargeFiat,
    paidFiat,
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
  };
}

/**
 * Signed-in till QR. With no charge, **Set an amount** opens `/pos/amount`.
 * With a charge, this page shows the countdown, bitcoin, fiat, and Cancel,
 * and asks every few seconds whether it is paid. A paid charge shows
 * **Paid ✓**, bitcoin, fiat, and **New payment** (to `/pos/amount`). Under
 * that, once the till has loaded, {@link PosHistory} lists the past charges
 * from the same answer, so the list changes whenever the till reloads.
 *
 * @returns The point-of-sale card.
 */
export function PosTill(): ReactElement {
  const { t } = useTranslations();
  const { numberFormat } = useNumberFormat();
  const { fiat } = useFiatPreference();
  const till = usePosTillState();

  return (
    <Card surface={false}>
      <h1 className="text-center text-2xl font-semibold tracking-tight text-app-fg sm:text-3xl">
        {t('pos.title')}
      </h1>
      {till.address !== null ? (
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
          <Link href="/profile" className="underline">
            {t('pos.needUsername')}
          </Link>
        </p>
      ) : null}
      {till.needsWallet ? (
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
          {till.chargeFiat === null ? null : (
            <p className="text-center text-sm text-app-subtle">
              {formatFiatDisplay(till.chargeFiat, fiat, numberFormat)}
            </p>
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
      {till.paid !== null ? (
        <div className="flex flex-col items-center gap-3">
          <p role="status" className="text-center text-lg font-semibold text-app-success">
            {t('pos.paid')}
          </p>
          <p className="text-center text-2xl font-semibold tabular-nums lining-nums text-app-fg">
            {formatBitcoin(till.paid.amountSats, numberFormat)}
          </p>
          {till.paidFiat === null ? null : (
            <p className="text-center text-sm text-app-subtle">
              {formatFiatDisplay(till.paidFiat, fiat, numberFormat)}
            </p>
          )}
          <ButtonLink href="/pos/amount">{t('pos.newPayment')}</ButtonLink>
        </div>
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
          history={till.state.history}
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
 * that is already paid does not block a new one.
 *
 * @returns The amount card.
 */
export function PosAmount(): ReactElement {
  const { t } = useTranslations();
  const router = useRouter();
  const till = usePosTillState();
  const account = useAuthStore((state) => state.account);

  useEffect(() => {
    if (till.charge !== null || (account !== null && !till.canCharge)) {
      router.replace('/pos');
    }
    /* next/navigation's identity is not stable */
  }, [account, till.canCharge, till.charge]);

  return (
    <Card surface={false}>
      <h1 className="text-center text-2xl font-semibold tracking-tight text-app-fg sm:text-3xl">
        {t('pos.amount')}
      </h1>
      {till.state === null && till.error === null ? (
        <Loader2 aria-hidden="true" className="mx-auto h-8 w-8 animate-spin text-app-subtle" />
      ) : null}
      {till.state !== null && till.charge === null && till.canCharge ? (
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
