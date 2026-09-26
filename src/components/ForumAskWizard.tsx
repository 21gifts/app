'use client';

import { ArrowLeft, ImagePlus, Loader2, X } from 'lucide-react';
import { useEffect, useRef, useState, type ChangeEvent, type ReactElement } from 'react';
import { AmountEntry } from '@/components/AmountEntry';
import { useFiatPreference } from '@/components/FiatPreferenceProvider';
import { ForumGoalBar } from '@/components/ForumGoalBar';
import { useTranslations } from '@/components/LocaleProvider';
import { useNumberFormat } from '@/components/NumberFormatProvider';
import { Button, IconButton, SegmentedControl } from '@/components/ui';
import { FORUM_MESSAGE_MAX_LENGTH, type AmountUnit, type ForumGoalCurrency } from '@/lib/api-types';
import {
  creditSmallestUnits,
  parseCreditTermDays,
  splitCreditPlan,
  type CreditTermPreset,
} from '@/lib/credit-plan';
import { parseForumAskAmountInUnit } from '@/lib/forum-goal';
import {
  formatBitcoin,
  formatFiatDisplay,
  satsToFiatAmount,
  type FiatCode,
  type FiatRateDay,
} from '@/lib/stats-money';
import { useAuthStore } from '@/stores/auth-store';
import type { ForumPhotoPayload } from '@/lib/forum-photo';
import type { ForumVideoPayload } from '@/lib/forum-video';

/** Wizard step in the Ask-for-money compose flow. */
export type ForumAskStep = 1 | 2 | 3 | 4;

/** Credit screens that sit between the amount and the photos. */
export type CreditAskPhase = 'amount' | 'currency' | 'term' | 'plan' | 'confirmWant' | 'confirmCan';

/** One-time or daily Ask. The pill is on the amount step and the preview. */
export type ForumAskCadence = 'once' | 'daily';

/** Donation or credit Ask. The pill is on the amount step and the preview. */
export type ForumAskObligation = 'donation' | 'credit';

/**
 * Ask composer. A donation is four steps (amount, photos, text, preview).
 * A credit is nine: amount, currency, term, plan, two confirmations, photos,
 * text, preview. The One-time / Daily pill and the Donation / Credit pill
 * are on the amount step and again on the preview.
 *
 * @param props - Drafts, media, and step callbacks from {@link ForumLoader}.
 * @returns The wizard.
 */
