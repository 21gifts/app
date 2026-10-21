'use client';

import {
  ArrowDownLeft,
  ArrowUpRight,
  Check,
  ChevronRight,
  Copy,
  ExternalLink,
  Heart,
} from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState, type ReactElement, type ReactNode } from 'react';
import { ExternalLinkWarning } from '@/components/ExternalLinkWarning';
import { useFiatPreference } from '@/components/FiatPreferenceProvider';
import { useTranslations } from '@/components/LocaleProvider';
import { useNumberFormat } from '@/components/NumberFormatProvider';
import { preferredFiatSuffix } from '@/components/PreferredFiatSuffix';
import { WalletBalance } from '@/components/WalletBalance';
import { Button, Card, IconButton } from '@/components/ui';
import { useHeartContext } from '@/hooks/useHeartContext';
import { useShopChargeFigure } from '@/hooks/useShopChargeFigure';
import { useSpotRate } from '@/hooks/useSpotRate';
import { useWallet } from '@/hooks/useWallet';
import { useWalletPayment } from '@/hooks/useWalletPayment';
import { openInSystemBrowser } from '@/lib/in-app-browser';
import type { MessageKey } from '@/lib/messages';
import { formatBitcoin, formatFiatDisplay, satsToFiatAmount } from '@/lib/stats-money';
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

