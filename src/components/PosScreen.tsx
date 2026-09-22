'use client';

import { Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState, type FormEvent, type ReactElement } from 'react';
import { useTranslations } from '@/components/LocaleProvider';
import { QrCode } from '@/components/QrCode';
import { Button, Card, Field } from '@/components/ui';
import { giftsLightningAddress, openCryptoPayQrValue } from '@/lib/gifts-address';
import {
  cancelPosCharge,
  createPosCharge,
  fetchPosState,
  type PosCharge,
  type PosState,
} from '@/lib/pos';
import { profileQrLogo } from '@/lib/profile-qr-logo';
import { isSmartphoneUserAgent } from '@/lib/wos-deep-link';
import { useAuthStore } from '@/stores/auth-store';

/** Remaining time as m:ss. */
function formatLeft(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * Signed-in till: set one sat amount, then the existing Open CryptoPay QR
 * accepts only that amount until it is cancelled or the five minutes end.
 *
 * @returns The point-of-sale card.
 */
export function PosScreen(): ReactElement {
  const { t } = useTranslations();
  const refreshed = useRef<string | null>(null);
  const account = useAuthStore((state) => state.account);
  const session = useAuthStore((state) => state.session);
  const [state, setState] = useState<PosState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [showQr, setShowQr] = useState(false);

  useEffect(() => {
    setShowQr(!isSmartphoneUserAgent(navigator.userAgent));
  }, []);

  useEffect(() => {
    if (session === null) {
      return;
    }
    let cancelled = false;
    fetchPosState(session)
      .then((next) => {
        if (!cancelled) {
          setState(next);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError(t('pos.error'));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [session, t]);

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

  useEffect(() => {
    if (session === null || charge === null || remaining > 0 || refreshed.current === charge.id) {
      return;
    }
    refreshed.current = charge.id;
    fetchPosState(session)
      .then(setState)
      .catch(() => {
        setError(t('pos.error'));
      });
  }, [charge, remaining, session, t]);

  async function onCreate(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (session === null) {
      return;
    }
    const amountSats = Number(amount);
    if (!Number.isInteger(amountSats) || amountSats < 1) {
      setError(t('pos.badAmount'));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const created = await createPosCharge(session, amountSats);
      /* v8 ignore next -- the form is only shown once state.history is an array */
      const history = state?.history ?? [];
      setState({ charge: created, history: [created, ...history] });
      setAmount('');
    } catch (err) {
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
    } finally {
      setBusy(false);
    }
  }

  async function onCancel(): Promise<void> {
    if (session === null) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await cancelPosCharge(session);
      const next = await fetchPosState(session);
      setState(next);
    } catch {
      setError(t('pos.error'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="mx-auto flex w-full max-w-sm flex-col gap-6">
      <h1 className="text-center text-2xl font-semibold text-app-fg">{t('pos.title')}</h1>
      {address !== null ? (
        <div className="flex flex-col items-stretch gap-3 border-t border-app-border pt-6">
          <p className="text-center text-xs tracking-widest text-app-subtle uppercase">
            {t('profile.giftsHeading')}
          </p>
          <p className="min-w-0 truncate font-mono text-sm text-app-fg">{address}</p>
          {showQr && qr !== null ? (
            <div className="flex justify-center">
              <QrCode value={qr} label={t('profile.giftsQr')} logo={profileQrLogo} />
            </div>
          ) : null}
        </div>
      ) : null}
      {account !== null && (account.username ?? '') === '' ? (
        <p className="text-center text-sm text-app-fg">
          <Link href="/profile" className="underline">
            {t('pos.needUsername')}
          </Link>
        </p>
      ) : null}
      {account !== null &&
      (account.username ?? '') !== '' &&
      (account.lightningAddress ?? '').trim() === '' ? (
        <p className="text-center text-sm text-app-fg">
          <Link href="/profile" className="underline">
            {t('pos.needAddress')}
          </Link>
        </p>
      ) : null}
      {state === null && error === null ? (
        <Loader2 aria-hidden="true" className="mx-auto h-8 w-8 animate-spin text-app-subtle" />
      ) : null}
      {charge !== null && remaining > 0 ? (
        <div className="flex flex-col gap-3">
          <p className="text-center text-sm text-app-subtle">
            {t('pos.left', { time: formatLeft(remaining) })}
          </p>
          <p className="text-center text-2xl font-semibold tabular-nums text-app-fg">
            {t('pos.sats', { amount: String(charge.amountSats) })}
          </p>
          <Button
            type="button"
            size="lg"
            variant="secondary"
            disabled={busy}
            onClick={() => void onCancel()}
          >
            {t('pos.cancel')}
          </Button>
        </div>
      ) : null}
      {state !== null &&
      (charge === null || remaining <= 0) &&
      (account?.lightningAddress ?? '').trim() !== '' ? (
        <form className="flex flex-col gap-3" noValidate onSubmit={(event) => void onCreate(event)}>
          <Field
            label={t('pos.amount')}
            name="amount"
            type="number"
            inputMode="numeric"
            min={1}
            step={1}
            placeholder="0"
            value={amount}
            onChange={(event) => {
              setAmount(event.target.value);
            }}
            disabled={busy}
          />
          <Button type="submit" size="lg" disabled={busy}>
            {t('pos.create')}
          </Button>
        </form>
      ) : null}
      {error !== null ? (
        <p role="alert" className="text-center text-sm text-app-danger">
          {error}
        </p>
      ) : null}
      {state !== null && state.history.length > 0 ? (
        <div className="flex flex-col gap-2 border-t border-app-border pt-4">
          <h2 className="text-sm font-medium text-app-fg">{t('pos.history')}</h2>
          <ul className="flex flex-col gap-1 text-sm text-app-fg">
            {state.history.map((row) => (
              <li key={row.id} className="flex justify-between gap-3">
                <span className="tabular-nums">
                  {t('pos.sats', { amount: String(row.amountSats) })}
                </span>
                <span className="text-app-subtle">{t(statusKey(row))}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </Card>
  );
}

/** Catalog key for a history row status. */
function statusKey(row: PosCharge): 'pos.pending' | 'pos.cancelled' | 'pos.expired' {
  if (row.status === 'cancelled') {
    return 'pos.cancelled';
  }
  if (row.status === 'expired') {
    return 'pos.expired';
  }
  return 'pos.pending';
}
