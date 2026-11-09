'use client';

import Link from 'next/link';
import { useId, useState, type ReactElement } from 'react';
import { ForumRoleHint, ForumRoleTag } from '@/components/ForumRoleTag';
import { useTranslations } from '@/components/LocaleProvider';
import { useNumberFormat } from '@/components/NumberFormatProvider';
import { preferredFiatSuffix } from '@/components/PreferredFiatSuffix';
import type { HeartSender } from '@/lib/api-types';
import { formatForumTime } from '@/lib/forum-time';
import { formatBitcoin, type FiatRateDay } from '@/lib/stats-money';

/**
 * Paid-heart senders under an expanded forum note's replies.
 *
 * Heart rows keep the api's newest-first order. Each row links the sender's
 * name to that member's profile, shows the shared role pill when the role is
 * tagged, the exact sats that heart paid with the viewer's number grouping,
 * one fiat figure from the frozen strings on the heart (or the viewer's spot
 * when that string is null), and the forum timestamp. An empty name is a
 * deleted account and gets the translated placeholder instead of a profile
 * link.
 *
 * @param props - Hearts from `GET /messages/:id/replies`, the current spot,
 *   and the visitor's fiat.
 * @returns The Hearts section, or `null` when there are no hearts.
 */
export function ReplyHeartSenders({
  hearts,
  rateDay,
  fiat,
}: {
  hearts: readonly HeartSender[];
  rateDay: FiatRateDay | null;
  fiat: 'USD' | 'CHF' | 'EUR' | 'PHP';
}): ReactElement | null {
  const { t, locale } = useTranslations();
  const { numberFormat } = useNumberFormat();
  const headingId = useId();
  const [openRoleId, setOpenRoleId] = useState<string | null>(null);
  if (hearts.length === 0) {
    return null;
  }
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-2">
      <h3 id={headingId} className="text-sm font-semibold text-app-fg">
        {t('forum.heartsHeading', { count: hearts.length })}
      </h3>
      <ul className="flex flex-col gap-2">
        {hearts.map((heart, index) => {
          const rowId = `${heart.accountId}:${heart.createdAt}:${index}`;
          const hintOpen = openRoleId === rowId;
          const deleted = heart.name.trim() === '';
          const role = heart.role ?? 'basis';
          return (
            <li
              key={rowId}
              className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 rounded-xl border border-app-border bg-app-card px-3 py-2"
            >
              <div className="flex flex-wrap items-center gap-2">
                {deleted ? (
                  <span className="text-sm font-medium text-app-muted">
                    {t('forum.deletedAccount')}
                  </span>
                ) : (
                  <Link
                    href={`/members/${heart.accountId}`}
                    className="text-sm font-medium text-app-fg underline underline-offset-2"
                  >
                    {heart.name}
                  </Link>
                )}
                {!deleted ? (
                  <ForumRoleTag
                    role={role}
                    expanded={hintOpen}
                    onToggle={() => {
                      setOpenRoleId(hintOpen ? null : rowId);
                    }}
                  />
                ) : null}
              </div>
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <span className="text-sm font-semibold tabular-nums lining-nums text-app-fg">
                  {formatBitcoin(heart.sats, numberFormat)}
                  {preferredFiatSuffix(heart.sats, rateDay, fiat, numberFormat, heart)}
                </span>
                <time dateTime={heart.createdAt} className="text-xs text-app-subtle">
                  {formatForumTime(heart.createdAt, locale)}
                </time>
              </div>
              {!deleted && hintOpen ? (
                <p role="status" className="w-full text-xs text-app-muted">
                  <ForumRoleHint role={role} />
                </p>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
