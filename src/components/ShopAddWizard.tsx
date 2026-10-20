'use client';

import { ImagePlus, X } from 'lucide-react';
import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactElement } from 'react';
import { MentionTextarea } from '@/components/MentionTextarea';
import { PlaceField } from '@/components/PlaceField';
import { useTranslations } from '@/components/LocaleProvider';
import { useChromeBack } from '@/components/ViewHistoryRoot';
import { Button, Field, IconButton } from '@/components/ui';
import type { ForumPlacePin } from '@/lib/api-types';
import type { ForumPhotoPayload } from '@/lib/forum-photo';
import type { ForumVideoPayload } from '@/lib/forum-video';
import {
  SHOP_API_MESSAGE,
  SHOP_DESCRIPTION_MAX,
  formatShopAddressLine,
  shopDescriptionProblem,
  shopDescriptionRemaining,
  shopPlaceComplete,
  shopProblemField,
  shopUsernameProblem,
  usernameLookupVerdict,
  type ShopApiProblem,
} from '@/lib/forum-shop';
import { searchMentionAccounts } from '@/lib/mention-search';
import { useAuthStore } from '@/stores/auth-store';

/** One step of the shop submission, after the closed button. */
type ShopAddStep = 1 | 2 | 3 | 4 | 5;

function advanceShopStep(current: ShopAddStep | 'closed'): ShopAddStep | 'closed' {
  /* v8 ignore start -- Next is not mounted when the wizard is closed or already on the summary */
  if (current === 'closed' || current >= 5) {
    return current;
  }
  /* v8 ignore stop */
  return (current + 1) as ShopAddStep;
}

function retreatShopStep(current: ShopAddStep | 'closed'): ShopAddStep | 'closed' {
  /* v8 ignore start -- Back is not mounted when the wizard is closed or still on the photo step */
  if (current === 'closed' || current <= 1) {
    return current;
  }
  /* v8 ignore stop */
  return (current - 1) as ShopAddStep;
}

