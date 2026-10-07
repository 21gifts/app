'use client';

import { ArrowDownLeft, ArrowUpRight, Check, Copy, ExternalLink } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState, type ReactElement, type ReactNode } from 'react';
import { ExternalLinkWarning } from '@/components/ExternalLinkWarning';
import { useFiatPreference } from '@/components/FiatPreferenceProvider';
import { useTranslations } from '@/components/LocaleProvider';
import { useNumberFormat } from '@/components/NumberFormatProvider';
import { preferredFiatSuffix } from '@/components/PreferredFiatSuffix';
import { WalletBalance } from '@/components/WalletBalance';
import { Card, IconButton } from '@/components/ui';
import { useLatestRateDayState } from '@/hooks/useLatestRateDay';
import { useWallet } from '@/hooks/useWallet';
import { useWalletPayment } from '@/hooks/useWalletPayment';
import { openInSystemBrowser } from '@/lib/in-app-browser';
import type { MessageKey } from '@/lib/messages';
import {
  formatBitcoin,
  formatFiatDisplay,
  satsToFiatAmount,
  type FiatRateDay,
} from '@/lib/stats-money';
import { paymentMessage, paymentTitle } from '@/lib/wallet/payment-display';
import type { WalletPayment } from '@/lib/wallet/wallet-sdk';

/**
 * Keeps both ends of a long value.
 *
 * @param value - Invoice, hash, key, or id.
 * @returns The value, or its first 10 and last 6 characters around an ellipsis.
 */
function middle(value: string): string {
  return value.length <= 20 ? value : `${value.slice(0, 10)}…${value.slice(-6)}`;
}

/** One label/value line of a summary list. */
function Row(props: { label: string; children: ReactNode }): ReactElement {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5">
      <dt className="shrink-0 text-sm text-app-muted">{props.label}</dt>
      <dd className="min-w-0 text-right text-sm tabular-nums lining-nums text-app-fg">
        {props.children}
      </dd>
    </div>
  );
}

/** A long technical value, shortened in the middle, with an icon-only Copy. */
function CopyRow(props: { label: string; value: string }): ReactElement {
  const { t } = useTranslations();
  const [copies, setCopies] = useState(0);
  useEffect(() => {
    if (copies === 0) {
      return;
    }
    const timer = window.setTimeout(() => {
      setCopies(0);
    }, 2000);
    return () => window.clearTimeout(timer);
  }, [copies]);
  const copy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(props.value);
      setCopies((count) => count + 1);
    } catch {
      // No clipboard here (an insecure page, or a refused write): the value stays readable.
    }
  };
  return (
    <Row label={props.label}>
      <span className="inline-flex max-w-full items-center gap-1">
        <span className="truncate font-mono text-xs">{middle(props.value)}</span>
        <IconButton
          type="button"
          size="sm"
          variant="ghost"
          aria-label={t('wallet.payment.copyValue', { label: props.label })}
          onClick={() => {
            void copy();
          }}
        >
          {copies > 0 ? (
            <Check aria-hidden="true" className="h-3.5 w-3.5 text-app-success" />
          ) : (
            <Copy aria-hidden="true" className="h-3.5 w-3.5" />
          )}
        </IconButton>
        <span className="sr-only" aria-live="polite">
          {copies > 0 ? t('wallet.payment.copied') : ''}
        </span>
      </span>
    </Row>
  );
}

const METHOD_KEY: Record<WalletPayment['method'], MessageKey> = {
  lightning: 'wallet.payment.method.lightning',
  spark: 'wallet.payment.method.spark',
  deposit: 'wallet.payment.method.deposit',
  withdraw: 'wallet.payment.method.withdraw',
  other: 'wallet.payment.method.other',
};

const STATUS: Record<WalletPayment['status'], { key: MessageKey; className: string }> = {
  completed: { key: 'wallet.payment.completed', className: 'bg-app-success/10 text-app-success' },
  pending: { key: 'wallet.pending', className: 'bg-app-notice text-app-notice-fg' },
  failed: { key: 'wallet.failed', className: 'bg-app-danger/10 text-app-danger' },
};

