'use client';

import { ImagePlus, X } from 'lucide-react';
import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactElement,
} from 'react';
import { MentionTextarea } from '@/components/MentionTextarea';
import { PlaceField } from '@/components/PlaceField';
import {
  ShopAccountSuggestions,
  type ShopAccountSuggestion,
} from '@/components/ShopAccountSuggestions';
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
  shopAccountRequiredProblem,
  shopDescriptionProblem,
  shopDescriptionRemaining,
  shopDescriptionText,
  shopPlaceComplete,
  shopProblemField,
  shopUsernameProblem,
  type ShopApiProblem,
} from '@/lib/forum-shop';
import type { MessageKey } from '@/lib/messages';
import { lookupAccountByUsername, searchMentionAccounts } from '@/lib/mention-search';
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

const USERNAME_PREFIX = /^[a-z0-9][a-z0-9._-]{0,31}$/;

/** First rows only. A longer list would be a second scroller, which the page forbids. */
const SUGGESTION_LIMIT = 8;

/**
 * Username prefix after a leading `@`, or `null` when the field is not a mention.
 *
 * Empty string means the field is exactly `@` and the first suggestion page applies.
 * Any space, including a trailing one, is not a username and closes the list.
 *
 * @param draft - Current field value.
 * @returns The lowercase prefix, `""`, or `null`.
 */
function mentionQuery(draft: string): string | null {
  if (draft === '@') {
    return '';
  }
  if (!draft.startsWith('@') || draft.includes(' ')) {
    return null;
  }
  const query = draft.slice(1).toLowerCase();
  if (!USERNAME_PREFIX.test(query)) {
    return null;
  }
  return query;
}

/**
 * Shop-account field value.
 *
 * A value that already starts with `@` is kept, including a space after it,
 * so `@ ` still closes the list. Blank and a lone `@` with only surrounding
 * spaces stay `@`. Leading space before `@handle` is trimmed to that one `@`,
 * so save still strips a single prefix. Any other value gets one leading `@`.
 *
 * @param value - Parent username.
 * @returns The value shown in the field.
 */
function accountFieldValue(value: string): string {
  if (value.startsWith('@')) {
    return value;
  }
  const trimmed = value.trim();
  if (trimmed === '' || trimmed === '@') {
    return '@';
  }
  if (trimmed.startsWith('@')) {
    return trimmed;
  }
  return `@${value}`;
}

