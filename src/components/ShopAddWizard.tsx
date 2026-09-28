'use client';

import { ImagePlus, X } from 'lucide-react';
import { useEffect, useRef, useState, type ReactElement } from 'react';
import { PlaceField } from '@/components/PlaceField';
import { useTranslations } from '@/components/LocaleProvider';
import { Button, IconButton } from '@/components/ui';
import type { ForumPlacePin } from '@/lib/api-types';
import type { ForumPhotoPayload } from '@/lib/forum-photo';
import type { ForumVideoPayload } from '@/lib/forum-video';

/** One step of the shop submission, after the closed button. */
type ShopAddStep = 1 | 2 | 3 | 4 | 5;

/** Props for the guided shop composer. */
export interface ShopAddWizardProps {
  /** True while the note is being sent. */
  posting: boolean;
  /** Visible shop text. The shop tag is added on send. */
  draft: string;
  /** Replace the visible shop text. */
  onDraftChange: (text: string) => void;
  /** Prepared stills waiting to send. */
  photoDrafts: ForumPhotoPayload[];
  /** Prepared video waiting to send, or null. */
  videoDraft: ForumVideoPayload | null;
  /** Files chosen on the photo step. */
  onPickFiles: (files: File[]) => void;
  /** Remove one pending still. */
  onRemovePhoto: (index: number) => void;
  /** Clear a pending video. */
  onClearPhoto: () => void;
  /** Map pin, or null when unset. */
  place: ForumPlacePin | null;
  /** Replace the map pin. */
  onPlaceChange: (place: ForumPlacePin | null) => void;
  /** Optional 21.gifts username, without a required \@. */
  username: string;
  /** Replace the optional username. */
  onUsernameChange: (username: string) => void;
  /** Send the shop from the summary. */
  onSubmit: () => void;
  /** Drop the draft and close. */
  onCancel: () => void;
  /** Increments after a successful send so the wizard closes. */
  resetToken: number;
  /** Maximum length of the text step. */
  maxLength: number;
}

const STEP_KEY = {
  1: 'shops.stepPhotos',
  2: 'shops.stepPlace',
  3: 'shops.stepText',
  4: 'shops.stepAccount',
  5: 'shops.stepSummary',
} as const;

/**
 * Guided shop submission. Closed state is only **Add a shop**. Open steps
 * are photos, place, text, an optional 21.gifts username, then a summary
 * whose send control submits the note.
 *
 * @param props - Draft fields and the send/cancel callbacks.
 * @returns The button, or the current step.
 */
export function ShopAddWizard({
  posting,
  draft,
  onDraftChange,
  photoDrafts,
  videoDraft,
  onPickFiles,
  onRemovePhoto,
  onClearPhoto,
  place,
  onPlaceChange,
  username,
  onUsernameChange,
  onSubmit,
  onCancel,
  resetToken,
  maxLength,
}: ShopAddWizardProps): ReactElement {
  const { t } = useTranslations();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<ShopAddStep | 'closed'>('closed');

  useEffect(() => {
    setStep('closed');
  }, [resetToken]);

  if (step === 'closed') {
    return (
      <Button
        type="button"
        variant="primary"
        disabled={posting}
        onClick={() => {
          setStep(1);
        }}
      >
        {t('shops.add')}
      </Button>
    );
  }

  const title = t(STEP_KEY[step]);

  return (
    <form
      className="flex flex-col gap-3 rounded-2xl border border-app-border p-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (step === 5) {
          onSubmit();
        }
      }}
    >
      <p className="text-sm font-medium text-app-fg">
        {step} / 5 · {title}
      </p>
      {step === 1 ? (
        <div className="flex flex-col gap-2">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime,video/x-m4v,.mp4,.webm,.mov,.m4v"
            className="hidden"
            disabled={posting}
            onChange={(event) => {
              const list = event.target.files;
              if (list !== null && list.length > 0) {
                onPickFiles(Array.from(list));
              }
              event.target.value = '';
            }}
          />
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
          {videoDraft !== null ? (
            <div className="flex items-start gap-3">
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
          {photoDrafts.length > 0 ? (
            <ul className="flex flex-wrap gap-3">
              {photoDrafts.map((photo, index) => (
                <li key={`${photo.previewUrl}:${index}`} className="flex items-start gap-1">
                  {/* eslint-disable-next-line @next/next/no-img-element -- data URL preview */}
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
        </div>
      ) : null}
      {step === 2 ? <PlaceField place={place} disabled={posting} onChange={onPlaceChange} /> : null}
      {step === 3 ? (
        <textarea
          aria-label={t('shops.textLabel')}
          value={draft}
          onChange={(event) => {
            onDraftChange(event.target.value);
          }}
          maxLength={maxLength}
          rows={4}
          disabled={posting}
          className="min-h-24 w-full resize-none rounded-2xl border border-app-border-strong px-4 py-2.5 text-base text-app-fg disabled:opacity-50"
        />
      ) : null}
      {step === 4 ? (
        <label className="flex flex-col gap-1">
          <span className="text-sm text-app-fg">{t('shops.accountOptional')}</span>
          <input
            aria-label={t('shops.accountLabel')}
            value={username}
            onChange={(event) => {
              onUsernameChange(event.target.value);
            }}
            disabled={posting}
            className="min-h-11 rounded-2xl border border-app-border-strong px-4 text-base text-app-fg disabled:opacity-50"
          />
        </label>
      ) : null}
      {step === 5 ? (
        <dl className="flex flex-col gap-2 text-sm text-app-fg">
          <div>
            <dt className="text-app-muted">{t('shops.stepPhotos')}</dt>
            <dd>
              {photoDrafts.length + (videoDraft !== null ? 1 : 0) === 0
                ? t('shops.summaryNone')
                : String(photoDrafts.length + (videoDraft !== null ? 1 : 0))}
            </dd>
          </div>
          <div>
            <dt className="text-app-muted">{t('shops.stepPlace')}</dt>
            <dd>
              {place === null
                ? t('shops.summaryNone')
                : typeof place.label === 'string' && place.label.trim() !== ''
                  ? place.label
                  : `${place.lat}, ${place.lng}`}
            </dd>
          </div>
          <div>
            <dt className="text-app-muted">{t('shops.stepText')}</dt>
            <dd className="whitespace-pre-wrap">
              {draft.trim() === '' ? t('shops.summaryNone') : draft}
            </dd>
          </div>
          <div>
            <dt className="text-app-muted">{t('shops.stepAccount')}</dt>
            <dd>
              {username.trim() === ''
                ? t('shops.summaryNone')
                : `@${username.trim().replace(/^@/, '')}`}
            </dd>
          </div>
        </dl>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {step === 1 ? (
          <Button
            type="button"
            variant="secondary"
            disabled={posting}
            onClick={() => {
              onCancel();
              setStep('closed');
            }}
          >
            {t('shops.cancel')}
          </Button>
        ) : (
          <Button
            type="button"
            variant="secondary"
            disabled={posting}
            onClick={() => {
              setStep((step - 1) as ShopAddStep);
            }}
          >
            {t('shops.back')}
          </Button>
        )}
        {step < 5 ? (
          <Button
            type="button"
            variant="primary"
            disabled={posting}
            onClick={() => {
              setStep((step + 1) as ShopAddStep);
            }}
          >
            {t('shops.next')}
          </Button>
        ) : (
          <Button type="submit" variant="primary" disabled={posting}>
            {t('forum.post')}
          </Button>
        )}
      </div>
    </form>
  );
}
