'use client';

import { useEffect, useState, type ReactElement } from 'react';
import Link from 'next/link';
import { useFiatPreference } from '@/components/FiatPreferenceProvider';
import { useTranslations } from '@/components/LocaleProvider';
import { useNumberFormat } from '@/components/NumberFormatProvider';
import { Button, Card } from '@/components/ui';
import { useSpotRate } from '@/hooks/useSpotRate';
import type { NumberFormatStyle } from '@/lib/number-format';
import { fetchOpenLoans, type OpenLoan } from '@/lib/open-loans';
import {
  formatBitcoin,
  formatFiatDisplay,
  satsToFiatAmount,
  type FiatCode,
  type FiatRateDay,
} from '@/lib/stats-money';

/**
 * Outstanding in the loan's own currency.
 *
 * Fiat stays that currency (`formatFiatDisplay`). BTC is BIP-177 ₿. When a
 * spot rate is loaded, the visitor's fiat figure sits beside the bitcoin,
 * the same join the loans card uses. Bitcoin stands alone when the spot is
 * missing. This does not price a fiat remainder in bitcoin.
 *
 * @param loan - One open loan.
 * @param numberFormat - Visitor grouping style.
 * @param fiat - Visitor preferred fiat, used only beside bitcoin.
 * @param rateDay - Current spot, or `null` while none is loaded.
 * @returns The outstanding cell text.
 */
function openLoanAmount(
  loan: OpenLoan,
  numberFormat: NumberFormatStyle,
  fiat: FiatCode,
  rateDay: FiatRateDay | null,
): string {
  if (loan.currency === 'BTC') {
    const bitcoin = formatBitcoin(loan.outstanding, numberFormat);
    const spot = satsToFiatAmount(loan.outstanding, rateDay, fiat);
    if (spot === null) {
      return bitcoin;
    }
    return `${bitcoin} · ${formatFiatDisplay(spot, fiat, numberFormat)}`;
  }
  return formatFiatDisplay(loan.outstanding, loan.currency, numberFormat);
}

/**
 * Public list of open loans from `GET /loans/open`, in api order.
 *
 * Overdue is the api boolean, not a date computed here. Yes and No reuse
 * `funding.review.yes` / `funding.review.no`. Try again reuses `forum.retry`.
 *
 * @returns The heading plus the loading, error, empty, or table state.
 */
export function OpenLoansScreen(): ReactElement {
  const { t } = useTranslations();
  const { numberFormat } = useNumberFormat();
  const { fiat } = useFiatPreference();
  const rateDay = useSpotRate();
  const [loans, setLoans] = useState<OpenLoan[] | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setError(false);
    setLoans(null);
    void (async (): Promise<void> => {
      try {
        const next = await fetchOpenLoans();
        if (cancelled) {
          return;
        }
        setLoans(next);
      } catch {
        if (cancelled) {
          return;
        }
        setError(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  let body: ReactElement;
  if (error) {
    body = (
      <div className="flex w-full flex-col items-center gap-3">
        <p role="alert" className="text-center text-sm text-app-danger">
          {t('loans.openError')}
        </p>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => {
            setAttempt((current) => current + 1);
          }}
        >
          {t('forum.retry')}
        </Button>
      </div>
    );
  } else if (loans === null) {
    body = <p className="w-full text-center text-sm text-app-muted">{t('loans.openLoading')}</p>;
  } else if (loans.length === 0) {
    body = <p className="w-full text-center text-sm text-app-fg">{t('loans.openEmpty')}</p>;
  } else {
    body = (
      <div className="w-full min-w-0 max-w-full self-stretch">
        <table className="w-full table-fixed text-left text-sm text-app-fg">
          <thead>
            <tr className="text-xs text-app-muted">
              <th
                scope="col"
                className="w-[46%] min-w-0 break-words py-1 pr-1 align-top font-medium sm:pr-2"
              >
                {t('loans.openBorrower')}
              </th>
              <th
                scope="col"
                className="w-[34%] min-w-0 break-words py-1 pr-1 text-right align-top font-medium sm:pr-2"
              >
                {t('loans.openOutstanding')}
              </th>
              <th
                scope="col"
                className="w-[20%] min-w-0 break-words py-1 text-right align-top font-medium"
              >
                {t('loans.openOverdue')}
              </th>
            </tr>
          </thead>
          <tbody>
            {loans.map((loan, index) => (
              <tr
                key={`${loan.messageId}:${index}`}
                data-overdue={loan.overdue ? 'true' : 'false'}
                className={
                  loan.overdue
                    ? 'border-t border-app-border bg-app-danger/10'
                    : 'border-t border-app-border'
                }
              >
                <td className="min-w-0 break-words py-1.5 pr-1 align-top sm:pr-2">
                  <Link
                    href={`/members/${encodeURIComponent(loan.accountId)}`}
                    className="font-medium text-app-fg underline underline-offset-2"
                  >
                    {loan.name}
                  </Link>
                </td>
                <td
                  className="min-w-0 break-words whitespace-normal py-1.5 pr-1 text-right align-top tabular-nums sm:pr-2"
                >
                  {openLoanAmount(loan, numberFormat, fiat, rateDay)}
                </td>
                <td
                  className={
                    loan.overdue
                      ? 'min-w-0 break-words py-1.5 text-right align-top font-medium text-app-danger'
                      : 'min-w-0 break-words py-1.5 text-right align-top'
                  }
                >
                  {loan.overdue ? t('funding.review.yes') : t('funding.review.no')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <Card maxWidth="xl" surface={false}>
      <h1
        className="w-full text-center text-2xl font-semibold tracking-tight text-app-fg sm:text-3xl"
      >
        {t('loans.openHeading')}
      </h1>
      {body}
    </Card>
  );
}
