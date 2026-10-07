'use client';

import { ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useState, type ReactElement, type ReactNode } from 'react';
import { useFiatPreference } from '@/components/FiatPreferenceProvider';
import { ForumModeSelect } from '@/components/ForumModeSelect';
import { useTranslations } from '@/components/LocaleProvider';
import { useNumberFormat } from '@/components/NumberFormatProvider';
import { preferredFiatSuffix } from '@/components/PreferredFiatSuffix';
import { Button, SegmentedControl } from '@/components/ui';
import { useCursorPages } from '@/hooks/useCursorPages';
import { useLatestRateDayState } from '@/hooks/useLatestRateDay';
import { fetchTeamMemberWallet } from '@/lib/api';
import {
  TEAM_PAYMENT_CATEGORIES,
  TEAM_WALLET_PERIODS,
  type TeamPaymentCategory,
  type TeamWallet,
  type TeamWalletPayment,
  type TeamWalletPeriod,
} from '@/lib/api-types';
import { formatForumTimeFromMs } from '@/lib/forum-time';
import type { MessageKey } from '@/lib/messages';
import type { NumberFormatStyle } from '@/lib/number-format';
import { formatBitcoin, type FiatCode, type FiatRateDay } from '@/lib/stats-money';

/** Categories whose outgoing payments stay inside the community. */
const INSIDE: readonly TeamPaymentCategory[] = ['member', 'shop', 'platform', 'gift'];

/** Categories whose outgoing payments leave the community. */
const OUTSIDE: readonly TeamPaymentCategory[] = ['outside_lightning', 'onchain'];

/** Catalog key of each payment category. */
const CATEGORY_LABEL: Record<TeamPaymentCategory, MessageKey> = {
  member: 'team.category.member',
  shop: 'team.category.shop',
  platform: 'team.category.platform',
  gift: 'team.category.gift',
  outside_lightning: 'team.category.outside_lightning',
  onchain: 'team.category.onchain',
  unknown: 'team.category.unknown',
};

/** Catalog key of each summary period. */
const PERIOD_LABEL: Record<TeamWalletPeriod, MessageKey> = {
  '7': 'team.wallet.period.7',
  '30': 'team.wallet.period.30',
  '90': 'team.wallet.period.90',
  all: 'team.wallet.period.all',
};

/** Category filter value: one category or every category. */
type CategoryFilter = TeamPaymentCategory | 'all';

/** Direction filter value. */
type DirectionFilter = 'all' | 'in' | 'out';

/** Props for {@link TeamMemberWallet}. */
export interface TeamMemberWalletProps {
  /** Bearer session of the staff viewer. */
  session: string;
  /** Member account id. */
  accountId: string;
}

/**
 * Bitcoin amount with the visitor's default fiat beside it.
 *
 * @param props - Sats, rate day, fiat code, and grouping style.
 * @returns The amount spans.
 */
function Amount(props: {
  sats: number;
  rateDay: FiatRateDay | null;
  fiat: FiatCode;
  numberFormat: NumberFormatStyle;
}): ReactElement {
  const { sats, rateDay, fiat, numberFormat } = props;
  return (
    <span className="tabular-nums lining-nums">
      <span>{formatBitcoin(sats, numberFormat)}</span>
      {preferredFiatSuffix(sats, rateDay, fiat, numberFormat)}
    </span>
  );
}

/**
 * One summary tile: a small label over a value.
 *
 * @param props - Label and value.
 * @returns The tile.
 */
function SummaryTile(props: { label: string; children: ReactNode }): ReactElement {
  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-2xl border border-app-border bg-app-card-muted px-4 py-3">
      <dt className="text-xs text-app-subtle">{props.label}</dt>
      <dd className="text-sm font-medium text-app-fg">{props.children}</dd>
    </div>
  );
}

/**
 * Sum of outgoing sats over some categories of the summary.
 *
 * @param summary - Period summary.
 * @param categories - Categories to add.
 * @returns Whole sats.
 */
function outSum(
  summary: TeamWallet['summary'],
  categories: readonly TeamPaymentCategory[],
): number {
  return summary.categories
    .filter((row) => categories.includes(row.category))
    .reduce((total, row) => total + row.outSats, 0);
}

/**
 * Staff view of one member's wallet: the latest reported balance, a summary
 * over 7, 30, or 90 days or all time, and the payments newest first.
 *
 * Fetches {@link fetchTeamMemberWallet} for the chosen period, direction, and
 * category; every change starts again from the first page, and the next page
 * loads when the end of the list is in view. The summary shows received,
 * sent, and fees, the share of sent bitcoin that stayed in the community
 * (member, shop, 21.gifts, gift) and the share that left it (outside
 * 21.gifts, Bitcoin address), and the sent amount per category. Every
 * bitcoin amount shows the default fiat beside it. A payment names its
 * counterparty: a member links to `/members/{id}`, anything else shows the
 * destination the wallet reported. A 403 shows the forbidden sentence.
 *
 * @param props - See {@link TeamMemberWalletProps}.
 * @returns The wallet tab body.
 */
