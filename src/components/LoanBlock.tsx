'use client';

import { CircleCheck, HandCoins } from 'lucide-react';
import Link from 'next/link';
import { type ReactElement, type ReactNode } from 'react';
import { useTranslations } from '@/components/LocaleProvider';
import { Button } from '@/components/ui';
import type { RepaymentLedger } from '@/lib/api';

type LoanBlockState = 'collecting' | 'funded' | 'repaying' | 'repaid';

function loanBlockState(percent: number, ledger: RepaymentLedger | null): LoanBlockState {
  if (percent < 100) {
    return 'collecting';
  }
  if (ledger === null) {
    return 'funded';
  }
  return ledger.repayments.length > 0 && ledger.repayments.every((row) => row.status === 'paid')
    ? 'repaid'
    : 'repaying';
}

function paidBackPercent(ledger: RepaymentLedger): number {
  const fiat = ledger.currency !== 'BTC';
  let paid = 0;
  let total = 0;
  for (const row of ledger.repayments) {
    const value = fiat ? Math.round(Number(row.amount ?? '0') * 100) : (row.sats ?? 0);
    if (!Number.isFinite(value) || value <= 0) {
      continue;
    }
    total += value;
    if (row.status === 'paid') {
      paid += value;
    }
  }
  return total <= 0 ? 0 : Math.min(100, Math.floor((paid * 100) / total));
}

/**
 * Loan block of a posted loan note: what is asked, how far it is, and the
 * **Lend** action while it collects.
 *
 * Collecting and funded come from the collected percent the note already
 * carries. The paid-back share and **Paid back** need the public ledger, which
 * only the open note passes; without it a full loan reads **Fully funded**.
 *
 * @param props - `messageId` (loan note id); `ask` (ask amount markup: defined
 *   fiat, bitcoin, visitor fiat); `collected` and `goal` (amounts with their
 *   fiat for the status line); `percent` (collected percent, uncapped);
 *   `ledger` (public ledger, or `null` when it is not loaded here);
 *   `ledgerLink` (show the **Repayment list** link on feed and profile cards);
 *   `onLend` (opens the money reaction; omitted when the viewer cannot lend).
 * @returns The block.
 */
export function LoanBlock({
  messageId,
  ask,
  collected,
  goal,
  percent,
  ledger,
  ledgerLink,
  onLend,
}: {
  messageId: string;
  ask: ReactNode;
  collected: string;
  goal: string;
  percent: number;
  ledger: RepaymentLedger | null;
  ledgerLink: boolean;
  onLend?: (() => void) | undefined;
}): ReactElement {
  const { t } = useTranslations();
  const state = loanBlockState(percent, ledger);
  const paidShown = state === 'repaying' || state === 'repaid';
  const paid =
    ledger === null || !paidShown ? 0 : state === 'repaid' ? 100 : paidBackPercent(ledger);
  const barPercent = paidShown ? paid : Math.min(100, Math.max(0, percent));
  const canLend = state === 'collecting' && onLend !== undefined;
  return (
    <section
      data-loan-block={state}
      aria-label={t('forum.loan.title')}
      className="mt-3 flex flex-col gap-1.5"
    >
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="flex items-center gap-1.5 text-xs font-medium text-app-muted">
          <HandCoins aria-hidden="true" className="h-3.5 w-3.5 shrink-0 self-center" />
          {t('forum.loan.title')}
        </h3>
        <p className="text-right text-sm font-semibold tabular-nums lining-nums text-app-fg">
          {ask}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <svg
          viewBox="0 0 100 8"
          preserveAspectRatio="none"
          role="img"
          aria-label={
            paidShown
              ? t('forum.loan.paidBarAria', { percent: String(paid) })
              : t('forum.goalBarAria', { percent: String(percent) })
          }
          className="h-2 min-w-0 flex-1"
        >
          <rect x="0" y="0" width="100" height="8" rx="4" className="fill-app-border" />
          {barPercent > 0 ? (
            <rect
              x="0"
              y="0"
              width={barPercent}
              height="8"
              rx="4"
              className={paidShown ? 'fill-app-success' : 'fill-app-accent'}
            />
          ) : null}
        </svg>
        <span className="shrink-0 tabular-nums text-xs text-app-muted">
          {t('forum.goalPercent', { percent: String(paidShown ? paid : percent) })}
        </span>
      </div>
      {state === 'collecting' ? (
        <p className="text-sm tabular-nums lining-nums text-app-fg">
          <span className="font-medium">{collected}</span>{' '}
          <span className="text-app-muted">{t('forum.loan.lentOf', { goal })}</span>
        </p>
      ) : (
        <p
          className={`flex items-center gap-1.5 text-sm font-medium ${
            state === 'repaid' ? 'text-app-success' : 'text-app-fg'
          }`}
        >
          {state === 'repaid' ? (
            <CircleCheck aria-hidden="true" className="h-4 w-4 shrink-0" />
          ) : null}
          {t(
            state === 'repaid'
              ? 'forum.loan.repaid'
              : state === 'repaying'
                ? 'forum.loan.fundedRepaying'
                : 'forum.loan.funded',
          )}
        </p>
      )}
      {canLend || ledgerLink ? (
        <div className="mt-1 flex items-center justify-between gap-3">
          {ledgerLink ? (
            <Link
              href={`/messages/${encodeURIComponent(messageId)}/repayment-list`}
              onClick={(event) => {
                event.stopPropagation();
              }}
              className="text-xs font-medium text-app-fg underline decoration-app-border underline-offset-2"
            >
              {t('forum.creditList')}
            </Link>
          ) : (
            <span />
          )}
          {canLend ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              icon={<HandCoins aria-hidden="true" className="h-4 w-4" />}
              onClick={(event) => {
                event.stopPropagation();
                onLend();
              }}
            >
              {t('forum.loan.lend')}
            </Button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
