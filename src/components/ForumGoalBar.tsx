'use client';

import { useCallback, useState, type ReactElement } from 'react';
import { CreditLedger } from '@/components/CreditLedger';
import { useFiatPreference } from '@/components/FiatPreferenceProvider';
import { LoanBlock } from '@/components/LoanBlock';
import { useTranslations } from '@/components/LocaleProvider';
import { useNumberFormat } from '@/components/NumberFormatProvider';
import { preferredFiatSuffix } from '@/components/PreferredFiatSuffix';
import type { RepaymentLedger } from '@/lib/api';
import { FORUM_GOAL_AMOUNT_RE, type ForumGoalCurrency } from '@/lib/api-types';
import { creditSmallestUnits, splitCreditPlan } from '@/lib/credit-plan';
import { forumAskPercent, formatDefinedGoalAmount } from '@/lib/forum-goal';
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
 * the current spot rate. Lengths use
 * SVG `width` / `x` / `viewBox` attributes, not React `style`.
 *
 * A posted loan (`goalRepayable` with `messageId`, not the wizard preview)
 * renders {@link LoanBlock} instead of these lines. The open note passes the
 * ledger that {@link CreditLedger} loads into that block; a feed card loads
 * no ledger.
 *
 * @param sats - Collected sats on the note.
 * @param goalSats - Whole-sat goal; `<= 0` → `null`.
 * @param rateDay - Current spot rate. Fills the visitor's fiat when no
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
 * @param goalRepayable - Credit ask. The loan tag sits beside the author, not in this bar.
 * @param goalTermDays - Repayment days. With `goalRepayable`, also shows the daily plan.
 * @param messageId - Posted credit id. Omitted in the wizard, so the ledger stays off.
 * @param ledgerCollapsed - Feed lists show a repayment-list link and skip the ledger fetch. The note page leaves this false.
 * @param onLend - Posted loan only: opens the money reaction, shown as **Lend** in the loan block.
 * @param lendBlocked - Posted loan only: the borrower cannot receive yet, so **Lend** shows disabled.
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
  messageId,
  ledgerCollapsed = false,
  onLend,
  lendBlocked = false,
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
  /** Set on a posted credit so the public ledger can load. Omitted in the wizard. */
  messageId?: string | undefined;
  /** Feed lists show a repayment-list link and skip the ledger fetch. The note page leaves this false. */
  ledgerCollapsed?: boolean | undefined;
  /** Posted loan only: opens the money reaction of the note. Omit when the viewer cannot lend. */
  onLend?: (() => void) | undefined;
  /** Posted loan only: the borrower cannot receive yet, so **Lend** shows disabled. */
  lendBlocked?: boolean | undefined;
}): ReactElement | null {
  const { t } = useTranslations();
  const { fiat } = useFiatPreference();
  const { numberFormat } = useNumberFormat();
  const [loaded, setLoaded] = useState<{ messageId: string; ledger: RepaymentLedger } | null>(null);
  const onLedger = useCallback(
    (ledger: RepaymentLedger): void => {
      if (messageId !== undefined) {
        setLoaded({ messageId, ledger });
      }
    },
    [messageId],
  );
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
  const percent = forumAskPercent({ sats, goalSats, goalCurrency, goalAmount, ...collectedByCode });
  let ratio = forumGoalRatio(sats, goalSats);
  if (
    isFiatGoalCurrency(goalCurrency) &&
    typeof goalAmount === 'string' &&
    FORUM_GOAL_AMOUNT_RE.test(goalAmount)
  ) {
    ratio = forumFiatGoalRatio(collectedByCode[COLLECTED_FIELD[goalCurrency]], goalAmount);
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
  const askAmount = (
    <>
      {defined !== '' ? (
        <>
          <span>{defined}</span>
          <span aria-hidden="true"> · </span>
        </>
      ) : null}
      <span>{formatBitcoin(goalSats, numberFormat)}</span>
      {frozenViewer}
      {liveViewer}
    </>
  );
  if (goalRepayable === true && messageId !== undefined && !preview) {
    const withViewerFiat = (amountSats: number, stored: string | null | undefined): string => {
      const bitcoin = formatBitcoin(amountSats, numberFormat);
      const priced =
        typeof stored === 'string' && COLLECTED_FIAT_RE.test(stored)
          ? stored
          : satsToFiatAmount(amountSats, rateDay, fiat);
      return priced === null
        ? bitcoin
        : `${bitcoin} · ${formatFiatDisplay(priced, fiat, numberFormat)}`;
    };
    const collectedSats = Number.isFinite(sats) && sats > 0 ? sats : 0;
    // Like the ask: the defined fiat, then bitcoin, then the visitor's fiat unless it is the defined one.
    const withBitcoin = (amountSats: number, stored: string | null | undefined): string =>
      definedInViewerFiat
        ? formatBitcoin(amountSats, numberFormat)
        : withViewerFiat(amountSats, stored);
    const definedCode = defined !== '' && isFiatGoalCurrency(goalCurrency) ? goalCurrency : null;
    const collectedDefined =
      definedCode === null ? undefined : collectedByCode[COLLECTED_FIELD[definedCode]];
    // A fiat loan counts in its own currency, like its percent: a missing snapshot is zero.
    let collected: string;
    if (definedCode === null) {
      collected = withViewerFiat(collectedSats, collectedByCode[COLLECTED_FIELD[fiat]]);
    } else if (typeof collectedDefined === 'string' && COLLECTED_FIAT_RE.test(collectedDefined)) {
      collected = `${formatFiatDisplay(collectedDefined, definedCode, numberFormat)} · ${withBitcoin(
        collectedSats,
        collectedByCode[COLLECTED_FIELD[fiat]],
      )}`;
    } else {
      collected = `${formatFiatDisplay('0.00', definedCode, numberFormat)} · ${withBitcoin(0, '0.00')}`;
    }
    const goalText =
      definedCode === null
        ? withViewerFiat(goalSats, viewerSnapshot)
        : `${defined} · ${withBitcoin(goalSats, viewerSnapshot)}`;
    return (
      <>
        <LoanBlock
          messageId={messageId}
          ask={askAmount}
          collected={collected}
          goal={goalText}
          percent={percent}
          funded={Number.isFinite(sats) && sats >= goalSats}
          ledger={loaded !== null && loaded.messageId === messageId ? loaded.ledger : null}
          ledgerLink={ledgerCollapsed}
          onLend={onLend}
          lendBlocked={lendBlocked}
        />
        {ledgerCollapsed ? null : (
          <CreditLedger messageId={messageId} list="summary" onLedger={onLedger} />
        )}
      </>
    );
  }
  return (
    <div className="mt-2 flex flex-col gap-1">
      <p className="text-xs font-medium tabular-nums lining-nums text-app-muted">
        <span>{t('forum.askAmountLabel')}</span> {askAmount}
      </p>
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
      <p>{t('forum.creditDaily', { plan })}</p>
    </div>
  );
}
