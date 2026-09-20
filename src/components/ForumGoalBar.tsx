'use client';

import type { ReactElement } from 'react';
import { useTranslations } from '@/components/LocaleProvider';
import { forumGoalPercent } from '@/lib/forum-goal';

/**
 * Unfloored collected/goal ratio for SVG widths. Non-finite or non-positive
 * goals yield 0. Negative or non-finite sats are treated as 0.
 *
 * @param sats - Collected sats on the note.
 * @param goalSats - Whole-sat goal.
 * @returns Uncapped ratio (`sats / goalSats`), or 0.
 */
function forumGoalRatio(sats: number, goalSats: number): number {
  if (!Number.isFinite(goalSats) || goalSats <= 0) {
    return 0;
  }
  const collected = Number.isFinite(sats) && sats > 0 ? sats : 0;
  return collected / goalSats;
}

/**
 * Progress bar of collected sats versus an optional whole-sat goal.
 *
 * Renders nothing when `goalSats` is missing or `<= 0`. Fill is bitcoin-orange
 * through 100% of the track; overflow past 100% continues in green, painted
 * at most one extra track width (visual max 200%). The percent label is not
 * capped. Lengths use SVG `width` / `x` attributes, not React `style`.
 *
 * @param props.sats - Collected sats on the note.
 * @param props.goalSats - Whole-sat goal; `<= 0` → `null`.
 * @returns The bar, or `null`.
 */
export function ForumGoalBar(props: {
  sats: number;
  goalSats: number;
}): ReactElement | null {
  const { sats, goalSats } = props;
  const { t } = useTranslations();
  if (!Number.isFinite(goalSats) || goalSats <= 0) {
    return null;
  }
  const ratio = forumGoalRatio(sats, goalSats);
  const percent = forumGoalPercent(sats, goalSats);
  const fillWidth = Math.min(100, ratio * 100);
  const overflowWidth = ratio > 1 ? Math.min(100, (ratio - 1) * 100) : 0;
  const percentLabel = String(percent);
  return (
    <div className="mt-2 flex items-center gap-2 overflow-visible">
      <svg
        viewBox="0 0 100 8"
        preserveAspectRatio="none"
        overflow="visible"
        role="img"
        aria-label={t('forum.goalBarAria', { percent: percentLabel })}
        className="h-2 min-w-0 flex-1 overflow-visible"
      >
        <rect x="0" y="0" width="100" height="8" rx="4" className="fill-app-border" />
        {fillWidth > 0 ? (
          <rect
            x="0"
            y="0"
            width={fillWidth}
            height="8"
            rx="4"
            className="fill-app-accent"
          />
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
