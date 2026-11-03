'use client';

import { type ReactElement } from 'react';
import { useTranslations } from '@/components/LocaleProvider';

/** The loan a money reaction goes to: borrower, term, and whether it is already full. */
export interface LoanPayTarget {
  name: string;
  days: number | undefined;
  full: boolean;
}

/**
 * Loan sentence of a money reaction: who is lent to and how it comes back, or,
 * on a loan that is already fully funded, that this payment is a gift.
 *
 * @param props - Borrower's display name, repayment days (`undefined` when the
 *   note has no term), and whether the loan is already fully funded.
 * @returns The notice.
 */
export function LoanPayNotice({ name, days, full }: LoanPayTarget): ReactElement {
  const { t } = useTranslations();
  let text: string;
  if (full) {
    text = t('forum.loan.payNoticeFull', { name });
  } else if (days === undefined) {
    text = t('forum.loan.payNoticePlain', { name });
  } else if (days === 1) {
    text = t('forum.loan.payNoticeOne', { name });
  } else {
    text = t('forum.loan.payNotice', { name, days: String(days) });
  }
  return (
    <p
      data-loan-notice={full ? 'full' : 'lend'}
      className="w-full rounded-lg bg-app-card-muted px-3 py-2 text-left text-sm text-app-muted"
    >
      {text}
    </p>
  );
}
