'use client';

import type { ReactElement } from 'react';
import { useFiatPreference } from '@/components/FiatPreferenceProvider';
import { useTranslations } from '@/components/LocaleProvider';
import { useNumberFormat } from '@/components/NumberFormatProvider';
import { preferredFiatSuffix } from '@/components/PreferredFiatSuffix';
import { FORUM_GOAL_AMOUNT_RE, type ForumGoalCurrency } from '@/lib/api-types';
import { creditSmallestUnits, splitCreditPlan } from '@/lib/credit-plan';
import { formatDefinedGoalAmount, forumFiatGoalPercent, forumGoalPercent } from '@/lib/forum-goal';
import {
  formatBitcoin,
  formatFiatDisplay,
  satsToFiatAmount,
  type FiatCode,
  type FiatRateDay,
} from '@/lib/stats-money';

const GOAL_SNAPSHOT_FIELD = {
  USD: 'goalAmountUsd',
  CHF: 'goalAmountChf',
  EUR: 'goalAmountEur',
  PHP: 'goalAmountPhp',
} as const;

const COLLECTED_FIELD = {
  USD: 'amountUsd',
  CHF: 'amountChf',
  EUR: 'amountEur',
  PHP: 'amountPhp',
} as const;

const COLLECTED_FIAT_RE = /^\d+\.\d{2}$/;
const SCALE_8 = 100000000n;

function isFiatGoalCurrency(code: ForumGoalCurrency | undefined): code is FiatCode {
  return code === 'USD' || code === 'CHF' || code === 'EUR' || code === 'PHP';
}

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

function scaleKnownDecimalTo8(raw: string): bigint {
  const dot = raw.indexOf('.');
  const whole = dot === -1 ? raw : raw.slice(0, dot);
  const frac = (dot === -1 ? '' : raw.slice(dot + 1)).padEnd(8, '0');
  return BigInt(whole) * SCALE_8 + BigInt(frac);
}

/**
 * Unfloored collected/goal ratio in the definition fiat. Unusable collected
 * or goal is 0. The caller must not fall back to sats.
 *
 * @param collected - Payment snapshot for the definition code.
 * @param goalAmount - Defined amount string.
 * @returns Uncapped ratio, or 0.
 */
function forumFiatGoalRatio(collected: string | null | undefined, goalAmount: string): number {
  if (collected === null || collected === undefined || !COLLECTED_FIAT_RE.test(collected)) {
    return 0;
  }
  const goalScaled = scaleKnownDecimalTo8(goalAmount);
  if (goalScaled <= 0n) {
    return 0;
  }
  return Number(scaleKnownDecimalTo8(collected)) / Number(goalScaled);
}

function fiatSuffixMarkup(text: string): ReactElement {
  return (
    <>
      <span aria-hidden="true"> · </span>
      <span>{text}</span>
    </>
  );
}

/**
 * Progress bar of collected amount versus an optional Ask.
 *
 * Renders nothing when `goalSats` is missing or `<= 0`. Fill is bitcoin-orange
 * in SVG user units 0–100; overflow past 100% continues in green from `x=100`,
 * at most another 100 units (visual max 200%). The percent label is a sibling
 * so it stays readable, and is not capped. The asked amount is the Ask label
 * plus the defined fiat when the ask was defined in fiat, `formatBitcoin(goalSats)`,
 * and the visitor's default fiat unless the ask was defined in that same fiat.
 * The visitor figure is the frozen snapshot when that string exists, otherwise
 * the gift-day rate. Lengths use
 * SVG `width` / `x` / `viewBox` attributes, not React `style`.
 *
 * @param sats - Collected sats on the note.
 * @param goalSats - Whole-sat goal; `<= 0` → `null`.
 * @param rateDay - Latest gift-day totals. Fills the visitor's fiat when no
 *   snapshot string is stored.
 * @param goalCurrency - Ask definition code when the api sent one.
 * @param goalAmount - Typed definition string when the api sent one.
 * @param goalAmountUsd - Frozen USD snapshot of the goal, or null.
 * @param goalAmountChf - Frozen CHF snapshot of the goal, or null.
 * @param goalAmountEur - Frozen EUR snapshot of the goal, or null.
 * @param goalAmountPhp - Frozen PHP snapshot of the goal, or null.
 * @param amountUsd - Payment USD snapshot used for a USD fiat percent.
 * @param amountChf - Payment CHF snapshot used for a CHF fiat percent.
 * @param amountEur - Payment EUR snapshot used for a EUR fiat percent.
 * @param amountPhp - Payment PHP snapshot used for a PHP fiat percent.
 * @param preview - Wizard unsent preview. Same pair rule as a posted ask.
 * @param goalRepayable - Credit ask; shows `forum.askRepay` under the label.
 * @param goalTermDays - Repayment days. With `goalRepayable`, also shows 0% interest and the daily plan.
 * @returns The bar, or `null`.
 */
