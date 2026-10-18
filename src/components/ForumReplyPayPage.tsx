'use client';

import { type ReactElement } from 'react';
import { useTranslations } from '@/components/LocaleProvider';
import { useNumberFormat } from '@/components/NumberFormatProvider';
import type { LoanPayTarget } from '@/components/LoanPayNotice';
import { PaySheet } from '@/components/PaySheet';
import { WalletPay } from '@/components/WalletPay';
import { formatBitcoin, type FiatRateDay } from '@/lib/stats-money';

/**
 * Pay sheet of a paid reaction: the {@link PaySheet} with the amount and the pay button, over the
 * open thread, whose reaction form stays in place behind it, disabled. The sheet shows neither the
 * reaction's text nor a loan notice (the form behind it does). The host renders it inside a
 * `Collapse` with `holdMs` `PAY_SHEET_HOLD_MS`, so it can show its success step after the payment
 * closed it.
 *
 * The pay slot pays from the member's in-app wallet (`sparkInvoice` when the
 * api issued one, otherwise `pr`). It shows no invoice QR.
 *
 * The sheet reads **Send to Ana** and its button **Send ₿500**; on a loan that still
 * collects **Lend to Ana** and **Lend ₿500**. Without a name it reads **Send**.
 *
 * @param props - Invoice, rate, cancel handler, loan, and the name of the person paid.
 * @returns The pay sheet.
 */
export function ForumReplyPayPage({
  amountSats,
  pr,
  sparkInvoice,
  rateDay,
  onCancel,
  loan,
  recipient,
}: {
  amountSats: number;
  pr: string;
  sparkInvoice?: string | null | undefined;
  rateDay: FiatRateDay | null;
  onCancel: () => void;
  /** Set when the note is a loan: borrower, term, and whether it is already fully funded. */
  loan?: LoanPayTarget | undefined;
  /** Display name of the person paid, for the sheet's title; without it the sheet reads **Send**. */
  recipient?: string | undefined;
}): ReactElement {
  const { t } = useTranslations();
  const { numberFormat } = useNumberFormat();
  const lending = loan !== undefined && !loan.full;
  return (
    <PaySheet
      title={
        recipient === undefined
          ? t('paySheet.titleSend')
          : t(lending ? 'paySheet.titleLendTo' : 'paySheet.titleSendTo', { name: recipient })
      }
      amountSats={amountSats}
      rateDay={rateDay}
      successTitle={
        recipient === undefined
          ? t('paySheet.sent')
          : t(lending ? 'paySheet.lentTo' : 'paySheet.sentTo', { name: recipient })
      }
      onClose={onCancel}
    >
      <WalletPay
        sparkInvoice={sparkInvoice}
        pr={pr}
        amountSats={amountSats}
        rateDay={rateDay}
        flow="reaction"
        confirmLabel={t(lending ? 'forum.loan.payLend' : 'paySheet.sendAmount', {
          amount: formatBitcoin(amountSats, numberFormat),
        })}
      />
    </PaySheet>
  );
}