/** A still or video already stored on the shop note. */
export interface ShopKeptMedia {
  /** Preview URL already loaded for this note. */
  url: string;
  /** Whether the URL is a video or a still. */
  kind: 'photo' | 'video';
}

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
  /** Close an edit. The add wizard does not show a cancel button. */
  onCancel?: () => void;
  /** Increments after a successful send so the wizard closes. */
  resetToken: number;
  /** Outer text limit; shop descriptions are additionally capped at 1000. */
  maxLength: number;
  /** `edit` opens on step 1 for an existing shop. Default `create`. */
  mode?: 'create' | 'edit';
  /** Summary button label. Default is the post label. */
  submitLabel?: string;
  /** Stills and video already on the note. */
  keptMedia?: readonly ShopKeptMedia[];
  /** Remove one kept still. Videos stay. */
  onRemoveKept?: (index: number) => void;
  /** When true, the file picker accepts stills only. */
  imagesOnly?: boolean;
  /** Photo-picker rule currently broken. */
  photoError?: 'unsupported' | 'tooLarge' | 'tooMany' | null;
  /** Known API fallback to place back at its owning step and field. */
  serverProblem?: ShopApiProblem | null;
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
 * whose send control submits the note. The text step lists people as
 * soon as `@` is typed. A failed optional-account lookup does not block the
 * API-validated submit. Adding a shop shows Next on the photo step.
 * Edit mode shows an icon-only Close (X) there. Its accessible name is Cancel.
 *
 * @param props - Draft fields and the send callback.
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
  mode = 'create',
  submitLabel,
  keptMedia = [],
  onRemoveKept,
  imagesOnly = false,
  photoError = null,
  serverProblem = null,
}: ShopAddWizardProps): ReactElement {
  const { t, locale } = useTranslations();
  const session = useAuthStore((state) => state.session);
  const { setOverride } = useChromeBack();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const idPrefix = useId();
  const photoFeedbackId = `${idPrefix}-photo-feedback`;
  const descriptionHintId = `${idPrefix}-description-feedback`;
  const accountUsernameId = `${idPrefix}-account-username`;
  const [step, setStep] = useState<ShopAddStep | 'closed'>(mode === 'edit' ? 1 : 'closed');
  // The summary control replaces Next in the same spot. Ignore that same click.
  const [summaryArmed, setSummaryArmed] = useState(false);
  // Skip the mount run. useState already opened on the right step, and
  // repeating it undoes a Next click from the same turn the editor opened.
  const appliedReset = useRef(`${mode}:${String(resetToken)}`);
  const initialUsername = useRef(username);
  const [mapsUnavailable, setMapsUnavailable] = useState(false);
  const [usernameLookup, setUsernameLookup] = useState<
    'idle' | 'checking' | 'found' | 'missing' | 'unknown' | 'failed'
  >('idle');

  useEffect(() => {
    const key = `${mode}:${String(resetToken)}`;
    if (appliedReset.current === key) {
      return;
    }
    appliedReset.current = key;
    setStep(mode === 'edit' ? 1 : 'closed');
  }, [resetToken, mode]);

  useEffect(() => {
    setSummaryArmed(step === 5);
  }, [step]);

  useEffect(() => {
    if (serverProblem === null) return;
    const field = shopProblemField(serverProblem);
    if (field === 'place') {
      setStep(2);
      return;
    }
    if (field === 'text') {
      setStep(3);
      return;
    }
    setStep(4);
  }, [serverProblem]);

  useEffect(() => {
    if (mode === 'edit' && photoError !== null) {
      setStep(1);
    }
  }, [mode, photoError]);

  const normalizedUsername = username.trim().replace(/^@/, '').trim().toLowerCase();
  const usernameFormatProblem = shopUsernameProblem(username);
  useEffect(() => {
    if (normalizedUsername === '') {
      setUsernameLookup('idle');
      return;
    }
    if (usernameFormatProblem !== null) {
      setUsernameLookup('idle');
      return;
    }
    if (session === null || (mode === 'edit' && username === initialUsername.current)) {
      setUsernameLookup('found');
      return;
    }
    let cancelled = false;
    setUsernameLookup('checking');
    const timer = window.setTimeout(() => {
      void searchMentionAccounts(session, normalizedUsername)
        .then((rows) => {
          if (!cancelled) {
            setUsernameLookup(usernameLookupVerdict(rows, normalizedUsername));
          }
        })
        .catch(() => {
          if (!cancelled) setUsernameLookup('failed');
        });
    }, 150);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [mode, normalizedUsername, session, username, usernameFormatProblem]);

  useLayoutEffect(() => {
    if (step === 'closed' || step === 1) {
      setOverride(null);
      return (): void => {
        setOverride(null);
      };
    }
    setOverride({
      labelKey: 'shops.back',
      disabled: posting,
      onClick: (): void => {
        setSummaryArmed(false);
        setStep((current) => retreatShopStep(current));
      },
    });
    return (): void => {
      setOverride(null);
    };
  }, [posting, setOverride, step]);

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
  const cancelEdit = mode === 'edit' ? onCancel : undefined;
  const placeComplete = shopPlaceComplete(place);
  const descriptionProblem = shopDescriptionProblem(draft, place?.label ?? null);
  const usernameProblem =
    usernameFormatProblem !== null
      ? 'format'
      : normalizedUsername !== '' && usernameLookup === 'missing'
        ? 'missing'
        : null;
  const usernamePending = normalizedUsername !== '' && usernameLookup === 'checking';
  const serverProblemField = serverProblem === null ? null : shopProblemField(serverProblem);
  const placeServerProblem = serverProblemField === 'place';
  const descriptionServerProblem = serverProblemField === 'text';
  const usernameServerProblem = serverProblemField === 'username';
  const placeServerMessage =
    placeServerProblem && serverProblem !== null ? t(SHOP_API_MESSAGE[serverProblem]) : null;
  const nextDisabled =
    posting ||
    (step === 2 && (!placeComplete || placeServerProblem)) ||
    (step === 3 && (descriptionProblem !== null || descriptionServerProblem)) ||
    (step === 4 && (usernameProblem !== null || usernamePending || usernameServerProblem));
  const submitDisabled =
    posting ||
    !summaryArmed ||
    !placeComplete ||
    placeServerProblem ||
    descriptionProblem !== null ||
    descriptionServerProblem ||
    usernameProblem !== null ||
    usernamePending ||
    usernameServerProblem;
  const descriptionHint =
    descriptionServerProblem && serverProblem !== null
      ? t(SHOP_API_MESSAGE[serverProblem])
      : descriptionProblem === 'short'
        ? t('shops.problemDescriptionShort', { n: shopDescriptionRemaining(draft) })
        : descriptionProblem === 'long'
          ? t('shops.problemDescriptionLong')
          : descriptionProblem === 'notLonger'
            ? t('shops.problemDescriptionNotLonger')
            : descriptionProblem === 'controls'
              ? t('shops.problemDescriptionControls')
              : null;
  const usernameError =
    usernameServerProblem && serverProblem !== null
      ? t(SHOP_API_MESSAGE[serverProblem])
      : usernameProblem === 'format'
        ? t('shops.problemUsernameFormat')
        : usernameProblem === 'missing'
          ? t('shops.problemUsernameMissing')
          : undefined;
  const usernameHint = usernamePending ? t('shops.usernameChecking') : t('shops.accountOptional');
  const summaryProblem =
    step !== 5
      ? null
      : !placeComplete
        ? mapsUnavailable
          ? t('shops.placeUnavailableReason')
          : t('shops.placeRequired')
        : placeServerMessage !== null
          ? placeServerMessage
          : descriptionHint !== null
            ? descriptionHint
            : usernameError !== undefined
              ? usernameError
              : usernamePending
                ? t('shops.usernameChecking')
                : null;

  return (
    <form
      className="flex w-full min-w-0 max-w-full flex-col gap-3 rounded-2xl border border-app-border p-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (step === 5) {
          onSubmit();
        }
      }}
    >
      <p className="text-sm font-medium text-app-fg">
        {t('shops.stepOf', { step, total: 5, title })}
      </p>
      {step === 1 ? (
        <div className="flex flex-col gap-2">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={
              imagesOnly
                ? 'image/jpeg,image/png,image/webp'
                : 'image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime,video/x-m4v,.mp4,.webm,.mov,.m4v'
            }
            className="hidden"
            disabled={posting}
            aria-invalid={photoError === null ? undefined : true}
            aria-describedby={photoFeedbackId}
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
            aria-describedby={photoFeedbackId}
            disabled={posting}
            onClick={() => {
              fileInputRef.current?.click();
            }}
          >
            <ImagePlus aria-hidden="true" className="block h-5 w-5 shrink-0" />
          </IconButton>
          <div id={photoFeedbackId} className="flex flex-col gap-1">
            <p className="text-sm text-app-muted">
              {t('shops.photoCount', {
                n: keptMedia.filter((item) => item.kind === 'photo').length + photoDrafts.length,
              })}
            </p>
            {photoError !== null ? (
              <p role="alert" className="text-sm text-app-danger">
                {t(
                  photoError === 'tooMany'
                    ? 'forum.errorTooMany'
                    : photoError === 'tooLarge'
                      ? imagesOnly
                        ? 'inbox.errorTooLarge'
                        : 'forum.errorTooLarge'
                      : imagesOnly
                        ? 'inbox.errorUnsupported'
                        : 'forum.errorUnsupported',
                )}
              </p>
            ) : null}
          </div>
          {keptMedia.map((item, index) =>
            item.kind === 'video' ? (
              <div key={`${item.url}:${index}`} className="flex items-start gap-3">
                <video
                  src={item.url}
                  className="h-20 w-20 rounded-lg object-cover"
                  muted
                  playsInline
                  preload="metadata"
                />
              </div>
            ) : (
              <div key={`${item.url}:${index}`} className="flex items-start gap-1">
                {/* eslint-disable-next-line @next/next/no-img-element -- already loaded shop still */}
                <img
                  src={item.url}
                  alt={t('forum.previewAlt')}
                  className="h-20 w-20 rounded-lg object-cover"
                />
                {onRemoveKept !== undefined ? (
                  <IconButton
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      onRemoveKept(index);
                    }}
                    disabled={posting}
                    aria-label={t('forum.removePhoto')}
                  >
                    <X aria-hidden="true" className="h-4 w-4" />
                  </IconButton>
                ) : null}
              </div>
            ),
          )}
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
      {step === 2 ? (
        <div className="flex flex-col gap-2">
          <PlaceField
            place={place}
            disabled={posting}
            onChange={onPlaceChange}
            shopDetails
            problem={serverProblem}
            onAvailabilityChange={setMapsUnavailable}
          />
          {!placeComplete || placeServerMessage !== null ? (
            // The open place dialog announces a server place problem; this
            // line keeps the reason visible after the dialog is closed.
            <p className="text-sm text-app-danger">
              {placeServerMessage ??
                (mapsUnavailable ? t('shops.placeUnavailableReason') : t('shops.placeRequired'))}
            </p>
          ) : null}
        </div>
      ) : null}
      {step === 3 ? (
        <div className="flex flex-col gap-2">
          <MentionTextarea
            ariaLabel={t('shops.textLabel')}
            value={draft}
            onChange={onDraftChange}
            maxLength={Math.min(maxLength, SHOP_DESCRIPTION_MAX)}
            ariaDescribedBy={descriptionHintId}
            ariaInvalid={descriptionProblem !== null || descriptionServerProblem}
            rows={4}
            disabled={posting}
            wrapperClassName="relative w-full"
            className="min-h-24 w-full resize-none rounded-2xl border border-app-border-strong px-4 py-2.5 text-base text-app-fg disabled:opacity-50"
          />
          <div id={descriptionHintId} className="flex flex-col gap-1">
            {descriptionHint !== null ? (
              <p
                role={descriptionServerProblem ? 'alert' : undefined}
                className="text-sm text-app-danger"
              >
                {descriptionHint}
              </p>
            ) : null}
            <p className="text-sm text-app-muted">
              {t('shops.descriptionCount', { n: draft.length, max: SHOP_DESCRIPTION_MAX })}
            </p>
          </div>
        </div>
      ) : null}
      {step === 4 ? (
        <div className="flex flex-col gap-1">
          <Field
            id={accountUsernameId}
            label={t('shops.accountLabel')}
            value={username}
            disabled={posting}
            hint={usernameHint}
            {...(usernameError === undefined
              ? {}
              : { error: usernameError, errorAnnounce: usernameServerProblem })}
            onChange={(event) => onUsernameChange(event.target.value)}
          />
        </div>
      ) : null}
      {step === 5 ? (
        <dl className="flex flex-col gap-2 text-sm text-app-fg">
          <div>
            <dt className="text-app-muted">{t('shops.stepPhotos')}</dt>
            <dd>
              {keptMedia.length + photoDrafts.length + (videoDraft !== null ? 1 : 0) === 0
                ? t('shops.summaryNone')
                : String(keptMedia.length + photoDrafts.length + (videoDraft !== null ? 1 : 0))}
            </dd>
          </div>
          <div>
            <dt className="text-app-muted">{t('shops.stepPlace')}</dt>
            <dd>
              {place === null ? (
                t('shops.summaryNone')
              ) : (
                <>
                  {typeof place.label === 'string' && place.label.trim() !== ''
                    ? place.label
                    : `${place.lat}, ${place.lng}`}
                  {place.address !== undefined && place.address !== null ? (
                    <span className="mt-1 block">
                      {formatShopAddressLine(place.address, locale)}
                    </span>
                  ) : null}
                </>
              )}
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
            <dd>{normalizedUsername === '' ? t('shops.summaryNone') : `@${normalizedUsername}`}</dd>
          </div>
        </dl>
      ) : null}
      {summaryProblem === null ? null : <p className="text-sm text-app-danger">{summaryProblem}</p>}
      <div className="flex flex-wrap gap-2">
        {step === 1 && cancelEdit !== undefined ? (
          <IconButton
            type="button"
            variant="secondary"
            size="md"
            disabled={posting}
            aria-label={t('shops.cancel')}
            title={t('shops.cancel')}
            onClick={cancelEdit}
          >
            <X aria-hidden="true" className="h-4 w-4" />
          </IconButton>
        ) : null}
        {step < 5 ? (
          // A new node, not the summary control. Reusing the clicked button
          // would change it to submit and send the note on the way in.
          <Button
            key="shop-step-next"
            type="button"
            variant="primary"
            disabled={nextDisabled}
            onClick={() => {
              setSummaryArmed(false);
              setStep((current) => advanceShopStep(current));
            }}
          >
            {t('shops.next')}
          </Button>
        ) : (
          <Button key="shop-step-submit" type="submit" variant="primary" disabled={submitDisabled}>
            {submitLabel ?? t('forum.post')}
          </Button>
        )}
      </div>
    </form>
  );
}
