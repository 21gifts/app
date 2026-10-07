'use client';

import { useCallback, type ReactElement } from 'react';
import { useFiatPreference } from '@/components/FiatPreferenceProvider';
import { useTranslations } from '@/components/LocaleProvider';
import { useNumberFormat } from '@/components/NumberFormatProvider';
import { preferredFiatSuffix } from '@/components/PreferredFiatSuffix';
import { Button } from '@/components/ui';
import { useCursorPages } from '@/hooks/useCursorPages';
import { useLatestRateDayState } from '@/hooks/useLatestRateDay';
import { fetchTeamMemberEvents } from '@/lib/api';
import type { TeamEvents } from '@/lib/api-types';
import { formatForumTimeFromMs } from '@/lib/forum-time';
import type { MessageKey } from '@/lib/messages';
import { formatBitcoin } from '@/lib/stats-money';

/** Catalog key of each event name the app records. */
const EVENT_LABEL: Record<string, MessageKey> = {
  screen_view: 'team.event.screen_view',
  post_created: 'team.event.post_created',
  reply_created: 'team.event.reply_created',
  gift_sent: 'team.event.gift_sent',
  payment_sent: 'team.event.payment_sent',
  payment_received_seen: 'team.event.payment_received_seen',
  pos_charge_created: 'team.event.pos_charge_created',
  pos_charge_paid_seen: 'team.event.pos_charge_paid_seen',
  wallet_unlocked: 'team.event.wallet_unlocked',
  wallet_locked: 'team.event.wallet_locked',
  search: 'team.event.search',
  shop_opened: 'team.event.shop_opened',
  profile_opened: 'team.event.profile_opened',
  login: 'team.event.login',
  signup_completed: 'team.event.signup_completed',
};

/** Kind of an event value the activity row shows. */
type PropKind = 'amount' | 'count' | 'reference' | 'search';

/** Catalog key of each shown value kind. */
const PROP_LABEL: Record<PropKind, MessageKey> = {
  amount: 'team.prop.amount',
  count: 'team.prop.count',
  reference: 'team.prop.reference',
  search: 'team.prop.search',
};

/**
 * The event values an activity row shows, each with a plain-word kind: a
 * whole number under a name ending in `Sats` is an amount, a whole number
 * under `count` or a name ending in `Count` is a count, a string or number
 * under `id` or a name ending in `Id` is a reference, and a string under
 * `query` or `term` is the search text. Every other value is left out, so
 * no field name reaches the screen.
 *
 * @param props - Flat event values from the api.
 * @returns The shown values in the api's order.
 */
function shownProps(
  props: Record<string, string | number | boolean | null>,
): { key: string; kind: PropKind; value: string | number }[] {
  const shown: { key: string; kind: PropKind; value: string | number }[] = [];
  for (const [key, value] of Object.entries(props)) {
    if (typeof value === 'number' && Number.isInteger(value) && value >= 0) {
      if (key.endsWith('Sats')) {
        shown.push({ key, kind: 'amount', value });
        continue;
      }
      if (key === 'count' || key.endsWith('Count')) {
        shown.push({ key, kind: 'count', value });
        continue;
      }
    }
    if (
      (typeof value === 'string' || typeof value === 'number') &&
      (key === 'id' || key.endsWith('Id'))
    ) {
      shown.push({ key, kind: 'reference', value });
      continue;
    }
    if (typeof value === 'string' && (key === 'query' || key === 'term')) {
      shown.push({ key, kind: 'search', value });
    }
  }
  return shown;
}

/** Props for {@link TeamMemberEvents}. */
export interface TeamMemberEventsProps {
  /** Bearer session of the staff viewer. */
  session: string;
  /** Member account id. */
  accountId: string;
}

/**
 * Staff view of one member's interaction events, newest first.
 *
 * Fetches {@link fetchTeamMemberEvents}; the next page loads when the end of
 * the list is in view. Each row shows what the member did in plain words
 * (the raw name when the app does not know it), the time, the page path,
 * and the amounts, counts, references, and search text the event carried,
 * each under a plain-word label (other values are left out). An amount
 * shows the default fiat beside it. A 403 shows the forbidden sentence.
 *
 * @param props - See {@link TeamMemberEventsProps}.
 * @returns The activity tab body.
 */
export function TeamMemberEvents(props: TeamMemberEventsProps): ReactElement {
  const { session, accountId } = props;
  const { t, locale } = useTranslations();
  const { numberFormat } = useNumberFormat();
  const { fiat } = useFiatPreference();
  const { rateDay, settled } = useLatestRateDayState();
  const load = useCallback(
    (before: string | null): Promise<TeamEvents | null> =>
      fetchTeamMemberEvents(session, accountId, before),
    [session, accountId],
  );
  const { status, pages, hasMore, retry, sentinelRef } = useCursorPages(load, accountId);

  if (status === 'forbidden') {
    return <p className="text-center text-sm text-app-muted">{t('moderate.forbidden')}</p>;
  }

  const errorBlock = (
    <>
      <p role="alert" className="text-center text-sm text-app-danger">
        {t('team.events.error')}
      </p>
      <Button type="button" variant="secondary" onClick={retry}>
        {t('moderate.retry')}
      </Button>
    </>
  );
  const events = pages.flatMap((page) => page.events);

  let body: ReactElement;
  if (status === 'error' && pages.length === 0) {
    body = errorBlock;
  } else if (status === 'loading' || !settled) {
    // An event amount is not shown before the rate fetch settles.
    body = <p className="text-center text-sm text-app-muted">{t('moderate.loading')}</p>;
  } else if (events.length === 0 && !hasMore) {
    body = <p className="text-center text-sm text-app-muted">{t('team.events.empty')}</p>;
  } else {
    body = (
      <>
        <ul className="flex w-full flex-col gap-2">
          {events.map((event, index) => {
            const labelKey = EVENT_LABEL[event.name];
            const shown = shownProps(event.props);
            return (
              <li
                key={`${String(event.at)}:${String(index)}`}
                className="flex w-full flex-col gap-1 rounded-2xl border border-app-border bg-app-card-muted px-4 py-3"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <span className="text-sm font-medium text-app-fg">
                    {labelKey === undefined ? event.name : t(labelKey)}
                  </span>
                  <time
                    dateTime={new Date(event.at).toISOString()}
                    className="text-xs text-app-subtle"
                  >
                    {formatForumTimeFromMs(event.at, locale)}
                  </time>
                </div>
                {event.path === null || event.path === undefined || event.path === '' ? null : (
                  <span className="break-all font-mono text-xs text-app-muted">{event.path}</span>
                )}
                {shown.length === 0 ? null : (
                  <dl className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
                    {shown.map((prop) => (
                      <div key={prop.key} className="flex min-w-0 gap-1">
                        <dt className="text-app-subtle">{t(PROP_LABEL[prop.kind])}</dt>
                        <dd className="break-all text-app-fg">
                          {prop.kind === 'amount' ? (
                            <span className="tabular-nums lining-nums">
                              <span>{formatBitcoin(prop.value as number, numberFormat)}</span>
                              {preferredFiatSuffix(
                                prop.value as number,
                                rateDay,
                                fiat,
                                numberFormat,
                              )}
                            </span>
                          ) : (
                            String(prop.value)
                          )}
                        </dd>
                      </div>
                    ))}
                  </dl>
                )}
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
    <section
      aria-label={t('team.events.heading')}
      className="flex w-full flex-col items-center gap-3"
    >
      {body}
    </section>
  );
}