/** The loaded payment. A shop charge shows its stored figure once the receipt returns. */
function PaymentView(props: { payment: WalletPayment }): ReactElement {
  const { payment } = props;
  const { t, locale } = useTranslations();
  const { numberFormat } = useNumberFormat();
  const { fiat } = useFiatPreference();
  const rateDay = useSpotRate();
  const shop = useShopChargeFigure(payment.info.purpose === 'shop' ? payment.info : null);
  const [leaving, setLeaving] = useState(false);
  const [open, setOpen] = useState(false);
  const received = payment.direction === 'received';
  const Icon = received ? ArrowDownLeft : ArrowUpRight;
  const title = paymentTitle(payment);
  const message = paymentMessage(payment);
  const { info } = payment;
  const heartHash =
    payment.status !== 'pending' && info.purpose === 'gift' && typeof info.paymentHash === 'string'
      ? info.paymentHash.toLowerCase()
      : null;
  const heartContext = useHeartContext(heartHash === null ? [] : [heartHash]);
  const heart = heartHash === null ? undefined : heartContext.byHash.get(heartHash);
  /** Bitcoin plus one fiat figure. The charge amount uses a stored shop figure. A fee of ₿0 stays the fee-free label. */
  const amount = (sats: number): ReactElement => (
    <>
      {formatBitcoin(sats, numberFormat)}
      {shopFigure !== null && sats === payment.amountSats ? (
        <>
          <span aria-hidden="true"> · </span>
          <span>{formatFiatDisplay(shopFigure.amount, shopFigure.code, numberFormat)}</span>
        </>
      ) : (
        preferredFiatSuffix(sats, rateDay, fiat, numberFormat)
      )}
    </>
  );
  const shopFigure = payment.info.purpose === 'shop' && !shop.pending ? shop.figure : null;
  const spotAmount =
    payment.info.purpose === 'shop'
      ? shop.pending || shopFigure !== null
        ? null
        : satsToFiatAmount(payment.amountSats, rateDay, fiat)
      : satsToFiatAmount(payment.amountSats, rateDay, fiat);
  const fiatAmount =
    shopFigure !== null
      ? shopFigure
      : spotAmount === null
        ? null
        : { code: fiat, amount: spotAmount };
  const date = new Intl.DateTimeFormat(locale, { dateStyle: 'long', timeStyle: 'short' }).format(
    payment.timestamp,
  );
  const failed = payment.status === 'failed';
  const txUrl = info.txId === undefined ? null : `https://mempool.space/tx/${info.txId}`;

  return (
    <div className="flex w-full flex-col gap-5">
      <div className="flex flex-col items-center gap-2 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-app-card-muted">
          {heart === undefined ? (
            <Icon aria-hidden="true" className="h-5 w-5 text-app-fg" />
          ) : (
            <Heart aria-hidden="true" fill="currentColor" className="h-5 w-5 text-app-accent" />
          )}
        </span>
        {heart !== undefined ? null : (
          <p className="max-w-full truncate text-sm text-app-muted">
            {'text' in title ? title.text : t(title.key)}
          </p>
        )}
        <p
          className={`text-3xl font-semibold tabular-nums lining-nums${failed ? ' text-app-subtle line-through' : ' text-app-fg'}`}
        >
          {received ? '+' : '−'}
          {formatBitcoin(payment.amountSats, numberFormat)}
        </p>
        {fiatAmount === null ? null : (
          <p className="text-sm tabular-nums lining-nums text-app-muted">
            {formatFiatDisplay(fiatAmount.amount, fiatAmount.code, numberFormat)}
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

      {heart === undefined ? null : (
        <Link
          href={`/messages/${heart.messageId}`}
          aria-label={`${heart.authorName} ${heart.text}`.trim() || t('shops.viewPost')}
          className="flex w-full items-center gap-3 rounded-2xl border border-app-border px-4 py-3 text-left text-app-fg no-underline transition hover:bg-app-hover"
        >
          <span className="min-w-0 flex-1">
            {heart.authorName === '' ? null : (
              <span className="block text-sm font-medium text-app-fg">{heart.authorName}</span>
            )}
            {heart.text === '' ? null : (
              <span className="mt-1 block whitespace-pre-wrap text-sm font-medium text-app-fg line-clamp-3">
                {heart.text}
              </span>
            )}
          </span>
          <ChevronRight aria-hidden="true" className="h-4 w-4 shrink-0 text-app-subtle" />
        </Link>
      )}

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
            {info.memberAccountId === undefined ? (
              <span className="break-all">{info.lnAddress}</span>
            ) : (
              <Link
                href={`/members/${info.memberAccountId}`}
                className="break-all text-app-fg font-medium underline underline-offset-2"
              >
                {info.lnAddress}
              </Link>
            )}
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

      <button
        type="button"
        aria-expanded={open}
        onClick={() => {
          setOpen((current) => !current);
        }}
        className="w-full cursor-pointer text-center text-xs tracking-widest text-app-subtle uppercase"
      >
        {t('wallet.payment.technical')}
      </button>
      {open ? (
        <div className="mt-2 flex flex-col gap-2">
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
        </div>
      ) : null}
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
 * a Details button with aria-expanded, closed until pressed, whose open list is those technical values with
 * Copy (transaction and output, payment request, payment hash, proof of
 * payment, payment id). The payment shows as soon as it is loaded. A shop
 * charge shows the currency figure stored on its receipt once that read
 * returns. While that read is out the amount stays bitcoin, so a stored
 * figure is not flashed as a spot price. After the read, a missing figure
 * shows the current spot, as does every payment that is not a shop charge.
 * That spot is not written onto the payment. While the wallet is still connecting, could not be opened,
 * or its one-time setup gave up, it shows that state (`WalletBalance`) and
 * loads the payment once the wallet is ready (a session whose wallet is not
 * open sees the login card in place, from `OnboardingGate`); without a wallet here it says the payment
 * could not be found. An
 * on-chain payment links to its transaction on mempool.space through the
 * external-link warning. A missing or unknown id says so; a read that
 * failed otherwise says so with **Try again**.
 *
 * @returns The payment screen.
 */
export function WalletPaymentDetails(): ReactElement {
  const { t } = useTranslations();
  const id = useSearchParams().get('id');
  const state = useWalletPayment(id);
  const wallet = useWallet();
  const waiting = state.status === 'loading';
  const missing = state.status === 'missing' || (waiting && wallet.status === 'disabled');
  return (
    <Card surface={false}>
      <h1 className="sr-only">{t('wallet.payment.heading')}</h1>
      {state.status === 'ready' && wallet.status === 'ready' ? (
        <PaymentView payment={state.payment} />
      ) : null}
      {missing ? (
        <p role="alert" className="text-center text-sm text-app-muted">
          {t('wallet.payment.missing')}
        </p>
      ) : null}
      {state.status === 'error' ? (
        <div className="flex flex-col items-center gap-3">
          <p role="alert" className="text-center text-sm text-app-danger">
            {t('wallet.payment.error')}
          </p>
          <Button onClick={state.retry}>{t('login.retry')}</Button>
        </div>
      ) : null}
      {!missing && wallet.status !== 'ready' && wallet.status !== 'disabled' ? (
        <WalletBalance
          status={wallet.status}
          balanceSats={null}
          onRetry={wallet.retry}
          setupFailed={wallet.setupFailed}
          downloading={wallet.downloading}
        />
      ) : null}
    </Card>
  );
}