/** The loaded payment, shown once the rate read has settled. */
function PaymentView(props: { payment: WalletPayment; rateDay: FiatRateDay | null }): ReactElement {
  const { payment, rateDay } = props;
  const { t, locale } = useTranslations();
  const { numberFormat } = useNumberFormat();
  const { fiat } = useFiatPreference();
  const [leaving, setLeaving] = useState(false);
  const received = payment.direction === 'received';
  const Icon = received ? ArrowDownLeft : ArrowUpRight;
  const title = paymentTitle(payment);
  const message = paymentMessage(payment);
  const { info } = payment;
  /** A ₿ amount with the default fiat after it. */
  const amount = (sats: number): ReactElement => (
    <>
      {formatBitcoin(sats, numberFormat)}
      {preferredFiatSuffix(sats, rateDay, fiat, numberFormat)}
    </>
  );
  const fiatAmount = satsToFiatAmount(payment.amountSats, rateDay, fiat);
  const date = new Intl.DateTimeFormat(locale, { dateStyle: 'long', timeStyle: 'short' }).format(
    payment.timestamp,
  );
  const failed = payment.status === 'failed';
  const txUrl = info.txId === undefined ? null : `https://mempool.space/tx/${info.txId}`;

  return (
    <div className="flex w-full flex-col gap-5">
      <div className="flex flex-col items-center gap-2 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-app-card-muted">
          <Icon aria-hidden="true" className="h-5 w-5 text-app-fg" />
        </span>
        <p className="max-w-full truncate text-sm text-app-muted">
          {'text' in title ? title.text : t(title.key)}
        </p>
        <p
          className={`text-3xl font-semibold tabular-nums lining-nums${failed ? ' text-app-subtle line-through' : ' text-app-fg'}`}
        >
          {received ? '+' : '−'}
          {formatBitcoin(payment.amountSats, numberFormat)}
        </p>
        {fiatAmount === null ? null : (
          <p className="text-sm tabular-nums lining-nums text-app-muted">
            {formatFiatDisplay(fiatAmount, fiat, numberFormat)}
          </p>
        )}
        <span
          className={`rounded-full px-3 py-1 text-xs font-medium ${STATUS[payment.status].className}`}
        >
          {t(STATUS[payment.status].key)}
        </span>
        {!received && payment.status === 'pending' ? (
          <p className="text-xs text-app-muted">{t('wallet.payment.pendingHint')}</p>
        ) : null}
        {!received && failed ? (
          <p className="text-xs text-app-muted">{t('wallet.payment.failedHint')}</p>
        ) : null}
      </div>

      {message === null ? null : (
        <div className="rounded-2xl bg-app-card-muted px-4 py-3 text-sm text-app-fg">
          <p className="text-xs text-app-subtle">{t('wallet.payment.message')}</p>
          <p className="break-words">{message}</p>
        </div>
      )}

      <dl className="divide-y divide-app-border rounded-2xl border border-app-border px-4">
        <Row label={t('wallet.payment.date')}>{date}</Row>
        <Row label={t('wallet.payment.type')}>{t(METHOD_KEY[payment.method])}</Row>
        {info.lnAddress === undefined ? null : (
          <Row label={t('wallet.payment.to')}>
            <span className="break-all">{info.lnAddress}</span>
          </Row>
        )}
        {info.description === undefined ||
        ('text' in title && title.text === info.description) ? null : (
          <Row label={t('wallet.payment.description')}>{info.description}</Row>
        )}
        <Row label={t('wallet.payment.amount')}>{amount(payment.amountSats)}</Row>
        {(received && payment.feesSats === 0) || failed ? null : (
          <Row label={t('wallet.payment.fee')}>
            {payment.feesSats === 0 ? t('wallet.payment.feeFree') : amount(payment.feesSats)}
          </Row>
        )}
        {!received && !failed && payment.feesSats > 0 ? (
          <Row label={t('wallet.payment.total')}>
            <span className="font-medium">{amount(payment.amountSats + payment.feesSats)}</span>
          </Row>
        ) : null}
        {payment.method === 'deposit' && payment.feesSats > 0 ? (
          <Row label={t('wallet.payment.depositOnchain')}>
            {amount(payment.amountSats + payment.feesSats)}
          </Row>
        ) : null}
      </dl>

      <section aria-label={t('wallet.payment.technical')} className="flex flex-col gap-2">
        <h2 className="text-center text-xs tracking-widest text-app-subtle uppercase">
          {t('wallet.payment.technical')}
        </h2>
        <dl className="divide-y divide-app-border rounded-2xl border border-app-border px-4">
          {info.txId === undefined ? null : (
            <CopyRow label={t('wallet.payment.txid')} value={info.txId} />
          )}
          {info.vout === undefined ? null : (
            <CopyRow label={t('wallet.payment.output')} value={String(info.vout)} />
          )}
          {info.invoice === undefined ? null : (
            <CopyRow label={t('wallet.payment.invoice')} value={info.invoice} />
          )}
          {info.paymentHash === undefined ? null : (
            <CopyRow label={t('wallet.payment.paymentHash')} value={info.paymentHash} />
          )}
          {info.preimage === undefined ? null : (
            <CopyRow label={t('wallet.payment.preimage')} value={info.preimage} />
          )}
          <CopyRow label={t('wallet.payment.id')} value={payment.id} />
        </dl>
        {txUrl === null ? null : (
          <a
            href={txUrl}
            rel="noopener noreferrer"
            onClick={(event) => {
              event.preventDefault();
              setLeaving(true);
            }}
            className="inline-flex items-center justify-center gap-1.5 self-center py-2 text-sm text-app-muted underline underline-offset-2 hover:text-app-fg"
          >
            {t('wallet.payment.viewTx')}
            <ExternalLink aria-hidden="true" className="h-3.5 w-3.5" />
          </a>
        )}
      </section>
      {txUrl !== null && leaving ? (
        <ExternalLinkWarning
          url={txUrl}
          onCancel={() => {
            setLeaving(false);
          }}
          onConfirm={() => {
            setLeaving(false);
            openInSystemBrowser(txUrl);
          }}
        />
      ) : null}
    </div>
  );
}