export function ForumAskWizard({
  step,
  onStepChange,
  askCadence = 'once',
  onAskCadenceChange = () => undefined,
  askObligation = 'donation',
  onAskObligationChange = () => undefined,
  onCreditTermDays,
  askDraft,
  askDraftUnit,
  onAskDraftUnit,
  onAskDraftChange,
  draft,
  onDraftChange,
  posting,
  photoDrafts,
  videoDraft,
  onPickFiles,
  onRemovePhoto,
  onClearPhoto,
  authorName,
  onPost,
  rateDay = null,
  composerMaxLength = FORUM_MESSAGE_MAX_LENGTH,
}: {
  step: ForumAskStep;
  onStepChange: (step: ForumAskStep) => void;
  askCadence?: ForumAskCadence;
  onAskCadenceChange?: (value: ForumAskCadence) => void;
  askObligation?: ForumAskObligation;
  onAskObligationChange?: (value: ForumAskObligation) => void;
  /** Days the credit will be repaid over, or null while the term is unusable. */
  onCreditTermDays?: (days: number | null) => void;
  askDraft: string;
  /** Unit `askDraft` is written in. Defaults to the account unit. */
  askDraftUnit?: AmountUnit;
  /** Called when the ask field is actually showing a unit. */
  onAskDraftUnit?: (unit: AmountUnit) => void;
  onAskDraftChange: (value: string) => void;
  draft: string;
  onDraftChange: (value: string) => void;
  posting: boolean;
  photoDrafts: ForumPhotoPayload[];
  videoDraft: ForumVideoPayload | null;
  onPickFiles: (files: File[]) => void;
  onRemovePhoto: (index: number) => void;
  onClearPhoto: () => void;
  authorName: string;
  onPost: () => void;
  rateDay?: FiatRateDay | null;
  composerMaxLength?: number;
}): ReactElement {
  const { t } = useTranslations();
  const { fiat } = useFiatPreference();
  const amountUnit = useAuthStore((state) => state.account?.amountUnit ?? 'btc');
  const draftUnit = askDraftUnit ?? amountUnit;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const parsedAsk = parseForumAskAmountInUnit(askDraft, draftUnit, rateDay, fiat);
  const { numberFormat } = useNumberFormat();
  const [creditPhase, setCreditPhase] = useState<CreditAskPhase>('amount');
  const [termPreset, setTermPreset] = useState<CreditTermPreset>(30);
  const [customDays, setCustomDays] = useState('');
  const termDays = parseCreditTermDays(termPreset, customDays);
  const bitcoinAsk = draftUnit !== 'fiat';
  const currencyCode: ForumGoalCurrency = bitcoinAsk ? 'BTC' : fiat;
  const plan = creditPlanFor(askDraft, bitcoinAsk, termDays);
  const planText =
    plan === null
      ? ''
      : creditPlanText(plan, bitcoinAsk, currencyCode, numberFormat, rateDay, fiat, t);
  const owedUnits = creditSmallestUnits(askDraft, bitcoinAsk);
  const owedText =
    owedUnits === null
      ? ''
      : formatPlanUnits(owedUnits, bitcoinAsk, currencyCode, numberFormat, rateDay, fiat);
  useEffect(() => {
    onCreditTermDays?.(askObligation === 'credit' ? termDays : null);
  }, [askObligation, onCreditTermDays, termDays]);
  const creditInside = askObligation === 'credit' && step === 1 && creditPhase !== 'amount';
  const stepTitle = creditInside
    ? t(
        creditPhase === 'currency'
          ? 'forum.creditCurrencyTitle'
          : creditPhase === 'term'
            ? 'forum.creditTermTitle'
            : creditPhase === 'plan'
              ? 'forum.creditPlanTitle'
              : creditPhase === 'confirmWant'
                ? 'forum.creditWantTitle'
                : 'forum.creditCanTitle',
      )
    : step === 1
      ? t('forum.askHowMuch')
      : step === 2
        ? t('forum.askAddPhotos')
        : step === 3
          ? t('forum.askWriteMessage')
          : t('forum.askPreview');
  const shownStep = askObligation === 'credit' ? creditShownStep(step, creditPhase) : step;
  const shownTotal = askObligation === 'credit' ? 9 : 4;
  const handleFiles = (event: ChangeEvent<HTMLInputElement>): void => {
    const list = event.target.files;
    if (list === null || list.length === 0) {
      return;
    }
    onPickFiles(Array.from(list));
    event.target.value = '';
  };
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        {step > 1 || creditInside ? (
          <IconButton
            type="button"
            size="sm"
            variant="ghost"
            aria-label={t('forum.askBack')}
            disabled={posting}
            onClick={() => {
              if (creditInside) {
                setCreditPhase(previousCreditPhase(creditPhase));
                return;
              }
              if (askObligation === 'credit' && step === 2) {
                setCreditPhase('confirmCan');
              }
              onStepChange((step - 1) as ForumAskStep);
            }}
          >
            <ArrowLeft aria-hidden="true" className="h-4 w-4" />
          </IconButton>
        ) : null}
        <h2 className="min-w-0 flex-1 text-lg font-semibold text-app-fg">{stepTitle}</h2>
        <p className="shrink-0 text-xs text-app-subtle">
          {t('forum.askStepOf', { step: shownStep, total: shownTotal })}
        </p>
      </div>
      {(step === 1 && !creditInside) || step === 4 ? (
        <>
          <SegmentedControl
            value={askCadence}
            options={[
              { value: 'once', label: t('forum.askOnce') },
              { value: 'daily', label: t('forum.askDaily') },
            ]}
            onChange={onAskCadenceChange}
            ariaLabel={t('forum.askCadenceLabel')}
            tone="neutral"
            className="!grid grid-cols-2 !rounded-2xl"
          />
          <SegmentedControl
            value={askObligation}
            options={[
              { value: 'donation', label: t('forum.askDonation') },
              { value: 'credit', label: t('forum.askCredit') },
            ]}
            onChange={(value) => {
              onAskObligationChange(value);
              setCreditPhase('amount');
              if (value === 'credit' && step !== 1) {
                onStepChange(1);
              }
            }}
            ariaLabel={t('forum.askObligationLabel')}
            tone="neutral"
            className="!grid grid-cols-2 !rounded-2xl"
          />
        </>
      ) : null}
      {creditInside ? (
        <CreditPhasePanel
          phase={creditPhase}
          bitcoinAsk={bitcoinAsk}
          currencyCode={currencyCode}
          termPreset={termPreset}
          customDays={customDays}
          planText={planText}
          owedText={owedText}
          posting={posting}
          canContinue={termDays !== null && plan !== null}
          onTermPreset={setTermPreset}
          onCustomDays={setCustomDays}
          onContinue={() => {
            if (creditPhase === 'currency') {
              setCreditPhase('term');
            } else if (creditPhase === 'term' && termDays !== null) {
              setCreditPhase('plan');
            } else if (creditPhase === 'plan') {
              setCreditPhase('confirmWant');
            } else if (creditPhase === 'confirmWant') {
              setCreditPhase('confirmCan');
            } else if (creditPhase === 'confirmCan' && termDays !== null) {
              onStepChange(2);
            }
          }}
        />
      ) : null}
      {step === 1 && !creditInside ? (
        <>
          <AmountEntry
            id="forum-ask-amount"
            label={t('forum.askAmountLabel')}
            value={askDraft}
            valueUnit={draftUnit}
            onValueChange={onAskDraftChange}
            {...(onAskDraftUnit === undefined ? {} : { onUnitChange: onAskDraftUnit })}
            disabled={posting}
            rateDay={rateDay}
          />
          <Button
            type="button"
            variant="primary"
            disabled={posting || parsedAsk === null}
            onClick={() => {
              if (askObligation === 'credit') {
                setCreditPhase('currency');
                return;
              }
              onStepChange(2);
            }}
          >
            {t('forum.askContinue')}
          </Button>
        </>
      ) : null}
      {step === 2 ? (
        <>
          <div className="flex items-center gap-2">
            <IconButton
              type="button"
              size="lg"
              variant="secondary"
              aria-label={t('forum.attach')}
              disabled={posting}
              onClick={() => {
                fileInputRef.current?.click();
              }}
            >
              <ImagePlus aria-hidden="true" className="block h-5 w-5 shrink-0" />
            </IconButton>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime,video/x-m4v,.mp4,.webm,.mov,.m4v"
              className="hidden"
              disabled={posting}
              onChange={handleFiles}
            />
          </div>
          {videoDraft !== null ? (
            <div className="flex items-start gap-3 rounded-2xl border border-app-border bg-app-card-muted p-3">
              <video
                src={videoDraft.previewUrl}
                className="h-20 w-20 rounded-lg object-cover"
                muted
                playsInline
                preload="metadata"
              />
              <IconButton
                type="button"
                size="sm"
                variant="secondary"
                onClick={onClearPhoto}
                disabled={posting}
                aria-label={t('forum.removeVideo')}
              >
                <X aria-hidden="true" className="h-4 w-4" />
              </IconButton>
            </div>
          ) : null}
          {photoDrafts.length === 1 ? (
            <div className="flex items-start gap-3 rounded-2xl border border-app-border bg-app-card-muted p-3">
              {/* eslint-disable-next-line @next/next/no-img-element -- data URL preview from prepareForumPhoto */}
              <img
                src={photoDrafts[0]!.previewUrl}
                alt={t('forum.previewAlt')}
                className="h-20 w-20 rounded-lg object-cover"
              />
              <IconButton
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => {
                  onRemovePhoto(0);
                }}
                disabled={posting}
                aria-label={t('forum.removePhoto')}
              >
                <X aria-hidden="true" className="h-4 w-4" />
              </IconButton>
            </div>
          ) : null}
          {photoDrafts.length > 1 ? (
            <ul className="flex flex-wrap items-start gap-3 rounded-2xl border border-app-border bg-app-card-muted p-3">
              {photoDrafts.map((photo, index) => (
                <li key={`${photo.previewUrl}:${index}`} className="flex items-start gap-1">
                  {/* eslint-disable-next-line @next/next/no-img-element -- data URL preview from prepareForumPhoto */}
                  <img
                    src={photo.previewUrl}
                    alt={t('forum.previewAlt')}
                    className="h-20 w-20 rounded-lg object-cover"
                  />
                  <IconButton
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      onRemovePhoto(index);
                    }}
                    disabled={posting}
                    aria-label={t('forum.removePhoto')}
                  >
                    <X aria-hidden="true" className="h-4 w-4" />
                  </IconButton>
                </li>
              ))}
            </ul>
          ) : null}
          <Button
            type="button"
            variant="primary"
            disabled={posting}
            onClick={() => {
              onStepChange(3);
            }}
          >
            {t('forum.askContinue')}
          </Button>
        </>
      ) : null}
      {step === 3 ? (
        <>
          <textarea
            aria-label={t('forum.composerLabel')}
            placeholder={t('forum.placeholder')}
            value={draft}
            onChange={(event) => {
              onDraftChange(event.target.value);
            }}
            maxLength={composerMaxLength}
            rows={4}
            disabled={posting}
            className="min-h-11 w-full resize-none rounded-2xl border border-app-border-strong px-4 py-2.5 text-base text-app-fg transition disabled:opacity-50"
          />
          <Button
            type="button"
            variant="primary"
            disabled={posting}
            onClick={() => {
              onStepChange(4);
            }}
          >
            {t('forum.askContinue')}
          </Button>
        </>
      ) : null}
      {step === 4 ? (
        <>
          <div className="rounded-2xl border border-app-border bg-app-card-muted px-4 py-3">
            <p className="text-sm font-medium text-app-fg">{authorName}</p>
            {draft.trim() !== '' ? (
              <p className="mt-2 whitespace-pre-wrap text-sm text-app-fg">{draft}</p>
            ) : null}
            {videoDraft !== null ? (
              <video
                src={videoDraft.previewUrl}
                className="mt-2 max-h-80 w-full rounded-xl object-cover"
                muted
                playsInline
                preload="metadata"
              />
            ) : null}
            {photoDrafts.length === 1 ? (
              // eslint-disable-next-line @next/next/no-img-element -- data URL preview from prepareForumPhoto
              <img
                src={photoDrafts[0]!.previewUrl}
                alt={t('forum.previewAlt')}
                className="mt-2 max-h-36 w-full rounded-xl object-cover"
              />
            ) : null}
            {photoDrafts.length > 1 ? (
              <ul className="mt-2 flex flex-wrap gap-2">
                {photoDrafts.map((photo, index) => (
                  <li key={`${photo.previewUrl}:${index}`}>
                    {/* eslint-disable-next-line @next/next/no-img-element -- data URL preview from prepareForumPhoto */}
                    <img
                      src={photo.previewUrl}
                      alt={t('forum.previewAlt')}
                      className="h-20 w-20 rounded-lg object-cover"
                    />
                  </li>
                ))}
              </ul>
            ) : null}
            {parsedAsk !== null ? (
              <ForumGoalBar
                sats={0}
                goalSats={parsedAsk}
                rateDay={rateDay}
                preview
                goalCurrency={draftUnit === 'fiat' ? fiat : 'BTC'}
                goalAmount={askDraft.trim()}
                goalRepayable={askObligation === 'credit' ? true : undefined}
                goalTermDays={askObligation === 'credit' ? (termDays ?? undefined) : undefined}
              />
            ) : null}
          </div>
          <Button
            type="button"
            variant="primary"
            size="lg"
            disabled={
              posting || (draft.trim() === '' && photoDrafts.length === 0 && videoDraft === null)
            }
            onClick={onPost}
          >
            {posting ? <Loader2 aria-hidden="true" className="h-5 w-5 animate-spin" /> : null}
            {t('forum.post')}
          </Button>
        </>
      ) : null}
    </div>
  );
}