/** Username without a leading `@`, trimmed and lowercased. */
function strippedHandle(value: string): string {
  return value.trim().replace(/^@/, '').trim().toLowerCase();
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
  /** True while the note is being sent or a photo is still being prepared. */
  posting: boolean;
  /**
   * Sentence above the buttons while `posting` is true.
   * Omitted when nothing is in flight.
   */
  busyLabel?: string;
  /**
   * Locks Cancel when true.
   * Omitted means Cancel uses `posting`. Photo preparation leaves this false
   * so Cancel can discard a pick that has not finished.
   */
  cancelDisabled?: boolean;
  /**
   * When true, Next and the chrome Back stay usable while `posting` is true.
   * Fields and Save stay locked. The edit screen sets this while a photo is
   * still being prepared, so the reason stays on screen and Save stays off.
   */
  allowStepsWhilePosting?: boolean;
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
  /** 21.gifts username. The account step shows it with a leading \@. */
  username: string;
  /** Replace the username. The account step always sends a value that starts with \@. */
  onUsernameChange: (username: string) => void;
  /** Send the shop from the summary. */
  onSubmit: () => void;
  /** Close an edit. The add wizard does not show a cancel button. */
  onCancel?: () => void;
  /** Increments after a successful send so the wizard closes. */
  resetToken: number;
  /** Text box limit; the 1000-character shop text rule is shown by the counter and error. */
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
  photoError?: 'unsupported' | 'tooLarge' | 'tooMany' | 'formatOrSize' | null;
  /** Media the API rejected for format or size; marked and blocking while still attached. */
  rejectedMedia?: readonly object[];
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

/** Message key for one photo-picker reason. */
function photoErrorKey(
  error: 'unsupported' | 'tooLarge' | 'tooMany' | 'formatOrSize',
  imagesOnly: boolean,
): MessageKey {
  if (error === 'tooMany') {
    return 'forum.errorTooMany';
  }
  if (error === 'formatOrSize') {
    return imagesOnly ? 'inbox.errorFormatOrSize' : 'forum.errorFormatOrSize';
  }
  if (error === 'tooLarge') {
    return imagesOnly ? 'inbox.errorTooLarge' : 'forum.errorTooLarge';
  }
  return imagesOnly ? 'inbox.errorUnsupported' : 'forum.errorUnsupported';
}

/**
 * Guided shop submission. Closed state is only **Add a shop**. Open steps
 * are photos, place, text, a required 21.gifts username, then a summary
 * whose send control submits the note. The text step lists people as
 * soon as `@` is typed. The account step starts at `@` and lists people
 * whose username starts with what was typed. Arrow keys move the highlight
 * and Enter picks that person without posting. A failed account lookup does
 * not block the API-validated submit. An empty handle does, and that reason
 * is a linked field error. Adding a shop
 * shows Next on the photo step. Edit mode shows an icon-only Close (X)
 * there. Its accessible name is Cancel.
 *
 * @param props - Draft fields and the send callback.
 * @returns The button, or the current step.
 */
export function ShopAddWizard({
  posting,
  busyLabel,
  cancelDisabled,
  allowStepsWhilePosting = false,
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
  rejectedMedia = [],
  serverProblem = null,
}: ShopAddWizardProps): ReactElement {
  const { t, locale } = useTranslations();
  const session = useAuthStore((state) => state.session);
  const { setOverride } = useChromeBack();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const descriptionRef = useRef<HTMLTextAreaElement>(null);
  const idPrefix = useId();
  const photoFeedbackId = `${idPrefix}-photo-feedback`;
  const photoAddButtonId = `${idPrefix}-photo-add`;
  const descriptionHintId = `${idPrefix}-description-feedback`;
  const accountUsernameId = `${idPrefix}-account-username`;
  const [step, setStep] = useState<ShopAddStep | 'closed'>(mode === 'edit' ? 1 : 'closed');
  const currentStepRef = useRef(step);
  currentStepRef.current = step;
  // The summary control replaces Next in the same spot. Ignore that same click.
  const [summaryArmed, setSummaryArmed] = useState(false);
  // Skip the mount run. useState already opened on the right step, and
  // repeating it undoes a Next click from the same turn the editor opened.
  const appliedReset = useRef(`${mode}:${String(resetToken)}`);
  const initialHandle = useRef(strippedHandle(username));
  const lastAutoOpenedPlaceProblem = useRef<ShopApiProblem | null>(null);
  const rejectionFocusStep = useRef<1 | 3 | 4 | null>(null);
  const [mapsUnavailable, setMapsUnavailable] = useState(false);
  const [usernameLookup, setUsernameLookup] = useState<
    'idle' | 'checking' | 'found' | 'missing' | 'failed'
  >('idle');
  const [seed, setSeed] = useState<readonly ShopAccountSuggestion[]>([]);
  const [remote, setRemote] = useState<{
    query: string;
    rows: readonly ShopAccountSuggestion[];
  } | null>(null);
  const [accountActive, setAccountActive] = useState(0);

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
      rejectionFocusStep.current = null;
      setStep(2);
      return;
    }
    const target = field === 'text' ? 3 : 4;
    rejectionFocusStep.current = currentStepRef.current === target ? null : target;
    setStep(target);
  }, [serverProblem]);

  const serverProblemField = serverProblem === null ? null : shopProblemField(serverProblem);
  const placeServerProblem = serverProblemField === 'place';
  const autoOpenPlaceProblem =
    step === 2 &&
    serverProblem !== null &&
    placeServerProblem &&
    serverProblem !== lastAutoOpenedPlaceProblem.current;

  useEffect(() => {
    // A cleared problem may come back from the next post; announce it again then.
    if (serverProblem === null) {
      lastAutoOpenedPlaceProblem.current = null;
    } else if (autoOpenPlaceProblem) {
      lastAutoOpenedPlaceProblem.current = serverProblem;
    }
  }, [autoOpenPlaceProblem, serverProblem]);

  useEffect(() => {
    // A photo reason from the server returns an open wizard to the photos step.
    if (photoError !== null && currentStepRef.current !== 'closed') {
      rejectionFocusStep.current = currentStepRef.current === 1 ? null : 1;
      setStep(1);
    }
  }, [photoError]);

  useEffect(() => {
    const target = rejectionFocusStep.current;
    if (target === null || target !== step) return;
    rejectionFocusStep.current = null;
    // Restore focus after a rejected submit replaced its button with the owning step.
    const control =
      step === 1
        ? document.getElementById(photoAddButtonId)
        : step === 3
          ? descriptionRef.current
          : document.getElementById(accountUsernameId);
    control!.focus();
  }, [accountUsernameId, photoAddButtonId, step]);

  const normalizedUsername = strippedHandle(username);
  const usernameEmpty = shopAccountRequiredProblem(username) === 'required';
  const accountValue = accountFieldValue(username);
  const mentionPrefix = session !== null && step === 4 ? mentionQuery(accountValue) : null;
  useEffect(() => {
    setAccountActive(0);
  }, [mentionPrefix]);
  const usernameFormatProblem = shopUsernameProblem(username);
  useEffect(() => {
    if (step !== 4) {
      return;
    }
    const next = accountFieldValue(username);
    if (next !== username) {
      onUsernameChange(next);
    }
  }, [onUsernameChange, step, username]);
  useEffect(() => {
    if (usernameEmpty) {
      setUsernameLookup('idle');
      return;
    }
    if (usernameFormatProblem !== null) {
      setUsernameLookup('idle');
      return;
    }
    if (
      session === null ||
      (mode === 'edit' &&
        initialHandle.current !== '' &&
        normalizedUsername === initialHandle.current)
    ) {
      setUsernameLookup('found');
      return;
    }
    let cancelled = false;
    setUsernameLookup('checking');
    const timer = window.setTimeout(() => {
      void lookupAccountByUsername(session, normalizedUsername)
        .then((verdict) => {
          if (!cancelled) {
            setUsernameLookup(verdict);
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
  }, [mode, normalizedUsername, session, username, usernameEmpty, usernameFormatProblem]);
  useEffect(() => {
    if (session === null || mentionPrefix === null) {
      setSeed([]);
      setRemote(null);
      return;
    }
    const current = session;
    const requested = mentionPrefix;
    let cancelled = false;
    if (requested !== '') {
      setRemote(null);
    }
    void searchMentionAccounts(current, requested)
      .then((rows) => {
        if (cancelled) {
          return;
        }
        if (requested === '') {
          setSeed(rows);
          return;
        }
        setRemote({ query: requested, rows });
      })
      .catch(() => {
        if (cancelled) {
          return;
        }
        if (requested === '') {
          setSeed([]);
          return;
        }
        setRemote({ query: requested, rows: [] });
      });
    return () => {
      cancelled = true;
    };
  }, [mentionPrefix, session]);

  useLayoutEffect(() => {
    if (step === 'closed' || step === 1) {
      setOverride(null);
      return (): void => {
        setOverride(null);
      };
    }
    setOverride({
      labelKey: 'shops.back',
      disabled: posting && !allowStepsWhilePosting,
      onClick: (): void => {
        setSummaryArmed(false);
        setStep((current) => retreatShopStep(current));
      },
    });
    return (): void => {
      setOverride(null);
    };
  }, [allowStepsWhilePosting, posting, setOverride, step]);

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
      : !usernameEmpty && usernameLookup === 'missing'
        ? 'missing'
        : null;
  const usernamePending = !usernameEmpty && usernameLookup === 'checking';
  const descriptionServerProblem = serverProblemField === 'text';
  const usernameServerProblem = serverProblemField === 'username';
  const placeServerMessage =
    placeServerProblem && serverProblem !== null ? t(SHOP_API_MESSAGE[serverProblem]) : null;
  // Rejected files would fail the same request again; a photo reason returns the wizard to step 1.
  const isRejected = (item: object): boolean => rejectedMedia.includes(item);
  const photoRejected =
    (videoDraft !== null && isRejected(videoDraft)) || photoDrafts.some(isRejected);
  const stepsLocked = posting && !allowStepsWhilePosting;
  const nextDisabled =
    stepsLocked ||
    (step === 1 && photoRejected) ||
    (step === 2 && (!placeComplete || placeServerProblem)) ||
    (step === 3 && (descriptionProblem !== null || descriptionServerProblem)) ||
    (step === 4 &&
      (usernameEmpty || usernameProblem !== null || usernamePending || usernameServerProblem));
  const submitDisabled =
    posting ||
    !summaryArmed ||
    !placeComplete ||
    placeServerProblem ||
    descriptionProblem !== null ||
    descriptionServerProblem ||
    usernameEmpty ||
    usernameProblem !== null ||
    usernamePending ||
    usernameServerProblem;
  const descriptionHint =
    descriptionServerProblem && serverProblem !== null
      ? t(SHOP_API_MESSAGE[serverProblem])
      : descriptionProblem === 'short'
        ? t('shops.problemDescriptionShort', { count: shopDescriptionRemaining(draft) })
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
        ? t('login.nameInvalid')
        : usernameProblem === 'missing'
          ? t('shops.problemUsernameMissing')
          : usernameEmpty
            ? t('forum.shopAccountHint')
            : undefined;
  const usernameHint = usernamePending ? t('shops.usernameChecking') : undefined;
  // While a send is in flight (for example the fee sheet), the parent may clear the draft.
  const summaryProblem =
    step !== 5 || posting
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
  const accountSuggestions = (
    mentionPrefix === null
      ? []
      : mentionPrefix === ''
        ? seed
        : remote !== null && remote.query === mentionPrefix
          ? remote.rows
          : seed.filter((row) => row.username.toLowerCase().startsWith(mentionPrefix))
  ).slice(0, SUGGESTION_LIMIT);
  const accountActiveIndex =
    accountSuggestions.length === 0 ? 0 : accountActive % accountSuggestions.length;

  const onAccountKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) {
      return;
    }
    if (accountSuggestions.length === 0) {
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setAccountActive((index) => (index + 1) % accountSuggestions.length);
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setAccountActive(
        (index) => (index - 1 + accountSuggestions.length) % accountSuggestions.length,
      );
      return;
    }
    if (event.key === 'Home') {
      event.preventDefault();
      setAccountActive(0);
      return;
    }
    if (event.key === 'End') {
      event.preventDefault();
      setAccountActive(accountSuggestions.length - 1);
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      const row = accountSuggestions[accountActiveIndex];
      /* v8 ignore next 3 -- the list is open only while a row is shown */
      if (row === undefined) {
        return;
      }
      onUsernameChange(`@${row.username}`);
    }
  };

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
            aria-invalid={photoError === null && !photoRejected ? undefined : true}
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
            id={photoAddButtonId}
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
            {photoError !== null || photoRejected ? (
              <p role="alert" className="flex flex-col text-sm text-app-danger">
                {[
                  ...(photoError === null ? [] : [t(photoErrorKey(photoError, imagesOnly))]),
                  ...(photoRejected && photoError !== 'formatOrSize'
                    ? [t(photoErrorKey('formatOrSize', imagesOnly))]
                    : []),
                  ...(photoRejected ? [t('shops.photoRejectedHint')] : []),
                ].map((line) => (
                  <span key={line}>{line}</span>
                ))}
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
                className={`h-20 w-20 rounded-lg object-cover${
                  isRejected(videoDraft) ? ' border-2 border-app-danger' : ''
                }`}
                {...(isRejected(videoDraft) ? { 'aria-describedby': photoFeedbackId } : {})}
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
                    className={`h-20 w-20 rounded-lg object-cover${
                      isRejected(photo) ? ' border-2 border-app-danger' : ''
                    }`}
                    {...(isRejected(photo) ? { 'aria-describedby': photoFeedbackId } : {})}
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
          {/* Check the name against the text only once the text meets its own rules. */}
          <PlaceField
            place={place}
            disabled={posting}
            onChange={onPlaceChange}
            shopDetails
            {...(shopDescriptionProblem(draft, null) === null ? { shopText: draft } : {})}
            problem={serverProblem}
            autoOpenProblem={autoOpenPlaceProblem}
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
            textareaRef={descriptionRef}
            ariaLabel={t('shops.textLabel')}
            value={draft}
            onChange={onDraftChange}
            maxLength={maxLength}
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
              {t('shops.descriptionCount', {
                n: shopDescriptionText(draft).length,
                max: SHOP_DESCRIPTION_MAX,
              })}
            </p>
          </div>
        </div>
      ) : null}
      {step === 4 ? (
        <div className="flex flex-col gap-1">
          <Field
            id={accountUsernameId}
            label={t('shops.accountLabel')}
            value={accountValue}
            disabled={stepsLocked}
            {...(usernameHint === undefined ? {} : { hint: usernameHint })}
            autoComplete="off"
            aria-autocomplete="list"
            {...(accountSuggestions.length > 0
              ? {
                  'aria-controls': `${idPrefix}-account-suggest`,
                  'aria-activedescendant': `${idPrefix}-account-option-${String(accountActiveIndex)}`,
                }
              : {})}
            {...(usernameError === undefined
              ? {}
              : { error: usernameError, errorAnnounce: usernameServerProblem })}
            onKeyDown={onAccountKeyDown}
            onChange={(event) => {
              onUsernameChange(accountFieldValue(event.target.value));
            }}
          />
          {accountSuggestions.length > 0 ? (
            <ShopAccountSuggestions
              listId={`${idPrefix}-account-suggest`}
              rows={accountSuggestions}
              activeIndex={accountActiveIndex}
              disabled={stepsLocked}
              className="rounded-xl border border-app-border bg-app-card p-2"
              optionId={(index) => `${idPrefix}-account-option-${String(index)}`}
              onPick={(username) => {
                onUsernameChange(`@${username}`);
              }}
            />
          ) : null}
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
            <dd>{usernameEmpty ? t('shops.summaryNone') : `@${normalizedUsername}`}</dd>
          </div>
        </dl>
      ) : null}
      {summaryProblem === null ? null : <p className="text-sm text-app-danger">{summaryProblem}</p>}
      {posting && typeof busyLabel === 'string' && busyLabel !== '' ? (
        <p className="text-sm text-app-muted">{busyLabel}</p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {step === 1 && cancelEdit !== undefined ? (
          <IconButton
            type="button"
            variant="secondary"
            size="md"
            disabled={cancelDisabled !== undefined ? cancelDisabled : posting}
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
