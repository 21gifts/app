'use client';

import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState, type ReactElement } from 'react';
import { useTranslations } from '@/components/LocaleProvider';
import { Button, Card } from '@/components/ui';
import { fetchFundingPayoutDays } from '@/lib/api';
import type { FundingPayoutDays } from '@/lib/api-types';
import type { MessageKey } from '@/lib/messages';
import { roleAtLeast } from '@/lib/roles';
import { useAuthStore } from '@/stores/auth-store';

/** Cell fill, legend catalog key, and cell aria-label catalog key. */
const PAYOUT_STATUS: Record<
  'blocked' | 'missed' | 'paid',
  { swatch: string; legend: MessageKey; cell: MessageKey }
> = {
  blocked: {
    swatch: 'bg-[#111111]',
    legend: 'moderate.payouts.legend.blocked',
    cell: 'moderate.payouts.cell.blocked',
  },
  missed: {
    swatch: 'bg-paper',
    legend: 'moderate.payouts.legend.missed',
    cell: 'moderate.payouts.cell.missed',
  },
  paid: {
    swatch: 'bg-[#15803d]',
    legend: 'moderate.payouts.legend.paid',
    cell: 'moderate.payouts.cell.paid',
  },
};

/** Amber fill for a welcome gift. */
const WELCOME_SWATCH = 'bg-[#d97706]';

/**
 * Display name for a payout row, or the unnamed fallback.
 *
 * @param name - Api display name, which may be null or empty.
 * @param unnamed - Localized unnamed copy.
 * @returns A non-empty label.
 */
function personLabel(name: string | null, unnamed: string): string {
  return name !== null && name !== '' ? name : unnamed;
}

/**
 * Formats a UTC calendar day for a column header (`D/M` or locale equivalent).
 *
 * @param day - UTC `YYYY-MM-DD`.
 * @param locale - Active UI locale.
 * @returns Locale date in the UTC zone.
 */
