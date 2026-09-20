'use client';

import type { ReactElement } from 'react';
import { useTranslations } from '@/components/LocaleProvider';
import { forumGoalPercent } from '@/lib/forum-goal';

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
 * so it stays readable, and is not capped. Lengths use SVG `width` / `x` /
 * `viewBox` attributes, not React `style`.
 *
 * @param sats - Collected sats on the note.
 * @param goalSats - Whole-sat goal; `<= 0` → `null`.
 * @returns The bar, or `null`.
 */
export function ForumGoalBar({
  sats,
  goalSats,
}: {
  sats: number;
  goalSats: number;
}): ReactElement | null {
  const { t } = useTranslations();
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
    <div className="mt-2 flex items-center gap-2">
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
  );
}