export function TeamMemberWallet(props: TeamMemberWalletProps): ReactElement {
  const { session, accountId } = props;
  const { t, locale } = useTranslations();
  const { numberFormat } = useNumberFormat();
  const { fiat } = useFiatPreference();
  const { rateDay, settled } = useLatestRateDayState();
  const [period, setPeriod] = useState<TeamWalletPeriod>('30');
  const [direction, setDirection] = useState<DirectionFilter>('all');
  const [category, setCategory] = useState<CategoryFilter>('all');

  const load = useCallback(
    (before: string | null): Promise<TeamWallet | null> =>
      fetchTeamMemberWallet(session, accountId, {
        period,
        category: category === 'all' ? null : category,
        direction: direction === 'all' ? null : direction,
        before,
      }),
    [session, accountId, period, category, direction],
  );
  const { status, pages, hasMore, retry, sentinelRef } = useCursorPages(
    load,
    `${accountId}:${period}:${direction}:${category}`,
  );

  if (status === 'forbidden') {
    return <p className="text-center text-sm text-app-muted">{t('moderate.forbidden')}</p>;
  }

  const amount = (sats: number): ReactElement => (
    <Amount sats={sats} rateDay={rateDay} fiat={fiat} numberFormat={numberFormat} />
  );
  // An amount is not shown before the rate fetch settles, so it never shows
  // without its fiat while that fiat is still on the way.
  const first = settled ? pages[0] : undefined;
  const payments: TeamWalletPayment[] = settled ? pages.flatMap((page) => page.payments) : [];
  const percent = new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 0 });
  const unnamed = t('moderate.unnamed');

  const errorBlock = (
    <>
      <p role="alert" className="text-center text-sm text-app-danger">
        {t('team.wallet.error')}
      </p>
      <Button type="button" variant="secondary" onClick={retry}>
        {t('moderate.retry')}
      </Button>
    </>
  );

  let overview: ReactElement | null = null;
  if (first !== undefined) {
    const { balance, summary } = first;
    const sentTotal = summary.outSats;
    const sentByCategory = summary.categories.filter((row) => row.outSats > 0);
    overview = (
      <>
        <section
          aria-label={t('team.wallet.balance')}
          className="flex w-full flex-col items-center gap-1"
        >
          <h2 className="text-center text-xs tracking-widest text-app-subtle uppercase">
            {t('team.wallet.balance')}
          </h2>
          {balance === null ? (
            <p className="text-center text-sm text-app-muted">{t('team.wallet.noReport')}</p>
          ) : (
            <>
              <p className="text-center text-2xl font-semibold text-app-fg">
                {amount(balance.balanceSats)}
              </p>
              <p className="text-center text-xs text-app-subtle">
                {t('team.wallet.syncedAt', {
                  time: formatForumTimeFromMs(balance.syncedAt, locale),
                })}
              </p>
            </>
          )}
        </section>
        <section aria-label={t('team.wallet.summaryLabel')} className="flex w-full flex-col gap-3">
          <dl className="grid w-full grid-cols-1 gap-2 sm:grid-cols-3">
            <SummaryTile label={t('team.wallet.in')}>{amount(summary.inSats)}</SummaryTile>
            <SummaryTile label={t('team.wallet.out')}>{amount(summary.outSats)}</SummaryTile>
            <SummaryTile label={t('team.wallet.fees')}>{amount(summary.feeSats)}</SummaryTile>
          </dl>
          {sentTotal === 0 ? (
            <p className="text-center text-sm text-app-muted">{t('team.wallet.shareNone')}</p>
          ) : (
            <>
              <dl className="grid w-full grid-cols-2 gap-2">
                <SummaryTile label={t('team.wallet.inside')}>
                  {percent.format(outSum(summary, INSIDE) / sentTotal)}
                </SummaryTile>
                <SummaryTile label={t('team.wallet.outside')}>
                  {percent.format(outSum(summary, OUTSIDE) / sentTotal)}
                </SummaryTile>
              </dl>
              <h3 className="text-xs tracking-widest text-app-subtle uppercase">
                {t('team.wallet.byCategory')}
              </h3>
              <ul className="flex w-full flex-col gap-1">
                {sentByCategory.map((row) => (
                  <li
                    key={row.category}
                    className="flex w-full flex-wrap items-baseline justify-between gap-x-3 text-sm"
                  >
                    <span className="text-app-fg">{t(CATEGORY_LABEL[row.category])}</span>
                    <span className="text-app-fg">{amount(row.outSats)}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      </>
    );
  }

  let list: ReactElement;
  if (status === 'error' && pages.length === 0) {
    list = errorBlock;
  } else if (status === 'loading' || !settled) {
    list = <p className="text-center text-sm text-app-muted">{t('moderate.loading')}</p>;
  } else if (payments.length === 0 && !hasMore) {
    list = <p className="text-center text-sm text-app-muted">{t('team.wallet.empty')}</p>;
  } else {
    list = (
      <>
        <ul className="flex w-full flex-col gap-2">
          {payments.map((payment) => {
            const received = payment.direction === 'in';
            const Icon = received ? ArrowDownLeft : ArrowUpRight;
            const counterpartyName =
              payment.counterpartyName !== null &&
              payment.counterpartyName !== undefined &&
              payment.counterpartyName !== ''
                ? payment.counterpartyName
                : unnamed;
            const counterpartyKey = received ? 'team.wallet.from' : 'team.wallet.to';
            const notes = [payment.description, payment.lnurlComment].filter(
              (note): note is string => note !== null && note !== undefined && note !== '',
            );
            return (
              <li
                key={payment.id}
                className="flex w-full items-start gap-3 rounded-2xl border border-app-border bg-app-card-muted px-4 py-3"
              >
                <Icon aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-app-muted" />
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                    <span className="text-sm font-medium text-app-fg">
                      {received ? t('wallet.received') : t('wallet.sent')}
                      <span className="text-app-subtle">
                        {' · '}
                        {t(CATEGORY_LABEL[payment.category])}
                      </span>
                      {payment.status === 'completed' ? null : (
                        <span className="text-app-subtle">
                          {' · '}
                          {payment.status === 'pending' ? t('wallet.pending') : t('wallet.failed')}
                        </span>
                      )}
                    </span>
                    <span className="text-sm text-app-fg">{amount(payment.amountSats)}</span>
                  </div>
                  {payment.feeSats === null ||
                  payment.feeSats === undefined ||
                  payment.feeSats === 0 ? null : (
                    <span className="text-xs text-app-subtle">
                      {t('team.wallet.fee')} {amount(payment.feeSats)}
                    </span>
                  )}
                  {payment.counterpartyAccountId === null ||
                  payment.counterpartyAccountId === undefined ? (
                    payment.destination === null ||
                    payment.destination === undefined ||
                    payment.destination === '' ? null : (
                      <span className="break-all text-xs text-app-muted">
                        {t(counterpartyKey, { name: payment.destination })}
                      </span>
                    )
                  ) : (
                    <Link
                      href={`/members/${encodeURIComponent(payment.counterpartyAccountId)}`}
                      className="text-xs text-app-fg underline underline-offset-2"
                    >
                      {t(counterpartyKey, { name: counterpartyName })}
                    </Link>
                  )}
                  <time
                    dateTime={new Date(payment.timestamp).toISOString()}
                    className="text-xs text-app-subtle"
                  >
                    {formatForumTimeFromMs(payment.timestamp, locale)}
                  </time>
                  {notes.map((note, index) => (
                    <p key={index} className="break-words text-sm text-app-muted">
                      {note}
                    </p>
                  ))}
                </div>
              </li>
            );
          })}
          {hasMore ? <li ref={sentinelRef} aria-hidden="true" className="h-px w-full" /> : null}
        </ul>
        {status === 'error' ? errorBlock : null}
      </>
    );
  }

  return (
    <div className="flex w-full flex-col items-center gap-6">
      {overview}
      <SegmentedControl
        tone="neutral"
        ariaLabel={t('team.wallet.periodLabel')}
        value={period}
        options={TEAM_WALLET_PERIODS.map((value) => ({ value, label: t(PERIOD_LABEL[value]) }))}
        onChange={setPeriod}
      />
      <section
        aria-label={t('wallet.historyHeading')}
        className="flex w-full flex-col items-center gap-3"
      >
        <h2 className="text-center text-xs tracking-widest text-app-subtle uppercase">
          {t('wallet.historyHeading')}
        </h2>
        <SegmentedControl
          tone="neutral"
          ariaLabel={t('team.wallet.directionLabel')}
          value={direction}
          options={[
            { value: 'all', label: t('team.wallet.direction.all') },
            { value: 'in', label: t('wallet.received') },
            { value: 'out', label: t('wallet.sent') },
          ]}
          onChange={setDirection}
        />
        <div className="w-full">
          <ForumModeSelect<CategoryFilter>
            ariaLabel={t('team.wallet.categoryLabel')}
            value={category}
            options={[
              { value: 'all', label: t('team.wallet.category.all') },
              ...TEAM_PAYMENT_CATEGORIES.map((value) => ({
                value,
                label: t(CATEGORY_LABEL[value]),
              })),
            ]}
            onChange={setCategory}
          />
        </div>
        {list}
      </section>
    </div>
  );
}
