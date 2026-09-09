'use client';

import { ChevronDown, ChevronUp } from 'lucide-react';
import Link from 'next/link';
import { useState, type ReactElement } from 'react';
import { useTranslations } from '@/components/LocaleProvider';
import type { GiftDay } from '@/lib/api-types';
import { formatUsdDisplay } from '@/lib/stats-money';

/** Props for {@link ForumTodayGifts}. */
export interface ForumTodayGiftsProps {
  /** Today’s outbound gifts payload from `GET /gifts?day=`. */
  day: GiftDay;
}

/**
 * One-line disclosure of today’s platform outbound gifts for the signed-in forum.
 * Collapsed by default; expand lists recipient handles and USD amounts, plus a
 * link to `/stats/{day}`. Does not embed the stats dashboard or gift-day table.
 *
 * @param props - Day payload with `giftCount > 0`.
 * @returns Collapsed summary row, or expanded list + day link.
 */
export function ForumTodayGifts({ day }: ForumTodayGiftsProps): ReactElement {
  const { t } = useTranslations();
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-2xl border border-app-border bg-app-card-muted">
      <button
        type="button"
        aria-expanded={expanded}
        aria-label={expanded ? t('forum.todayGiftsCollapse') : t('forum.todayGiftsExpand')}
        onClick={() => {
          setExpanded((open) => !open);
        }}
        className="flex min-h-11 w-full items-center justify-between gap-2 px-4 py-2.5 text-left text-sm text-app-fg"
      >
        <span>
          {t('forum.todayGifts', {
            count: String(day.giftCount),
            usd: formatUsdDisplay(day.totalUsd),
          })}
        </span>
        {expanded ? (
          <ChevronUp aria-hidden="true" className="h-4 w-4 shrink-0 text-app-muted" />
        ) : (
          <ChevronDown aria-hidden="true" className="h-4 w-4 shrink-0 text-app-muted" />
        )}
      </button>
      {expanded ? (
        <div className="border-t border-app-border px-4 py-3">
          {day.gifts.length > 0 ? (
            <ul className="flex flex-col gap-1.5">
              {day.gifts.map((gift, index) => (
                <li
                  key={`${gift.paidAt}-${gift.recipient}-${gift.amountUsd}-${index}`}
                  className="text-sm text-app-muted"
                >
                  {gift.recipient} · {formatUsdDisplay(gift.amountUsd)}
                </li>
              ))}
            </ul>
          ) : null}
          <Link
            href={`/stats/${day.day}`}
            className={
              day.gifts.length > 0
                ? 'mt-2 inline-block text-sm font-medium text-app-fg underline underline-offset-2'
                : 'inline-block text-sm font-medium text-app-fg underline underline-offset-2'
            }
          >
            {t('forum.todayGiftsDayLink')}
          </Link>
        </div>
      ) : null}
    </div>
  );
}