function formatPayoutDay(day: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${day}T00:00:00.000Z`));
}

/**
 * Signed-in staff table of daily-grant payouts per person for seven UTC days.
 *
 * Moderators fetch {@link fetchFundingPayoutDays} and see name plus seven
 * color cells (blocked / missed / paid / welcome; split when both were paid
 * the same day). Other signed-in visitors see a short forbidden message and
 * no table. Renders nothing without a session. In-card back goes to the
 * moderation hub. Moderator stipends are not in this table. Welcome gifts are
 * in the table.
 *
 * @returns The payouts card, forbidden copy, or `null` without a session.
 */
export function FundingPayoutsScreen(): ReactElement | null {
  const { t, locale } = useTranslations();
  const session = useAuthStore((state) => state.session);
  const account = useAuthStore((state) => state.account);
  const staff = roleAtLeast(account?.role, 'moderator');
  const [payouts, setPayouts] = useState<FundingPayoutDays | null>(null);
  const [payoutsError, setPayoutsError] = useState(false);
  const [payoutsAttempt, setPayoutsAttempt] = useState(0);

  useEffect(() => {
    if (session === null || !staff) {
      return;
    }
    let cancelled = false;
    setPayoutsError(false);
    void (async () => {
      try {
        const next = await fetchFundingPayoutDays(session);
        if (cancelled) {
          return;
        }
        setPayouts(next);
      } catch {
        if (cancelled) {
          return;
        }
        setPayouts(null);
        setPayoutsError(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session, staff, payoutsAttempt]);

  if (session === null) {
    return null;
  }

  const heading = (
    <div className="flex w-full items-center gap-2">
      <Link
        href="/moderate"
        aria-label={t('moderate.heading')}
        className="inline-flex h-11 w-11 items-center justify-center rounded-full text-app-muted transition hover:bg-app-hover hover:text-app-fg"
      >
        <ArrowLeft aria-hidden="true" className="h-5 w-5" />
      </Link>
      <div className="min-w-0 flex-1">
        <h1 className="text-center text-2xl font-semibold tracking-tight text-app-fg sm:text-3xl">
          {t('moderate.payouts.heading')}
        </h1>
      </div>
    </div>
  );

  if (!staff) {
    return (
      <Card maxWidth="xl" surface={false}>
        {heading}
        <p className="text-center text-sm text-app-muted">{t('moderate.forbidden')}</p>
      </Card>
    );
  }

  const unnamed = t('moderate.unnamed');

  let body: ReactElement;
  if (payoutsError) {
    body = (
      <>
        <p role="alert" className="text-center text-sm text-app-danger">
          {t('moderate.payouts.error')}
        </p>
        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            setPayoutsAttempt((n) => n + 1);
          }}
        >
          {t('moderate.retry')}
        </Button>
      </>
    );
  } else if (payouts === null) {
    body = <p className="text-center text-sm text-app-muted">{t('moderate.loading')}</p>;
  } else if (payouts.rows.length === 0) {
    body = <p className="text-center text-sm text-app-muted">{t('moderate.payouts.empty')}</p>;
  } else {
    const { days, rows } = payouts;
    body = (
      <>
        <p className="text-sm text-app-muted">{t('moderate.payouts.lead')}</p>
        <ul className="flex flex-wrap items-center justify-center gap-3">
          {(['blocked', 'missed', 'paid'] as const).map((status) => {
            const meta = PAYOUT_STATUS[status];
            return (
              <li key={status} className="flex items-center gap-2">
                <span
                  className={`inline-block h-4 w-4 border border-app-border ${meta.swatch}`}
                  aria-hidden="true"
                />
                <span className="text-sm text-app-fg">{t(meta.legend)}</span>
              </li>
            );
          })}
          <li className="flex items-center gap-2">
            <span
              className={`inline-block h-4 w-4 border border-app-border ${WELCOME_SWATCH}`}
              aria-hidden="true"
            />
            <span className="text-sm text-app-fg">{t('moderate.payouts.legend.welcome')}</span>
          </li>
        </ul>
        <div className="w-full">
          <table
            aria-label={t('moderate.payouts.heading')}
            className="w-full table-fixed border-collapse text-sm"
          >
            <thead>
              <tr>
                <th
                  scope="col"
                  className="w-[34%] overflow-hidden bg-app-card px-2 py-2 text-left font-medium text-app-fg"
                >
                  {t('moderate.payouts.column.name')}
                </th>
                {days.map((day, index) => {
                  const formatted = formatPayoutDay(day, locale);
                  const isToday = index === days.length - 1;
                  const todayLabel = t('moderate.payouts.today');
                  return (
                    <th
                      key={day}
                      scope="col"
                      className="overflow-hidden px-0 py-2 text-center text-[10px] font-medium leading-tight text-app-fg sm:text-xs"
                      {...(isToday ? { 'aria-label': `${formatted}, ${todayLabel}` } : {})}
                    >
                      <span className="block">{formatted}</span>
                      {isToday ? (
                        <span className="block text-xs font-normal">{todayLabel}</span>
                      ) : null}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rowIndex) => {
                const label = personLabel(row.name, unnamed);
                return (
                  <tr key={`${row.accountId ?? 'none'}:${rowIndex}`}>
                    <th
                      scope="row"
                      className="overflow-hidden bg-app-card px-2 py-2 text-left font-medium text-app-fg"
                    >
                      {row.accountId !== null ? (
                        <Link
                          href={`/members/${row.accountId}`}
                          className="block truncate text-sm font-medium text-app-fg underline underline-offset-2"
                        >
                          {label}
                        </Link>
                      ) : (
                        <span className="block truncate">{label}</span>
                      )}
                    </th>
                    {row.days.map((status, dayIndex) => {
                      const isWelcome = row.welcome?.[dayIndex] === true;
                      const day = days[dayIndex] as string;
                      const date = formatPayoutDay(day, locale);
                      if (status === 'paid' && isWelcome) {
                        return (
                          <td key={`${rowIndex}:${dayIndex}`} className="h-10 p-0">
                            <span
                              className="flex h-full min-h-10 w-full border border-app-border"
                              aria-label={t('moderate.payouts.cell.both', {
                                name: label,
                                date,
                              })}
                            >
                              <span
                                className="h-full min-h-10 w-1/2 bg-[#15803d]"
                                aria-hidden="true"
                              />
                              <span
                                className="h-full min-h-10 w-1/2 bg-[#d97706]"
                                aria-hidden="true"
                              />
                              <span className="sr-only">{t('moderate.payouts.legend.paid')}</span>
                            </span>
                          </td>
                        );
                      }
                      if (isWelcome) {
                        return (
                          <td key={`${rowIndex}:${dayIndex}`} className="h-10 p-0">
                            <span
                              className={`block h-full min-h-10 w-full border border-app-border ${WELCOME_SWATCH}`}
                              aria-label={t('moderate.payouts.cell.welcome', {
                                name: label,
                                date,
                              })}
                            >
                              <span className="sr-only">
                                {t('moderate.payouts.legend.welcome')}
                              </span>
                            </span>
                          </td>
                        );
                      }
                      const meta = PAYOUT_STATUS[status];
                      return (
                        <td key={`${rowIndex}:${dayIndex}`} className="h-10 p-0">
                          <span
                            className={`block h-full min-h-10 w-full border border-app-border ${meta.swatch}`}
                            aria-label={t(meta.cell, { name: label, date })}
                          >
                            <span className="sr-only">{t(meta.legend)}</span>
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </>
    );
  }

  return (
    <Card maxWidth="xl" surface={false}>
      {heading}
      {body}
    </Card>
  );
}