export function ForumGoalBar({
  sats,
  goalSats,
  rateDay = null,
  goalCurrency,
  goalAmount,
  goalAmountUsd,
  goalAmountChf,
  goalAmountEur,
  goalAmountPhp,
  amountUsd,
  amountChf,
  amountEur,
  amountPhp,
  preview = false,
  goalRepayable,
  goalTermDays,
}: {
  sats: number;
  goalSats: number;
  rateDay?: FiatRateDay | null;
  goalCurrency?: ForumGoalCurrency | undefined;
  goalAmount?: string | undefined;
  goalAmountUsd?: string | null | undefined;
  goalAmountChf?: string | null | undefined;
  goalAmountEur?: string | null | undefined;
  goalAmountPhp?: string | null | undefined;
  amountUsd?: string | null | undefined;
  amountChf?: string | null | undefined;
  amountEur?: string | null | undefined;
  amountPhp?: string | null | undefined;
  preview?: boolean | undefined;
  goalRepayable?: true | undefined;
  goalTermDays?: number | undefined;
}): ReactElement | null {
  const { t } = useTranslations();
  const { fiat } = useFiatPreference();
  const { numberFormat } = useNumberFormat();
  if (!Number.isFinite(goalSats) || goalSats <= 0) {
    return null;
  }
  const snapshots = {
    goalAmountUsd,
    goalAmountChf,
    goalAmountEur,
    goalAmountPhp,
  };
  const collectedByCode = {
    amountUsd,
    amountChf,
    amountEur,
    amountPhp,
  };
  const showDefinedFiat =
    isFiatGoalCurrency(goalCurrency) &&
    typeof goalAmount === 'string' &&
    (preview || FORUM_GOAL_AMOUNT_RE.test(goalAmount));
  const defined = showDefinedFiat
    ? formatDefinedGoalAmount(goalAmount, goalCurrency, numberFormat)
    : '';
  let percent = forumGoalPercent(sats, goalSats);
  let ratio = forumGoalRatio(sats, goalSats);
  if (
    isFiatGoalCurrency(goalCurrency) &&
    typeof goalAmount === 'string' &&
    FORUM_GOAL_AMOUNT_RE.test(goalAmount)
  ) {
    const collected = collectedByCode[COLLECTED_FIELD[goalCurrency]];
    percent = forumFiatGoalPercent(collected, goalAmount);
    ratio = forumFiatGoalRatio(collected, goalAmount);
  }
  const fillWidth = Math.min(100, ratio * 100);
  const overflowWidth = percent > 100 ? Math.min(100, percent - 100) : 0;
  const viewWidth = 100 + overflowWidth;
  const percentLabel = String(percent);
  const viewerSnapshot = snapshots[GOAL_SNAPSHOT_FIELD[fiat]];
  const definedInViewerFiat = showDefinedFiat && goalCurrency === fiat;
  const frozenViewer =
    !definedInViewerFiat && typeof viewerSnapshot === 'string'
      ? fiatSuffixMarkup(formatFiatDisplay(viewerSnapshot, fiat, numberFormat))
      : null;
  const liveViewer =
    !definedInViewerFiat && frozenViewer === null
      ? preferredFiatSuffix(goalSats, rateDay, fiat, numberFormat)
      : null;
  return (
    <div className="mt-2 flex flex-col gap-1">
      <p className="text-xs font-medium tabular-nums lining-nums text-app-muted">
        <span>{t('forum.askAmountLabel')}</span>{' '}
        {defined !== '' ? (
          <>
            <span>{defined}</span>
            <span aria-hidden="true"> · </span>
          </>
        ) : null}
        <span>{formatBitcoin(goalSats, numberFormat)}</span>
        {frozenViewer}
        {liveViewer}
      </p>
      {goalRepayable === true ? (
        <p className="text-xs font-medium text-app-muted">{t('forum.askRepay')}</p>
      ) : null}
      {goalRepayable === true && typeof goalTermDays === 'number' ? (
        <CreditPlanLines
          goalCurrency={goalCurrency}
          goalAmount={goalAmount}
          goalSats={goalSats}
          days={goalTermDays}
          rateDay={rateDay}
          fiat={fiat}
        />
      ) : null}
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

function CreditPlanLines({
  goalCurrency,
  goalAmount,
  goalSats,
  days,
  rateDay,
  fiat,
}: {
  goalCurrency: ForumGoalCurrency | undefined;
  goalAmount: string | undefined;
  goalSats: number;
  days: number;
  rateDay: FiatRateDay | null;
  fiat: FiatCode;
}): ReactElement | null {
  const { t } = useTranslations();
  const { numberFormat } = useNumberFormat();
  const bitcoin = goalCurrency === undefined || goalCurrency === 'BTC';
  const units = creditSmallestUnits(bitcoin ? String(goalSats) : (goalAmount ?? ''), bitcoin);
  const split = units === null ? null : splitCreditPlan(units, days);
  if (split === null) {
    return null;
  }
  const format = (value: bigint): string => {
    if (bitcoin) {
      const btc = formatBitcoin(Number(value), numberFormat);
      const priced = satsToFiatAmount(Number(value), rateDay, fiat);
      if (priced === null) {
        return btc;
      }
      return `${btc} · ${formatFiatDisplay(priced, fiat, numberFormat)}`;
    }
    const whole = value / 100n;
    const frac = (value % 100n).toString().padStart(2, '0');
    return formatFiatDisplay(`${whole.toString()}.${frac}`, goalCurrency as FiatCode, numberFormat);
  };
  const plan =
    split.remainder === 0n
      ? t('forum.creditPlanEven', { amount: format(split.perDay), days: split.days })
      : t('forum.creditPlanLast', {
          amount: format(split.perDay),
          earlier: split.days - 1,
          last: format(split.last),
        });
  return (
    <div className="text-xs text-app-muted">
      <p>{t('forum.creditInterest')}</p>
      <p>{t('forum.creditDaily', { plan })}</p>
    </div>
  );
}
