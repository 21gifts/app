'use client';

import { Loader2, X } from 'lucide-react';
import { type FormEvent, type MouseEvent, type ReactElement } from 'react';
import { AmountEntry } from '@/components/AmountEntry';
import { useFiatPreference } from '@/components/FiatPreferenceProvider';
import { useTranslations } from '@/components/LocaleProvider';
import { useNumberFormat } from '@/components/NumberFormatProvider';
import { preferredFiatSuffix } from '@/components/PreferredFiatSuffix';
import { QrCode } from '@/components/QrCode';
import { WalletPay } from '@/components/WalletPay';
import { Button, IconButton } from '@/components/ui';
import type { AmountUnit } from '@/lib/api-types';
import { formatBitcoin, type FiatRateDay } from '@/lib/stats-money';
import {
  isAndroidUserAgent,
  walletOfSatoshiHref,
  walletOfSatoshiIntentHref,
} from '@/lib/wos-deep-link';

/** Pay-sheet validation or request failure. */
export type ForumPayError =
  'amount' | 'habitAmount' | 'request' | 'rateLimit' | 'authorWallet' | 'deleted' | null;

/** Active pay invoice shown under a forum card or a habit comment. */
export interface ForumPayInvoice {
  /** Message or comment id the invoice belongs to. */
  messageId: string;
  /** BOLT11 payment request. */
  pr: string;
  /** Whole sats the payer confirmed. */
  amountSats: number;
  /** Request the in-app wallet pays, or `null`/absent when the api issued none. */
  sparkInvoice?: string | null | undefined;
}

/**
 * Amount form and invoice card for one payable note, reply, or habit comment.
 *
 * @param props - Open pay-sheet state for `messageId`.
 * @returns The in-card sheet.
 */
export function ForumPaySheet({
  messageId,
  payDraft,
  payBusy,
  payError,
  payInvoice,
  payWaiting,
  onPayDraftChange,
  onPayUnitChange,
  onPaySubmit,
  onPayCancel,
  rateDay,
  ratePending = false,
  showPaymentQr,
  onInteract,
}: {
  messageId: string;
  payDraft: string;
  payBusy: boolean;
  payError: ForumPayError;
  payInvoice: ForumPayInvoice | null;
  payWaiting: boolean;
  onPayDraftChange: (value: string) => void;
  onPayUnitChange?: (unit: AmountUnit) => void;
  onPaySubmit: () => void | Promise<ForumPayInvoice | null | undefined>;
  onPayCancel: () => void;
  rateDay: FiatRateDay | null;
  /** When true, Continue does not submit. The rate request is still loading. */
  ratePending?: boolean;
  showPaymentQr: boolean;
  onInteract: (event: MouseEvent) => void;
}): ReactElement {
  const { t } = useTranslations();
  const { numberFormat } = useNumberFormat();
  const { fiat } = useFiatPreference();
  const invoiceForCard =
    payInvoice !== null && payInvoice.messageId === messageId ? payInvoice : null;
  /* v8 ignore start -- Android vs iOS wallet href */
  const android =
    typeof navigator !== 'undefined' ? isAndroidUserAgent(navigator.userAgent) : false;
  const wosHref =
    invoiceForCard === null
      ? null
      : android
        ? walletOfSatoshiIntentHref(invoiceForCard.pr)
        : walletOfSatoshiHref(invoiceForCard.pr);
  /* v8 ignore stop */

  const handlePaySubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    if (payBusy || ratePending) {
      return;
    }
    void Promise.resolve(onPaySubmit());
  };

  const walletButton =
    wosHref === null ? null : (
      <Button
        type="button"
        aria-label={t('forum.payOpenWalletAria')}
        disabled={payBusy}
        icon={
          <img
            src="/wos-icon.png"
            alt=""
            width={20}
            height={20}
            aria-hidden="true"
            className="h-5 w-5 rounded-md ring-1 ring-white/30"
          />
        }
        onClick={() => {
          window.location.href = wosHref;
        }}
      >
        {t('forum.payOpenWallet')}
      </Button>
    );

  if (invoiceForCard === null) {
    return (
      <form
        onSubmit={handlePaySubmit}
        onClick={onInteract}
        data-pay-sheet=""
        className="relative mt-3 flex flex-col gap-3 rounded-xl border border-app-border bg-app-card p-3 pl-11 pt-10"
      >
        <div className="absolute left-2 top-2">
          <IconButton
            type="button"
            size="sm"
            variant="ghost"
            aria-label={t('forum.payClose')}
            onClick={onPayCancel}
          >
            <X aria-hidden="true" className="h-4 w-4" />
          </IconButton>
        </div>
        <AmountEntry
          label={t('forum.payAmountLabel')}
          placeholder={t('forum.payAmountPlaceholder')}
          value={payDraft}
          disabled={payBusy}
          rateDay={rateDay}
          onValueChange={onPayDraftChange}
          {...(onPayUnitChange === undefined ? {} : { onUnitChange: onPayUnitChange })}
        />
        {payError === 'amount' ? (
          <p role="alert" className="text-sm text-app-danger">
            {t('forum.payErrorAmount')}
          </p>
        ) : null}
        {payError === 'habitAmount' ? (
          <p role="alert" className="text-sm text-app-danger">
            {t('habit.payErrorAmount')}
          </p>
        ) : null}
        {payError === 'request' ? (
          <p role="alert" className="text-sm text-app-danger">
            {t('forum.payErrorRequest')}
          </p>
        ) : null}
        {payError === 'rateLimit' ? (
          <p role="alert" className="text-sm text-app-danger">
            {t('forum.payErrorRateLimit')}
          </p>
        ) : null}
        {payError === 'authorWallet' ? (
          <p role="alert" className="text-sm text-app-danger">
            {t('forum.payErrorAuthorWallet')}
          </p>
        ) : null}
        {payError === 'deleted' ? (
          <p role="alert" className="text-sm text-app-danger">
            {t('forum.errorNoteDeleted')}
          </p>
        ) : null}
        <Button
          type="submit"
          disabled={payBusy || ratePending}
          icon={
            payBusy ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> : undefined
          }
        >
          {t('forum.payContinue')}
        </Button>
      </form>
    );
  }

  return (
    <div
      onClick={onInteract}
      data-pay-sheet=""
      className="relative mt-3 flex flex-col items-center gap-3 rounded-xl border border-app-border bg-app-card p-4"
    >
      <div className="absolute left-2 top-2">
        <IconButton
          type="button"
          size="sm"
          variant="ghost"
          aria-label={t('forum.payClose')}
          onClick={onPayCancel}
        >
          <X aria-hidden="true" className="h-4 w-4" />
        </IconButton>
      </div>
      <p className="px-10 text-center text-sm text-app-muted">
        {t('forum.payConfirm', {
          amount: formatBitcoin(invoiceForCard.amountSats, numberFormat),
        })}
        {preferredFiatSuffix(invoiceForCard.amountSats, rateDay, fiat, numberFormat)}
      </p>
      <WalletPay
        sparkInvoice={invoiceForCard.sparkInvoice}
        amountSats={invoiceForCard.amountSats}
        rateDay={rateDay}
        fallback={
          <>
            {showPaymentQr ? (
              <QrCode value={invoiceForCard.pr} label={t('forum.payInvoiceQr')} />
            ) : null}
            {walletButton}
          </>
        }
      />
      {/* v8 ignore start -- payWaiting is true only after invoice mint while polling */}
      {payWaiting ? (
        <p className="text-center text-xs text-app-muted">{t('forum.payWaiting')}</p>
      ) : null}
      {/* v8 ignore stop */}
    </div>
  );
}
