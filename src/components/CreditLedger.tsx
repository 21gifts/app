'use client';

import { useEffect, useState, type ReactElement } from 'react';
import { useTranslations } from '@/components/LocaleProvider';
import { useNumberFormat } from '@/components/NumberFormatProvider';
import { getRepayment, type RepaymentLedger, type RepaymentLine } from '@/lib/api';
import type { MessageKey } from '@/lib/messages';
import type { NumberFormatStyle } from '@/lib/number-format';
import { formatBitcoin, formatFiatDisplay, type FiatCode } from '@/lib/stats-money';

/**
 * Who gave what on a credit, and who is paid back how much, when, and by Lightning.
 *
 * Renders nothing until the public ledger loads. A failed read stays blank.
 *
 * @param props - Credit note id.
 * @returns The two lists, or null.
 */
export function CreditLedger({ messageId }: { messageId: string }): ReactElement | null {
  const { t, locale } = useTranslations();
  const { numberFormat } = useNumberFormat();
  const [ledger, setLedger] = useState<RepaymentLedger | null>(null);
  useEffect(() => {
    let cancel = false;
    void getRepayment(messageId).then((row) => {
      if (!cancel) {
        setLedger(row);
      }
    });
    return () => {
      cancel = true;
    };
  }, [messageId]);
  if (ledger === null) {
    return null;
  }
  const fiat = ledger.currency === 'BTC' ? null : (ledger.currency as FiatCode);
  return (
    <div className="mt-3 rounded-xl bg-app-card-muted px-3 py-2.5">
      <section aria-label={t('forum.creditGiven')}>
        <h3 className="text-xs font-medium text-app-fg">{t('forum.creditGiven')}</h3>
        {ledger.givers.length === 0 ? (
          <p className="mt-2 text-sm text-app-fg">{t('forum.creditNoneYet')}</p>
        ) : (
          <ul className="mt-1">
            {ledger.givers.map((giver) => (
              <li
                key={giver.accountId}
                className="flex items-baseline justify-between gap-3 border-t border-app-border py-1.5 first:border-t-0"
              >
                <span className="min-w-0 text-sm text-app-fg">
                  {giverLabel(giver.name, giver.username, giver.accountId)}
                </span>
                <span className="shrink-0 text-sm tabular-nums text-app-fg">
                  {fiat !== null && giver.givenAmount !== null
                    ? formatFiatDisplay(giver.givenAmount, fiat, numberFormat)
                    : formatBitcoin(giver.givenSats, numberFormat)}
                </span>
              </li>
            ))}
          </ul>
        )}
        {ledger.unassignedSats > 0 ? (
          <p className="mt-2 text-xs text-app-muted">
            {t('forum.creditUnassigned', {
              amount: formatBitcoin(ledger.unassignedSats, numberFormat),
            })}
          </p>
        ) : null}
      </section>
      <section aria-label={t('forum.creditBack')} className="mt-3">
        <h3 className="text-xs font-medium text-app-fg">{t('forum.creditBack')}</h3>
        <p className="mt-1 text-xs text-app-muted">{t('forum.creditBackHow')}</p>
        {ledger.fundedAt === null ? (
          <p className="mt-1 text-xs text-app-muted">{t('forum.creditBackOpen')}</p>
        ) : null}
        {fiat !== null ? (
          <p className="mt-1 text-xs text-app-muted">{t('forum.creditFiatHow')}</p>
        ) : null}
        <div className="mt-1 flex max-h-80 flex-col gap-2 overflow-y-auto">
          {groupsOf(ledger.repayments).map((group) => (
            <div key={group.dayIndex}>
              <p className="text-xs font-medium text-app-fg">
                {group.dueOn === null
                  ? t('forum.creditDay', { day: String(group.dayIndex + 1) })
                  : formatUtcDay(group.dueOn, locale)}
              </p>
              <ul>
                {group.rows.map((row) => (
                  <li
                    key={`${row.dayIndex}:${row.accountId}`}
                    className="flex items-baseline justify-between gap-3 border-t border-app-border py-1.5 first:border-t-0"
                  >
                    <span className="min-w-0 text-sm text-app-fg">
                      {giverLabel(row.name, row.username, row.accountId)}
                    </span>
                    <span className="flex shrink-0 items-baseline gap-2">
                      <span className="text-sm tabular-nums text-app-fg">
                        {rowAmount(row, fiat, numberFormat)}
                      </span>
                      <span
                        className={`shrink-0 text-right text-xs font-medium ${statusClass(row.status)}`}
                      >
                        {t(statusKey(row.status))}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function giverLabel(name: string, username: string | null, accountId: string): string {
  if (name !== '' && username !== null) {
    return `${name} @${username}`;
  }
  if (name !== '') {
    return name;
  }
  if (username !== null) {
    return `@${username}`;
  }
  return accountId.slice(0, 8);
}

function statusKey(status: RepaymentLine['status']): MessageKey {
  if (status === 'paid') {
    return 'forum.creditStatusPaid';
  }
  if (status === 'due') {
    return 'forum.creditStatusDue';
  }
  return 'forum.creditStatusScheduled';
}

function statusClass(status: RepaymentLine['status']): string {
  if (status === 'paid') {
    return 'text-app-success';
  }
  if (status === 'due') {
    return 'text-app-accent';
  }
  return 'text-app-muted';
}

function rowAmount(
  row: RepaymentLine,
  fiat: FiatCode | null,
  numberFormat: NumberFormatStyle,
): string {
  if (fiat !== null && row.amount !== null) {
    const priced = formatFiatDisplay(row.amount, fiat, numberFormat);
    return row.sats === null ? priced : `${priced} · ${formatBitcoin(row.sats, numberFormat)}`;
  }
  return formatBitcoin(row.sats ?? 0, numberFormat);
}

function formatUtcDay(dueOn: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone: 'UTC',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(`${dueOn}T00:00:00Z`));
}

function groupsOf(rows: readonly RepaymentLine[]): {
  dayIndex: number;
  dueOn: string | null;
  rows: RepaymentLine[];
}[] {
  const groups: { dayIndex: number; dueOn: string | null; rows: RepaymentLine[] }[] = [];
  for (const row of rows) {
    const last = groups[groups.length - 1];
    if (last !== undefined && last.dayIndex === row.dayIndex) {
      last.rows.push(row);
    } else {
      groups.push({ dayIndex: row.dayIndex, dueOn: row.dueOn, rows: [row] });
    }
  }
  return groups;
}
