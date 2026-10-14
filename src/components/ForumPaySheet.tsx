'use client';

import { Loader2, X } from 'lucide-react';
import { type FormEvent, type MouseEvent, type ReactElement } from 'react';
import { AmountEntry } from '@/components/AmountEntry';
import { useFiatPreference } from '@/components/FiatPreferenceProvider';
import { useTranslations } from '@/components/LocaleProvider';
import { Collapse, Swap } from '@/components/Motion';
import { useNumberFormat } from '@/components/NumberFormatProvider';
import { LoanPayNotice, type LoanPayTarget } from '@/components/LoanPayNotice';
import { preferredFiatSuffix } from '@/components/PreferredFiatSuffix';
import { WalletPay } from '@/components/WalletPay';
import { Button, IconButton } from '@/components/ui';
import type { AmountUnit } from '@/lib/api-types';
import {
  formatBitcoin,
  formatFiatDisplay,
  satsToFiatAmount,
  type FiatRateDay,
} from '@/lib/stats-money';

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
  /** True for the posting fee of a new post or reply: paying it also posts that text. */
  postsOnPay?: boolean;
}

/**
 * Amount form and invoice card for one payable note, reply, or habit comment. The form gives way
 * to the card in steps ({@link Swap}), and a pay error folds in and out ({@link Collapse}).
 *
 * On a loan that still collects, the invoice card reads **You lend**, the
 * confirm button **Lend** with the amount, and {@link LoanPayNotice} says how it
 * comes back. On a loan that is already full the notice says it is a gift.
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
  onInteract,
  loan,
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
  onInteract: (event: MouseEvent) => void;
  /** Set when the paid note is a loan: borrower, term, and whether it is already fully funded. */
  loan?: LoanPayTarget | undefined;
}): ReactElement {
  const { t } = useTranslations();
  const { numberFormat } = useNumberFormat();
  const { fiat } = useFiatPreference();
  const invoiceForCard =
    payInvoice !== null && payInvoice.messageId === messageId ? payInvoice : null;
  const lending = loan !== undefined && !loan.full && invoiceForCard?.postsOnPay !== true;
  const amountWithFiat = (sats: number): string => {
    const priced = satsToFiatAmount(sats, rateDay, fiat);
    return priced === null
      ? formatBitcoin(sats, numberFormat)
      : `${formatBitcoin(sats, numberFormat)} · ${formatFiatDisplay(priced, fiat, numberFormat)}`;
  };

  const handlePaySubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    if (payBusy || ratePending) {
      return;
    }
    void Promise.resolve(onPaySubmit());
  };

  const amountForm = (
    <form
      onSubmit={handlePaySubmit}
      onClick={onInteract}
      data-pay-sheet=""
      className="relative mt-3 flex flex-col gap-3 rounded-xl border border-app-border bg-app-card p-3 pl-12 pt-12"
    >
      <div className="absolute left-3 top-3">
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
      <Collapse show={payError !== null}>
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
      </Collapse>
      <Button
        type="submit"
        disabled={payBusy || ratePending}
        icon={payBusy ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> : undefined}
      >
        {t('forum.payContinue')}
      </Button>
    </form>
  );

  const invoiceCard =
    invoiceForCard === null ? null : (
      <div
        onClick={onInteract}
        data-pay-sheet=""
        className="relative mt-3 flex flex-col items-center gap-3 rounded-xl border border-app-border bg-app-card p-4"
      >
        <div className="absolute left-3 top-3">
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
          {t(lending ? 'forum.loan.payAmount' : 'forum.payConfirm', {
            amount: formatBitcoin(invoiceForCard.amountSats, numberFormat),
          })}
          {preferredFiatSuffix(invoiceForCard.amountSats, rateDay, fiat, numberFormat)}
        </p>
        {loan !== undefined && invoiceForCard.postsOnPay !== true ? (
          <LoanPayNotice {...loan} />
        ) : null}
        <WalletPay
          sparkInvoice={invoiceForCard.sparkInvoice}
          pr={invoiceForCard.pr}
          amountSats={invoiceForCard.amountSats}
          rateDay={rateDay}
          postsOnPay={invoiceForCard.postsOnPay === true}
          flow={invoiceForCard.postsOnPay === true ? 'post_fee' : 'gift'}
          confirmLabel={
            lending
              ? t('forum.loan.payLend', { amount: amountWithFiat(invoiceForCard.amountSats) })
              : undefined
          }
        />
        {/* v8 ignore start -- payWaiting is true only after invoice mint while polling */}
        {payWaiting ? (
          <p className="text-center text-xs text-app-muted">{t('forum.payWaiting')}</p>
        ) : null}
        {/* v8 ignore stop */}
      </div>
    );

  return (
    <Swap viewKey={invoiceCard === null ? 'amount' : 'invoice'}>{invoiceCard ?? amountForm}</Swap>
  );
}
