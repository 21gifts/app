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
    <div className="mt-3 flex flex-col gap-3">
      <section aria-label={t('forum.creditGiven')}>
        <h3 className="text-xs font-medium text-app-muted">{t('forum.creditGiven')}</h3>
        {ledger.givers.length === 0 ? (
          <p className="text-sm text-app-fg">{t('forum.creditNoneYet')}</p>
        ) : (
          <ul className="mt-1 flex flex-col gap-1">
            {ledger.givers.map((giver) => (
              <li
                key={giver.accountId}
                className="flex items-baseline justify-between gap-3 text-sm text-app-fg"
              >
                <span>{giverLabel(giver.name, giver.username, giver.accountId)}</span>
                <span className="shrink-0 tabular-nums">
                  {fiat !== null && giver.givenAmount !== null
                    ? formatFiatDisplay(giver.givenAmount, fiat, numberFormat)
                    : formatBitcoin(giver.givenSats, numberFormat)}
                </span>
              </li>
            ))}
          </ul>
        )}
        {ledger.unassignedSats > 0 ? (
          <p className="mt-1 text-xs text-app-muted">
            {t('forum.creditUnassigned', {
              amount: formatBitcoin(ledger.unassignedSats, numberFormat),
            })}
          </p>
        ) : null}
      </section>
      <section aria-label={t('forum.creditBack')}>
        <h3 className="text-xs font-medium text-app-muted">{t('forum.creditBack')}</h3>
        <p className="mt-1 text-xs text-app-muted">{t('forum.creditBackHow')}</p>
        {ledger.fundedAt === null ? (
          <p className="mt-1 text-xs text-app-muted">{t('forum.creditBackOpen')}</p>
        ) : null}
        {fiat !== null ? (
          <p className="mt-1 text-xs text-app-muted">{t('forum.creditFiatHow')}</p>
        ) : null}
        <div className="mt-2 flex max-h-80 flex-col gap-2 overflow-y-auto">
          {groupsOf(ledger.repayments).map((group) => (
            <div key={group.dayIndex}>
              <p className="text-xs text-app-muted">
                {group.dueOn === null
                  ? t('forum.creditDay', { day: String(group.dayIndex + 1) })
                  : formatUtcDay(group.dueOn, locale)}
                <span aria-hidden="true"> · </span>
                {t('forum.creditVia')}
              </p>
              <ul className="flex flex-col gap-1">
                {group.rows.map((row) => (
                  <li
                    key={`${row.dayIndex}:${row.accountId}`}
                    className="flex items-baseline justify-between gap-3 text-sm text-app-fg"
                  >
                    <span>{giverLabel(row.name, row.username, row.accountId)}</span>
                    <span className="shrink-0 text-right tabular-nums">
                      {rowAmount(row, fiat, numberFormat)}
                      <span aria-hidden="true"> · </span>
                      {t(statusKey(row.status))}
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