const CREDIT_PHASE_ORDER: CreditAskPhase[] = [
  'amount',
  'currency',
  'term',
  'plan',
  'confirmWant',
  'confirmCan',
];

function previousCreditPhase(phase: CreditAskPhase): CreditAskPhase {
  const index = CREDIT_PHASE_ORDER.indexOf(phase);
  return CREDIT_PHASE_ORDER[Math.max(0, index - 1)] as CreditAskPhase;
}

function creditShownStep(step: ForumAskStep, phase: CreditAskPhase): number {
  if (step === 1) {
    return CREDIT_PHASE_ORDER.indexOf(phase) + 1;
  }
  return step + 5;
}

function creditPlanFor(
  amount: string,
  bitcoin: boolean,
  days: number | null,
): ReturnType<typeof splitCreditPlan> {
  if (days === null) {
    return null;
  }
  const units = creditSmallestUnits(amount, bitcoin);
  if (units === null) {
    return null;
  }
  return splitCreditPlan(units, days);
}

function formatPlanUnits(
  units: bigint,
  bitcoin: boolean,
  code: ForumGoalCurrency,
  style: Parameters<typeof formatBitcoin>[1],
  rateDay: FiatRateDay | null,
  visitorFiat: FiatCode,
): string {
  if (bitcoin || code === 'BTC') {
    const btc = formatBitcoin(Number(units), style);
    const priced = satsToFiatAmount(Number(units), rateDay, visitorFiat);
    if (priced === null) {
      return btc;
    }
    return `${btc} · ${formatFiatDisplay(priced, visitorFiat, style)}`;
  }
  const whole = units / 100n;
  const frac = (units % 100n).toString().padStart(2, '0');
  return formatFiatDisplay(`${whole.toString()}.${frac}`, code as FiatCode, style);
}

