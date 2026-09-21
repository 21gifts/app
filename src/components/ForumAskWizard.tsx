'use client';

import { ArrowLeft, ImagePlus, Loader2, X } from 'lucide-react';
import { useRef, type ChangeEvent, type ReactElement } from 'react';
import { useFiatPreference } from '@/components/FiatPreferenceProvider';
import { ForumGoalBar } from '@/components/ForumGoalBar';
import { useTranslations } from '@/components/LocaleProvider';
import { useNumberFormat } from '@/components/NumberFormatProvider';
import { preferredFiatSuffix } from '@/components/PreferredFiatSuffix';
import { Button, IconButton } from '@/components/ui';
import { FORUM_MESSAGE_MAX_LENGTH } from '@/lib/api-types';
import { parseForumAskAmount } from '@/lib/forum-goal';
import { formatBitcoin, type FiatRateDay } from '@/lib/stats-money';
import type { ForumPhotoPayload } from '@/lib/forum-photo';
import type { ForumVideoPayload } from '@/lib/forum-video';

/** Wizard step in the Ask-for-money compose flow. */
export type ForumAskStep = 1 | 2 | 3 | 4;

/**
 * Four-step Ask composer: amount, photos, text, then a preview with Post.
 *
 * @param props - Drafts, media, and step callbacks from {@link ForumLoader}.
 * @returns The wizard.
 */
export function ForumAskWizard({
  step,
  onStepChange,
  askDraft,
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
  askDraft: string;
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
  const { numberFormat } = useNumberFormat();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const parsedAsk = parseForumAskAmount(askDraft);
  const stepTitle =
    step === 1
      ? t('forum.askHowMuch')
      : step === 2
        ? t('forum.askAddPhotos')
        : step === 3
          ? t('forum.askWriteMessage')
          : t('forum.askPreview');
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
        {step > 1 ? (
          <IconButton
            type="button"
            size="sm"
            variant="ghost"
            aria-label={t('forum.askBack')}
            disabled={posting}
            onClick={() => {
              onStepChange((step - 1) as ForumAskStep);
            }}
          >
            <ArrowLeft aria-hidden="true" className="h-4 w-4" />
          </IconButton>
        ) : null}
        <h2 className="min-w-0 flex-1 text-lg font-semibold text-app-fg">{stepTitle}</h2>
        <p className="shrink-0 text-xs text-app-subtle">
          {t('forum.askStepOf', { step, total: 4 })}
        </p>
      </div>
      {step === 1 ? (
        <>
          <label
            htmlFor="forum-ask-amount"
            className="flex flex-col gap-1 text-left text-sm text-app-fg"
          >
            {t('forum.askAmountLabel')}
            <span className="flex min-h-11 items-center gap-2 rounded-2xl border border-app-border-strong px-4 py-2 text-base">
              <span aria-hidden="true" className="text-app-muted">
                ₿
              </span>
              <input
                id="forum-ask-amount"
                aria-label={t('forum.askAmountLabel')}
                type="text"
                inputMode="numeric"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                value={askDraft}
                disabled={posting}
                onChange={(event) => {
                  onAskDraftChange(event.target.value);
                }}
                className="min-w-0 flex-1 bg-transparent text-base text-app-fg"
              />
            </span>
          </label>
          {parsedAsk !== null ? (
            <p className="text-sm tabular-nums lining-nums text-app-muted">
              <span>{formatBitcoin(parsedAsk, numberFormat)}</span>
              {preferredFiatSuffix(parsedAsk, rateDay, fiat, numberFormat)}
            </p>
          ) : null}
          <Button
            type="button"
            variant="primary"
            disabled={posting || parsedAsk === null}
            onClick={() => {
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
          <div className="flex items-center justify-between gap-3">
            <Button
              type="button"
              variant="secondary"
              disabled={posting}
              onClick={() => {
                onStepChange(3);
              }}
            >
              {t('forum.askSkip')}
            </Button>
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
          </div>
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
              <ForumGoalBar sats={0} goalSats={parsedAsk} rateDay={rateDay} />
            ) : null}
          </div>
          <Button type="button" variant="primary" size="lg" disabled={posting} onClick={onPost}>
            {posting ? <Loader2 aria-hidden="true" className="h-5 w-5 animate-spin" /> : null}
            {t('forum.post')}
          </Button>
        </>
      ) : null}
    </div>
  );
}