/**
 * `/wallet/payment?id=…`: one payment with what the wallet knows about it —
 * direction, title, signed amount with the default fiat, status (with a hint
 * for a pending or failed send), the message, a summary list (date, type,
 * counterparty, description, amount, fee, total, what arrived on-chain), and
 * the technical details with Copy (transaction and output, payment request,
 * payment hash, proof of payment, payment id). Nothing shows until the rate
 * read has settled, so no amount appears without its fiat while the rate is
 * still loading. Opened directly while the wallet is not open, it shows the
 * wallet's own unlock, opening, or error state (`WalletBalance`) and loads the
 * payment once the wallet is ready; without a wallet here it says the payment
 * could not be found. An
 * on-chain payment links to its transaction on mempool.space through the
 * external-link warning. A missing or unknown id says so.
 *
 * @returns The payment screen.
 */
export function WalletPaymentDetails(): ReactElement {
  const { t } = useTranslations();
  const id = useSearchParams().get('id');
  const state = useWalletPayment(id);
  const rate = useLatestRateDayState();
  const wallet = useWallet();
  const waiting = state.status === 'loading';
  const missing = state.status === 'missing' || (waiting && wallet.status === 'disabled');
  return (
    <Card surface={false}>
      <h1 className="sr-only">{t('wallet.payment.heading')}</h1>
      {state.status === 'ready' && wallet.status === 'ready' && !rate.loading ? (
        <PaymentView payment={state.payment} rateDay={rate.rateDay} />
      ) : null}
      {missing ? (
        <p role="alert" className="text-center text-sm text-app-muted">
          {t('wallet.payment.missing')}
        </p>
      ) : null}
      {!missing && wallet.status !== 'ready' && wallet.status !== 'disabled' ? (
        <WalletBalance
          status={wallet.status}
          balanceSats={null}
          onUnlock={wallet.unlock}
          onRetry={wallet.retry}
          prfUnsupported={wallet.prfUnsupported}
        />
      ) : null}
    </Card>
  );
}
