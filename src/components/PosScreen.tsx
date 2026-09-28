'use client';

import { Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type FormEvent, type ReactElement } from 'react';
import { AmountEntry } from '@/components/AmountEntry';
import { useFiatPreference } from '@/components/FiatPreferenceProvider';
import { useTranslations } from '@/components/LocaleProvider';
import { useNumberFormat } from '@/components/NumberFormatProvider';
import { QrCode } from '@/components/QrCode';
import { Button, ButtonLink, Card } from '@/components/ui';
import { useLatestRateDay } from '@/hooks/useLatestRateDay';
import { giftsLightningAddress, openCryptoPayQrValue } from '@/lib/gifts-address';
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
  remaining: number;
  chargeFiat: string | null;
  amount: string;
  setAmount: (value: string) => void;
  shownUnit: AmountUnit;
  setShownUnit: (value: AmountUnit) => void;
  busy: boolean;
  rateDay: FiatRateDay | null;
  canCharge: boolean;
  needsUsername: boolean;
  needsAddress: boolean;
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
  const account = useAuthStore((state) => state.account);
  const session = useAuthStore((state) => state.session);
  const rateDay = useLatestRateDay(session !== null);
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
        const next = await fetchPosState(session);
        if (!alive) {
          return;
        }
        whenCurrent(generation, mine, () => {
          setState(next);
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

  useEffect(() => {
    if (state?.charge === null || state?.charge === undefined) {
      return;
    }
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => {
      clearInterval(timer);
    };
  }, [state?.charge]);

  const username = account?.username ?? null;
  /* v8 ignore next -- this client screen always runs in a browser */
  const host = typeof window === 'undefined' ? '21.gifts' : window.location.hostname;
  const address = giftsLightningAddress(username, host);
  const qr = openCryptoPayQrValue(username, host);
  const charge = state?.charge ?? null;
  const remaining = charge === null ? 0 : Date.parse(charge.expiresAt) - now;
  const chargeFiat = charge === null ? null : satsToFiatAmount(charge.amountSats, rateDay, fiat);
  const needsUsername = account !== null && (account.username ?? '') === '';
  const needsAddress =
    account !== null &&
    (account.username ?? '') !== '' &&
    (account.lightningAddress ?? '').trim() === '';
  const canCharge =
    (account?.username ?? '') !== '' && (account?.lightningAddress ?? '').trim() !== '';

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
    fetchPosState(session)
      .then((next) => {
        whenCurrent(generation, mine, () => {
          setState(next);
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
          if (message === 'Amount is outside the wallet range') {
            setError(t('pos.outside'));
          } else if (message === 'A payment is already open') {
            setError(t('pos.already'));
          } else if (message === 'Set a username first') {
            setError(t('pos.needUsername'));
          } else if (message === 'Set a Wallet of Satoshi address first') {
            setError(t('pos.needAddress'));
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
        const next = await fetchPosState(session);
        whenCurrent(generation, mine, () => {
          setState(next);
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
    remaining,
    chargeFiat,
    amount,
    setAmount,
    shownUnit,
    setShownUnit,
    busy,
    rateDay,
    canCharge,
    needsUsername,
    needsAddress,
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
 * With a charge, this page shows the countdown, bitcoin, fiat, and Cancel.
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
      {till.needsAddress ? (
        <p className="text-center text-sm text-app-fg">
          <Link href="/profile" className="underline">
            {t('pos.needAddress')}
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
      {till.state !== null && till.charge === null && till.canCharge ? (
        <ButtonLink href="/pos/amount">{t('wallet.setAmount')}</ButtonLink>
      ) : null}
      {till.error !== null ? (
        <p role="alert" className="text-center text-sm text-app-danger">
          {till.error}
        </p>
      ) : null}
    </Card>
  );
}

/**
 * Amount-only page. No QR and no other till actions. Confirming returns to
 * `/pos`, which then shows Cancel, the countdown, and the amount.
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
