'use client';

import Link from 'next/link';
import { useMemo, type ReactElement } from 'react';
import { useTranslations } from '@/components/LocaleProvider';
import { Button, Card } from '@/components/ui';
import { useCursorPages } from '@/hooks/useCursorPages';
import { fetchTeamAudit } from '@/lib/api';
import type { TeamAudit } from '@/lib/api-types';
import { formatForumTimeFromMs } from '@/lib/forum-time';
import { roleAtLeast } from '@/lib/roles';
import { useAuthStore } from '@/stores/auth-store';

/**
 * Signed-in access log (`/moderate/audit`): every time a team member opened
 * a member's wallet data or activity, newest first.
 *
 * Viewers at least at initiator rank fetch {@link fetchTeamAudit}; the next
 * page loads when the end of the list is in view. Each row names who opened
 * it, whose data it was (both link to `/members/{id}`), what was opened, and
 * when. The api allows founders and initiators only: a moderator shares the
 * initiator rank, so a 403 shows **This page is for founders and
 * initiators.** Lower roles see that sentence and nothing is fetched.
 * Renders nothing without a session. The page chrome owns the back; this
 * screen renders none.
 *
 * @returns The access-log card, forbidden copy, or `null` without a session.
 */
export function AccessAuditScreen(): ReactElement | null {
  const { t, locale } = useTranslations();
  const session = useAuthStore((state) => state.session);
  const account = useAuthStore((state) => state.account);
  const allowed = roleAtLeast(account?.role, 'initiator');
  const load = useMemo(
    () =>
      session === null || !allowed
        ? null
        : (before: string | null): Promise<TeamAudit | null> => fetchTeamAudit(session, before),
    [session, allowed],
  );
  const { status, pages, hasMore, retry, sentinelRef } = useCursorPages(load, 'audit');

  if (session === null) {
    return null;
  }

  const heading = (
    <h1 className="text-center text-2xl font-semibold tracking-tight text-app-fg sm:text-3xl">
      {t('team.audit.heading')}
    </h1>
  );

  if (!allowed || status === 'forbidden') {
    return (
      <Card maxWidth="xl" surface={false}>
        {heading}
        <p className="text-center text-sm text-app-muted">{t('team.audit.forbidden')}</p>
      </Card>
    );
  }

  const errorBlock = (
    <>
      <p role="alert" className="text-center text-sm text-app-danger">
        {t('team.audit.error')}
      </p>
      <Button type="button" variant="secondary" onClick={retry}>
        {t('moderate.retry')}
      </Button>
    </>
  );
  const entries = pages.flatMap((page) => page.entries);
  const unnamed = t('moderate.unnamed');
  const label = (value: string | null | undefined): string =>
    value === null || value === undefined || value === '' ? unnamed : value;

  let body: ReactElement;
  if (status === 'loading') {
    body = <p className="text-center text-sm text-app-muted">{t('moderate.loading')}</p>;
  } else if (status === 'error' && pages.length === 0) {
    body = errorBlock;
  } else if (entries.length === 0 && !hasMore) {
    body = <p className="text-center text-sm text-app-muted">{t('team.audit.empty')}</p>;
  } else {
    body = (
      <>
        <ul aria-label={t('team.audit.listLabel')} className="flex w-full flex-col gap-2">
          {entries.map((entry, index) => (
            <li
              key={`${entry.viewerAccountId}:${entry.memberAccountId}:${String(entry.at)}:${String(index)}`}
              className="flex w-full flex-col gap-1 rounded-2xl border border-app-border bg-app-card-muted px-4 py-3"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                <span className="text-sm font-medium text-app-fg">
                  {entry.what === 'wallet'
                    ? t('team.audit.what.wallet')
                    : t('team.audit.what.events')}
                </span>
                <time
                  dateTime={new Date(entry.at).toISOString()}
                  className="text-xs text-app-subtle"
                >
                  {formatForumTimeFromMs(entry.at, locale)}
                </time>
              </div>
              <dl className="flex flex-col gap-1 text-sm">
                <div className="flex min-w-0 flex-wrap gap-x-2">
                  <dt className="text-app-subtle">{t('team.audit.member')}</dt>
                  <dd className="min-w-0">
                    <Link
                      href={`/members/${encodeURIComponent(entry.memberAccountId)}`}
                      className="text-app-fg underline underline-offset-2"
                    >
                      {label(entry.memberName)}
                    </Link>
                  </dd>
                </div>
                <div className="flex min-w-0 flex-wrap gap-x-2">
                  <dt className="text-app-subtle">{t('team.audit.viewer')}</dt>
                  <dd className="min-w-0">
                    <Link
                      href={`/members/${encodeURIComponent(entry.viewerAccountId)}`}
                      className="text-app-fg underline underline-offset-2"
                    >
                      {label(entry.viewerName)}
                    </Link>
                  </dd>
                </div>
              </dl>
            </li>
          ))}
          {hasMore ? <li ref={sentinelRef} aria-hidden="true" className="h-px w-full" /> : null}
        </ul>
        {status === 'error' ? errorBlock : null}
      </>
    );
  }

  return (
    <Card maxWidth="xl" surface={false}>
      {heading}
      <p className="text-sm text-app-muted">{t('team.audit.lead')}</p>
      {body}
    </Card>
  );
}