function creditPlanText(
  plan: NonNullable<ReturnType<typeof splitCreditPlan>>,
  bitcoin: boolean,
  code: ForumGoalCurrency,
  style: Parameters<typeof formatBitcoin>[1],
  rateDay: FiatRateDay | null,
  visitorFiat: FiatCode,
  t: (
    key: 'forum.creditPlanEven' | 'forum.creditPlanLast',
    values: Record<string, string | number>,
  ) => string,
): string {
  const amount = formatPlanUnits(plan.perDay, bitcoin, code, style, rateDay, visitorFiat);
  if (plan.remainder === 0n) {
    return t('forum.creditPlanEven', { amount, days: plan.days });
  }
  return t('forum.creditPlanLast', {
    amount,
    earlier: plan.days - 1,
    last: formatPlanUnits(plan.last, bitcoin, code, style, rateDay, visitorFiat),
  });
}

function creditTermLabel(
  preset: CreditTermPreset,
  custom: string,
  t: (
    key:
      | 'forum.creditTerm30'
      | 'forum.creditTerm365'
      | 'forum.creditTerm730'
      | 'forum.creditTermDayCount',
    values?: Record<string, string | number>,
  ) => string,
): string {
  if (preset === 30) {
    return t('forum.creditTerm30');
  }
  if (preset === 365) {
    return t('forum.creditTerm365');
  }
  if (preset === 730) {
    return t('forum.creditTerm730');
  }
  return t('forum.creditTermDayCount', { days: custom });
}

