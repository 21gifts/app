'use client';

import type { ReactElement } from 'react';
import { useFiatPreference } from '@/components/FiatPreferenceProvider';
import { useTranslations } from '@/components/LocaleProvider';
import { useNumberFormat } from '@/components/NumberFormatProvider';
import { preferredFiatSuffix } from '@/components/PreferredFiatSuffix';
import { forumGoalPercent } from '@/lib/forum-goal';
import { formatBitcoin, type FiatRateDay } from '@/lib/stats-money';

/**
 * Unfloored collected/goal ratio for SVG widths. Negative or non-finite
 * sats are treated as 0. The caller must pass a positive finite goal.
 *
 * @param sats - Collected sats on the note.
 * @param goalSats - Positive finite whole-sat goal.
 * @returns Uncapped ratio (`sats / goalSats`).
 */
function forumGoalRatio(sats: number, goalSats: number): number {
  const collected = Number.isFinite(sats) && sats > 0 ? sats : 0;
  return collected / goalSats;
}

/**
 * Progress bar of collected sats versus an optional whole-sat goal.
 *
 * Renders nothing when `goalSats` is missing or `<= 0`. Fill is bitcoin-orange
 * in SVG user units 0–100; overflow past 100% continues in green from `x=100`,
 * at most another 100 units (visual max 200%). The percent label is a sibling
 * so it stays readable, and is not capped. The asked amount is the Ask label
 * plus `formatBitcoin(goalSats)` and optional preferred-fiat, so 110% is
 * readable against the goal, not only the collected footer. Lengths use SVG
 * `width` / `x` / `viewBox` attributes, not React `style`.
 *
 * @param sats - Collected sats on the note.
 * @param goalSats - Whole-sat goal; `<= 0` → `null`.
 * @param rateDay - Latest gift-day totals for the fiat counterpart, or `null`.
 * @returns The bar, or `null`.
 */
export function ForumGoalBar({
  sats,
  goalSats,
  rateDay = null,
}: {
  sats: number;
  goalSats: number;
  rateDay?: FiatRateDay | null;
}): ReactElement | null {
  const { t } = useTranslations();
  const { fiat } = useFiatPreference();
  const { numberFormat } = useNumberFormat();
  if (!Number.isFinite(goalSats) || goalSats <= 0) {
    return null;
  }
  const ratio = forumGoalRatio(sats, goalSats);
  const percent = forumGoalPercent(sats, goalSats);
  const fillWidth = Math.min(100, ratio * 100);
  const overflowWidth = percent > 100 ? Math.min(100, percent - 100) : 0;
  const viewWidth = 100 + overflowWidth;
  const percentLabel = String(percent);
  return (
    <div className="mt-2 flex flex-col gap-1">
      <p className="text-xs font-medium tabular-nums lining-nums text-app-muted">
        <span>{t('forum.askAmountLabel')}</span>{' '}
        <span>{formatBitcoin(goalSats, numberFormat)}</span>
        {preferredFiatSuffix(goalSats, rateDay, fiat, numberFormat)}
      </p>
      <div className="flex items-center gap-2">
        <svg
          viewBox={`0 0 ${viewWidth} 8`}
          preserveAspectRatio="none"
          role="img"
          aria-label={t('forum.goalBarAria', { percent: percentLabel })}
          className="h-2 min-w-0 flex-1"
        >
          <rect x="0" y="0" width="100" height="8" rx="4" className="fill-app-border" />
          {fillWidth > 0 ? (
            <rect x="0" y="0" width={fillWidth} height="8" rx="4" className="fill-app-accent" />
          ) : null}
          {overflowWidth > 0 ? (
            <rect
              x="100"
              y="0"
              width={overflowWidth}
              height="8"
              rx="4"
              className="fill-app-success"
            />
          ) : null}
        </svg>
        <span className="shrink-0 tabular-nums text-xs text-app-muted">
          {t('forum.goalPercent', { percent: percentLabel })}
        </span>
      </div>
    </div>
  );
}
