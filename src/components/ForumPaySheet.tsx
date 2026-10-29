'use client';

import { Loader2, X } from 'lucide-react';
import { type FormEvent, type MouseEvent, type ReactElement } from 'react';
import { AmountEntry } from '@/components/AmountEntry';
import { useFiatPreference } from '@/components/FiatPreferenceProvider';
import { useTranslations } from '@/components/LocaleProvider';
import { Collapse } from '@/components/Collapse';
import { LoanPayNotice, type LoanPayTarget } from '@/components/LoanPayNotice';
import { PaySheet } from '@/components/PaySheet';
import { WalletPay } from '@/components/WalletPay';
import { Button, IconButton } from '@/components/ui';
import type { AmountUnit } from '@/lib/api-types';
import { storedTypedFiat, type FiatCode } from '@/lib/committed-fiat';
import type { FiatRateDay } from '@/lib/stats-money';

/** Pay-sheet validation or request failure. */
export type ForumPayError =
  | 'amount'
  | 'habitAmount'
  | 'noRate'
  | 'loading'
  | 'request'
  | 'rateLimit'
  | 'authorWallet'
  | 'deleted'
  | null;

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
  /** Fiat the member typed. Shown as-is. Absent for a bitcoin amount. */
  figure?: { code: FiatCode; amount: string };
}

/**
 * Amount form and pay sheet for one payable note, reply, or habit comment. The amount is chosen in
 * the card; **Continue** mints the invoice, and the last tap happens in the {@link PaySheet} that
 * then slides up, while the form stays behind it, disabled. A pay error folds in and out
 * ({@link Collapse}). The host renders this inside a `Collapse` with `holdMs` `PAY_SHEET_HOLD_MS`,
 * so the sheet can show its success step after the payment closed it.
 *
 * The sheet reads **Send to Ana** (`recipient`), **Lend to Ana** on a loan that still
 * collects, **Pay to post** on a posting fee (which has no amount form), or **Send** without a
 * name, and its button **Send ₿500**, **Lend ₿500**, or **Pay ₿500 and post**. On a
 * loan, {@link LoanPayNotice} says in the amount form how the money comes back, or that it is a
 * gift on a loan that is already full; the sheet shows no notice.
 *
 * @param props - Open pay state for `messageId`.
 * @returns The amount form and, while an invoice is open, the pay sheet.
 */
export function ForumPaySheet({
  messageId,
  payDraft,
  payBusy,
  payError,
  payInvoice,
  onPayDraftChange,
  onPayUnitChange,
  onPaySubmit,
  onPayCancel,
  rateDay,

  onInteract,
  loan,
  recipient,
}: {
  messageId: string;
  payDraft: string;
  payBusy: boolean;
  payError: ForumPayError;
  payInvoice: ForumPayInvoice | null;
  onPayDraftChange: (value: string) => void;
  onPayUnitChange?: (unit: AmountUnit) => void;
  onPaySubmit: () => void | Promise<ForumPayInvoice | null | undefined>;
  onPayCancel: () => void;
  rateDay: FiatRateDay | null;

  onInteract: (event: MouseEvent) => void;
  /** Set when the paid note is a loan: borrower, term, and whether it is already fully funded. */
  loan?: LoanPayTarget | undefined;
  /** Display name of the person paid, for the sheet's title; without it the sheet reads **Send**. */
  recipient?: string | undefined;
}): ReactElement {
  const { t } = useTranslations();
  const { fiat } = useFiatPreference();
  const invoiceForCard =
    payInvoice !== null && payInvoice.messageId === messageId ? payInvoice : null;
  const postsOnPay = invoiceForCard?.postsOnPay === true;
  const typedFigure = invoiceForCard?.figure;
  const typedStored = storedTypedFiat(typedFigure);
  const lending = loan !== undefined && !loan.full && !postsOnPay;
  // Amount and rate problems sit under the amount; the rest fold in above Continue.
  const requestError =
    payError === 'request' ||
    payError === 'rateLimit' ||
    payError === 'authorWallet' ||
    payError === 'deleted';

  const handlePaySubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    if (payBusy || payError === 'loading') {
      return;
    }
    void Promise.resolve(onPaySubmit());
  };

  const amountForm = postsOnPay ? null : (
    <form
      onSubmit={handlePaySubmit}
      onClick={onInteract}
      data-pay-amount=""
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
        disabled={payBusy || invoiceForCard !== null}
        rateDay={rateDay}
        onValueChange={onPayDraftChange}
        {...(onPayUnitChange === undefined ? {} : { onUnitChange: onPayUnitChange })}
        {...(payError === 'amount'
          ? { error: t('forum.payErrorAmount') }
          : payError === 'habitAmount'
            ? { error: t('habit.payErrorAmount') }
            : payError === 'noRate'
              ? { error: t('pos.noRate', { code: fiat }) }
              : {})}
      />
      <Collapse show={requestError}>
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
      {loan === undefined ? null : <LoanPayNotice {...loan} />}
      <Button
        type="submit"
        disabled={
          payBusy ||
          invoiceForCard !== null ||
          payError === 'loading' ||
          payError === 'amount' ||
          payError === 'habitAmount' ||
          payError === 'noRate'
        }
        icon={payBusy ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> : undefined}
      >
        {t('forum.payContinue')}
      </Button>
      {payError === 'loading' ? (
        <p role="alert" className="text-sm text-app-danger">
          {t('pos.rateLoading', { code: fiat })}
        </p>
      ) : null}
    </form>
  );

  return (
    <>
      {amountForm}
      {invoiceForCard === null ? null : (
        <PaySheet
          title={
            postsOnPay
              ? t('paySheet.titlePost')
              : recipient === undefined
                ? t('paySheet.titleSend')
                : t(lending ? 'paySheet.titleLendTo' : 'paySheet.titleSendTo', {
                    name: recipient,
                  })
          }
          amountSats={invoiceForCard.amountSats}
          rateDay={rateDay}
          {...(typedStored === undefined ? {} : { stored: typedStored })}
          successTitle={
            postsOnPay
              ? t('paySheet.posted')
              : recipient === undefined
                ? t('paySheet.sent')
                : t(lending ? 'paySheet.lentTo' : 'paySheet.sentTo', { name: recipient })
          }
          onClose={onPayCancel}
        >
          <WalletPay
            sparkInvoice={invoiceForCard.sparkInvoice}
            pr={invoiceForCard.pr}
            amountSats={invoiceForCard.amountSats}
            rateDay={rateDay}
            {...(typedFigure === undefined ? {} : { chargeFigure: typedFigure })}
            postsOnPay={postsOnPay}
            flow={postsOnPay ? 'post_fee' : 'gift'}
            confirmLabel={(amount) =>
              t(lending ? 'forum.loan.payLend' : 'paySheet.sendAmount', { amount })
            }
          />
        </PaySheet>
      )}
    </>
  );
}