function CreditPhasePanel({
  phase,
  bitcoinAsk,
  currencyCode,
  termPreset,
  customDays,
  planText,
  owedText,
  posting,
  canContinue,
  onTermPreset,
  onCustomDays,
  onContinue,
}: {
  phase: Exclude<CreditAskPhase, 'amount'>;
  bitcoinAsk: boolean;
  currencyCode: ForumGoalCurrency;
  termPreset: CreditTermPreset;
  customDays: string;
  planText: string;
  owedText: string;
  posting: boolean;
  canContinue: boolean;
  onTermPreset: (value: CreditTermPreset) => void;
  onCustomDays: (value: string) => void;
  onContinue: () => void;
}): ReactElement {
  const { t } = useTranslations();
  const currencyName =
    currencyCode === 'BTC'
      ? 'Bitcoin'
      : t(`forum.creditCurrency.${currencyCode}` as 'forum.creditCurrency.USD');
  const currencySentence = bitcoinAsk
    ? t('forum.creditInBitcoin')
    : t('forum.creditInFiat', { currency: currencyName });
  const continueDisabled = posting || ((phase === 'term' || phase === 'plan') && !canContinue);
  const confirmLabel =
    phase === 'confirmWant'
      ? t('forum.creditWant')
      : phase === 'confirmCan'
        ? t('forum.creditCanButton')
        : t('forum.askContinue');
  return (
    <>
      {phase === 'currency' ? (
        <div className="flex flex-col gap-2 text-sm text-app-fg">
          <p>{currencySentence}</p>
          {bitcoinAsk ? <p>{t('forum.creditBitcoinRisk')}</p> : <p>{t('forum.creditFiatRisk')}</p>}
        </div>
      ) : null}
      {phase === 'term' ? (
        <>
          <SegmentedControl
            value={String(termPreset)}
            options={[
              { value: '30', label: t('forum.creditTerm30') },
              { value: '365', label: t('forum.creditTerm365') },
              { value: '730', label: t('forum.creditTerm730') },
              { value: 'custom', label: t('forum.creditTermCustom') },
            ]}
            onChange={(value) => {
              onTermPreset(value === 'custom' ? 'custom' : (Number(value) as 30 | 365 | 730));
            }}
            ariaLabel={t('forum.creditTermLabel')}
            tone="neutral"
            className="!grid grid-cols-2 !rounded-2xl"
          />
          {termPreset === 'custom' ? (
            <label className="flex flex-col gap-1 text-sm text-app-fg">
              <span>{t('forum.creditTermDays')}</span>
              <input
                inputMode="numeric"
                aria-label={t('forum.creditTermDays')}
                value={customDays}
                onChange={(event) => {
                  onCustomDays(event.target.value);
                }}
                className="rounded-xl border border-app-border bg-app-card px-3 py-2"
              />
            </label>
          ) : null}
        </>
      ) : null}
      {phase === 'plan' ? (
        <div className="flex flex-col gap-2 text-sm text-app-fg">
          <p>{t('forum.creditPlanBody')}</p>
          <p>{t('forum.creditInterest')}</p>
          <p>{t('forum.creditDaily', { plan: planText })}</p>
        </div>
      ) : null}
      {phase === 'confirmWant' ? (
        <div className="flex flex-col gap-2 text-sm text-app-fg">
          <p>{t('forum.creditAmountOwed', { amount: owedText })}</p>
          <p>{currencySentence}</p>
          {bitcoinAsk ? <p>{t('forum.creditBitcoinRisk')}</p> : <p>{t('forum.creditFiatRisk')}</p>}
          <p>
            {t('forum.creditTermSummary', {
              term: creditTermLabel(termPreset, customDays, t),
            })}
          </p>
          <p>{t('forum.creditPlanBody')}</p>
          <p>{t('forum.creditInterest')}</p>
          <p>{t('forum.creditDaily', { plan: planText })}</p>
        </div>
      ) : null}
      {phase === 'confirmCan' ? (
        <p className="text-sm text-app-fg">{t('forum.creditCan', { plan: planText })}</p>
      ) : null}
      <Button type="button" variant="primary" disabled={continueDisabled} onClick={onContinue}>
        {confirmLabel}
      </Button>
    </>
  );
}
