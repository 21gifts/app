'use client';

import { Check, ImagePlus, Link2, Loader2, Pencil, X } from 'lucide-react';
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ChangeEvent,
  type ReactElement,
} from 'react';
import { LinkedText } from '@/components/LinkedText';
import { SundayWritingGate } from '@/components/SundayWritingGate';
import { useTranslations } from '@/components/LocaleProvider';
import { TranslatableNoteBody } from '@/components/TranslatableNoteBody';
import { Button, IconButton } from '@/components/ui';
import { prepareForumPhoto, type ForumPhotoPayload } from '@/lib/forum-photo';
import { MissingRequirementsError } from '@/lib/missing-requirements';

/** Max length of an About me note, matching the API. */
const ABOUT_ME_MAX_LENGTH = 500;

/** Copied-icon flash duration, matching {@link ForumBoard}. */
const COPY_RESET_MS = 1200;

/** Owner can edit; public only shows filled text. */
export type AboutMeSectionMode = 'owner' | 'public';

/** JPEG payload sent on owner save (preview URL stripped). */
export type AboutMeSavePhoto = { contentType: string; data: string; takenAt?: string };

/** Props for {@link AboutMeSection}. */
export type AboutMeSectionProps = {
  /** Current About me text; whitespace-only or equal to `name` counts as unfilled. */
  aboutMe: string | null;
  /** Owner can edit; public only shows filled text. */
  mode: AboutMeSectionMode;
  /** Display name used to treat a name-only auto note as unfilled. */
  name?: string | null;
  /** Forum message id for translating a filled read-only About me body. */
  messageId?: string;
  /** Absolute URL to copy; omit or empty string hides the copy control. */
  profileUrl?: string;
  /** True when the live profile note has a photo. */
  hasPhoto?: boolean;
  /** Load stored photo bytes (owner: GET /me/about/photo; view/member: public). */
  loadPhoto?: () => Promise<Blob>;
  /** Load the stored profile photo. A rejection means none is stored. */
  loadPicture?: () => Promise<Blob>;
  /**
   * Owner save for the profile photo only. Not the About me note photo and
   * not the wide image. `null` clears it.
   */
  onSavePicture?: (photo: AboutMeSavePhoto | null) => Promise<void>;
  /** Load the stored wide image. A rejection means none is stored. */
  loadBanner?: () => Promise<Blob>;
  /**
   * Owner save for the wide image only. `null` clears it. Independent of
   * the About me text save.
   */
  onSaveBanner?: (photo: AboutMeSavePhoto | null) => Promise<void>;
  /**
   * Owner save. `photo` omitted = keep stored photo; `null` = clear;
   * object = replace with prepared JPEG payload.
   */
  onSave?: (text: string, photo?: AboutMeSavePhoto | null) => Promise<boolean | void>;
  /** Open the owner editor on mount. Default false. */
  startEditing?: boolean;
};

/**
 * About me block for profile cards: heading plus text or empty prompt,
 * optional photo, optional owner edit (pencil / write), and optional
 * copy-profile-link.
 *
 * @param props - About me value, owner vs public mode, optional display name,
 * optional message id, photo loaders, profile URL and save, optional
 * `startEditing` to open the owner editor on mount.
 * @returns The section, or `null` in public mode when unfilled and there is no copy URL.
 */
export function AboutMeSection({
  aboutMe,
  mode,
  name,
  messageId,
  profileUrl,
  hasPhoto,
  loadPhoto,
  loadPicture,
  onSavePicture,
  loadBanner,
  onSaveBanner,
  onSave,
  startEditing = false,
}: AboutMeSectionProps): ReactElement | null {
  const { t } = useTranslations();
  const textareaId = useId();
  const copyMounted = useRef(true);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);
  const pictureInputRef = useRef<HTMLInputElement>(null);
  const loadPhotoRef = useRef(loadPhoto);
  const storedObjectUrlRef = useRef<string | null>(null);
  const photoGeneration = useRef(0);
  const loadGeneration = useRef(0);
  const bannerGeneration = useRef(0);
  const pictureGeneration = useRef(0);
  const [editing, setEditing] = useState(startEditing);
  const [draft, setDraft] = useState(aboutMe ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [storedPhotoUrl, setStoredPhotoUrl] = useState<string | null>(null);
  const [photoDraft, setPhotoDraft] = useState<ForumPhotoPayload | null>(null);
  const [photoRemoved, setPhotoRemoved] = useState(false);
  const [preparingPhoto, setPreparingPhoto] = useState(false);
  const [bannerUrl, setBannerUrl] = useState<string | null>(null);
  const bannerUrlRef = useRef<string | null>(null);
  const [pictureUrl, setPictureUrl] = useState<string | null>(null);
  const pictureUrlRef = useRef<string | null>(null);

  loadPhotoRef.current = loadPhoto;
  const loadBannerRef = useRef(loadBanner);
  loadBannerRef.current = loadBanner;
  const loadPictureRef = useRef(loadPicture);
  loadPictureRef.current = loadPicture;

  useEffect(() => {
    if (!editing || loadBannerRef.current === undefined) {
      return;
    }
    const generation = bannerGeneration.current + 1;
    bannerGeneration.current = generation;
    const load = loadBannerRef.current;
    void (async () => {
      try {
        const blob = await load();
        if (!blob.type.startsWith('image/') || blob.size === 0) {
          throw new Error('not-image');
        }
        /* v8 ignore start -- a newer wide-image load replaced this one */
        if (generation !== bannerGeneration.current) {
          return;
        }
        /* v8 ignore end */
        if (bannerUrlRef.current !== null && bannerUrlRef.current.startsWith('blob:')) {
          URL.revokeObjectURL(bannerUrlRef.current);
        }
        const url = URL.createObjectURL(blob);
        bannerUrlRef.current = url;
        setBannerUrl(url);
      } catch {
        /* v8 ignore start -- a newer wide-image load replaced this one */
        if (generation !== bannerGeneration.current) {
          return;
        }
        /* v8 ignore end */
        setBannerUrl(null);
      }
    })();
  }, [editing]);

  useEffect(() => {
    if (!editing || loadPictureRef.current === undefined) {
      return;
    }
    const generation = pictureGeneration.current + 1;
    pictureGeneration.current = generation;
    const load = loadPictureRef.current;
    void (async () => {
      try {
        const blob = await load();
        if (!blob.type.startsWith('image/') || blob.size === 0) {
          throw new Error('not-image');
        }
        /* v8 ignore start -- a newer profile-photo load replaced this one */
        if (generation !== pictureGeneration.current) {
          return;
        }
        /* v8 ignore end */
        if (pictureUrlRef.current !== null && pictureUrlRef.current.startsWith('blob:')) {
          URL.revokeObjectURL(pictureUrlRef.current);
        }
        const url = URL.createObjectURL(blob);
        pictureUrlRef.current = url;
        setPictureUrl(url);
      } catch {
        /* v8 ignore start -- a newer profile-photo load replaced this one */
        if (generation !== pictureGeneration.current) {
          return;
        }
        /* v8 ignore end */
        setPictureUrl(null);
      }
    })();
  }, [editing]);

  const trimmedAbout = typeof aboutMe === 'string' ? aboutMe.trim() : '';
  const trimmedName = (name ?? '').trim();
  const textFilled =
    trimmedAbout !== '' &&
    (trimmedName === '' || trimmedAbout.toLowerCase() !== trimmedName.toLowerCase());
  const filled = textFilled || hasPhoto === true || (storedPhotoUrl !== null && !photoRemoved);
  const canCopy = typeof profileUrl === 'string' && profileUrl.length > 0;
  const keptPhoto = hasPhoto === true && !photoRemoved && photoDraft === null;
  const previewSrc = photoDraft?.previewUrl ?? (keptPhoto ? storedPhotoUrl : null);

  const revokeStoredObjectUrl = useCallback((): void => {
    if (storedObjectUrlRef.current !== null) {
      URL.revokeObjectURL(storedObjectUrlRef.current);
      storedObjectUrlRef.current = null;
    }
  }, []);

  useEffect(() => {
    copyMounted.current = true;
    return () => {
      copyMounted.current = false;
      photoGeneration.current += 1;
      pictureGeneration.current += 1;
      bannerGeneration.current += 1;
      if (bannerUrlRef.current !== null && bannerUrlRef.current.startsWith('blob:')) {
        URL.revokeObjectURL(bannerUrlRef.current);
      }
      if (pictureUrlRef.current !== null && pictureUrlRef.current.startsWith('blob:')) {
        URL.revokeObjectURL(pictureUrlRef.current);
      }
      if (copyTimer.current !== null) {
        clearTimeout(copyTimer.current);
      }
      revokeStoredObjectUrl();
    };
  }, [revokeStoredObjectUrl]);

  useEffect(() => {
    if (hasPhoto !== true) {
      loadGeneration.current += 1;
      revokeStoredObjectUrl();
      setStoredPhotoUrl(null);
      return;
    }
    const load = loadPhotoRef.current;
    if (load === undefined) {
      return;
    }
    const generation = loadGeneration.current + 1;
    loadGeneration.current = generation;
    let cancelled = false;
    let created: string | null = null;
    void Promise.resolve(load())
      .then((blob) => {
        if (cancelled || generation !== loadGeneration.current) {
          return;
        }
        created = URL.createObjectURL(blob);
        revokeStoredObjectUrl();
        storedObjectUrlRef.current = created;
        setStoredPhotoUrl(created);
      })
      .catch(() => {
        if (!cancelled && generation === loadGeneration.current) {
          setStoredPhotoUrl(null);
        }
      });
    return () => {
      cancelled = true;
      if (created !== null) {
        URL.revokeObjectURL(created);
        if (storedObjectUrlRef.current === created) {
          storedObjectUrlRef.current = null;
        }
      }
    };
  }, [hasPhoto, revokeStoredObjectUrl]);

  const flashCopied = useCallback((): void => {
    setCopied(true);
    if (copyTimer.current !== null) {
      clearTimeout(copyTimer.current);
    }
    copyTimer.current = setTimeout(() => {
      setCopied(false);
      copyTimer.current = null;
    }, COPY_RESET_MS);
  }, []);

  const copyProfileUrl = useCallback(async (): Promise<void> => {
    /* v8 ignore next 3 -- copy button only mounts when profileUrl is set */
    if (!canCopy || profileUrl === undefined) {
      return;
    }
    const url = profileUrl;
    try {
      await navigator.clipboard.writeText(url);
      if (!copyMounted.current) {
        return;
      }
      flashCopied();
      return;
    } catch {
      if (!copyMounted.current) {
        return;
      }
      if (fallbackCopy(url)) {
        flashCopied();
      }
    }
  }, [canCopy, flashCopied, profileUrl]);

  const startEdit = useCallback((): void => {
    setDraft(aboutMe ?? '');
    setPhotoDraft(null);
    setPhotoRemoved(false);
    setError(null);
    setEditing(true);
  }, [aboutMe]);

  const cancelEdit = useCallback((): void => {
    photoGeneration.current += 1;
    setPreparingPhoto(false);
    setDraft(aboutMe ?? '');
    setPhotoDraft(null);
    setPhotoRemoved(false);
    setError(null);
    setEditing(false);
  }, [aboutMe]);

  const saveEdit = useCallback(async (): Promise<void> => {
    if (!onSave) {
      return;
    }
    setSaving(true);
    setError(null);
    try {
      let saved: boolean | void;
      if (photoDraft !== null) {
        saved = await onSave(draft, {
          contentType: photoDraft.contentType,
          data: photoDraft.data,
          ...(typeof photoDraft.takenAt === 'string' && photoDraft.takenAt !== ''
            ? { takenAt: photoDraft.takenAt }
            : {}),
        });
      } else if (photoRemoved) {
        saved = await onSave(draft, null);
      } else {
        saved = await onSave(draft);
      }
      if (saved === false) {
        return;
      }
      if (photoDraft !== null) {
        loadGeneration.current += 1;
        revokeStoredObjectUrl();
        setStoredPhotoUrl(photoDraft.previewUrl);
      } else if (photoRemoved) {
        loadGeneration.current += 1;
        revokeStoredObjectUrl();
        setStoredPhotoUrl(null);
      }
      setPhotoDraft(null);
      setPhotoRemoved(false);
      setEditing(false);
    } catch (err) {
      /* name 409 stays on /profile with the editor open; NameForm is on this card */
      if (err instanceof MissingRequirementsError && !err.missing.includes('rules')) {
        return;
      }
      setError(t('profile.about.error'));
    } finally {
      setSaving(false);
    }
  }, [draft, onSave, photoDraft, photoRemoved, revokeStoredObjectUrl, t]);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>): void => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file === undefined) {
      return;
    }
    const generation = photoGeneration.current + 1;
    photoGeneration.current = generation;
    setPreparingPhoto(true);
    void (async () => {
      try {
        const result = await prepareForumPhoto(file);
        if (generation !== photoGeneration.current) {
          return;
        }
        if (!result.ok) {
          setError(
            result.error === 'tooLarge'
              ? t('profile.about.errorTooLarge')
              : t('profile.about.errorUnsupported'),
          );
          return;
        }
        setPhotoDraft(result.photo);
        setPhotoRemoved(false);
        setError(null);
      } catch {
        if (generation !== photoGeneration.current) {
          return;
        }
        setError(t('profile.about.errorUnsupported'));
      } finally {
        if (generation === photoGeneration.current) {
          setPreparingPhoto(false);
        }
      }
    })();
  };

  const handlePictureChange = (event: ChangeEvent<HTMLInputElement>): void => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file === undefined || onSavePicture === undefined) {
      return;
    }
    pictureGeneration.current += 1;
    const generation = photoGeneration.current + 1;
    photoGeneration.current = generation;
    setPreparingPhoto(true);
    void (async () => {
      try {
        const result = await prepareForumPhoto(file);
        if (generation !== photoGeneration.current) {
          return;
        }
        if (!result.ok) {
          setError(
            result.error === 'tooLarge'
              ? t('profile.about.errorTooLarge')
              : t('profile.about.errorUnsupported'),
          );
          return;
        }
        await onSavePicture({ contentType: result.photo.contentType, data: result.photo.data });
        if (generation !== photoGeneration.current) {
          return;
        }
        if (pictureUrlRef.current !== null && pictureUrlRef.current.startsWith('blob:')) {
          URL.revokeObjectURL(pictureUrlRef.current);
        }
        pictureUrlRef.current = result.photo.previewUrl;
        setPictureUrl(result.photo.previewUrl);
        setError(null);
      } catch {
        if (generation !== photoGeneration.current) {
          return;
        }
        setError(t('profile.about.error'));
      } finally {
        if (generation === photoGeneration.current) {
          setPreparingPhoto(false);
        }
      }
    })();
  };

  const handleBannerChange = (event: ChangeEvent<HTMLInputElement>): void => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file === undefined || onSaveBanner === undefined) {
      return;
    }
    bannerGeneration.current += 1;
    const generation = photoGeneration.current + 1;
    photoGeneration.current = generation;
    setPreparingPhoto(true);
    void (async () => {
      try {
        const result = await prepareForumPhoto(file, { wide: true });
        if (generation !== photoGeneration.current) {
          return;
        }
        if (!result.ok) {
          setError(
            result.error === 'tooLarge'
              ? t('profile.about.errorTooLarge')
              : result.error === 'notWide'
                ? t('profile.about.errorNotWide')
                : t('profile.about.errorUnsupported'),
          );
          return;
        }
        await onSaveBanner({ contentType: result.photo.contentType, data: result.photo.data });
        if (generation !== photoGeneration.current) {
          return;
        }
        if (bannerUrlRef.current !== null && bannerUrlRef.current.startsWith('blob:')) {
          URL.revokeObjectURL(bannerUrlRef.current);
        }
        bannerUrlRef.current = result.photo.previewUrl;
        setBannerUrl(result.photo.previewUrl);
        setError(null);
      } catch {
        if (generation !== photoGeneration.current) {
          return;
        }
        setError(t('profile.about.error'));
      } finally {
        if (generation === photoGeneration.current) {
          setPreparingPhoto(false);
        }
      }
    })();
  };

  const removePicture = (): void => {
    if (onSavePicture === undefined) {
      return;
    }
    pictureGeneration.current += 1;
    setPreparingPhoto(true);
    void (async () => {
      try {
        await onSavePicture(null);
        if (pictureUrlRef.current !== null && pictureUrlRef.current.startsWith('blob:')) {
          URL.revokeObjectURL(pictureUrlRef.current);
        }
        pictureUrlRef.current = null;
        setPictureUrl(null);
        setError(null);
      } catch {
        setError(t('profile.about.error'));
      } finally {
        setPreparingPhoto(false);
      }
    })();
  };

  const removeBanner = (): void => {
    if (onSaveBanner === undefined) {
      return;
    }
    bannerGeneration.current += 1;
    setPreparingPhoto(true);
    void (async () => {
      try {
        await onSaveBanner(null);
        if (bannerUrlRef.current !== null && bannerUrlRef.current.startsWith('blob:')) {
          URL.revokeObjectURL(bannerUrlRef.current);
        }
        bannerUrlRef.current = null;
        setBannerUrl(null);
        setError(null);
      } catch {
        setError(t('profile.about.error'));
      } finally {
        setPreparingPhoto(false);
      }
    })();
  };

  const removePhoto = (): void => {
    photoGeneration.current += 1;
    setPreparingPhoto(false);
    setPhotoDraft(null);
    setPhotoRemoved(true);
  };

  if (mode === 'public' && !filled && !canCopy) {
    return null;
  }

  const displayPhoto =
    !editing && storedPhotoUrl !== null ? (
      // eslint-disable-next-line @next/next/no-img-element -- blob URL from loadPhoto
      <img
        src={storedPhotoUrl}
        alt={t('profile.about.photoAlt')}
        className="max-h-40 w-full rounded-2xl object-cover"
      />
    ) : null;

  return (
    <div className="flex w-full flex-col items-stretch gap-3 border-t border-app-border pt-6">
      {mode === 'owner' || filled ? (
        <p className="text-center text-xs tracking-widest text-app-subtle uppercase">
          {t('profile.about.heading')}
        </p>
      ) : null}

      {mode === 'owner' && editing ? (
        <SundayWritingGate>
          <div className="flex flex-col items-stretch gap-3">
            <div className="flex items-start gap-2">
              <IconButton
                type="button"
                variant="secondary"
                size="md"
                disabled={saving || preparingPhoto}
                aria-label={t('profile.about.attach')}
                title={t('profile.about.attach')}
                onClick={() => {
                  fileInputRef.current?.click();
                }}
              >
                <ImagePlus aria-hidden="true" className="h-4 w-4" />
              </IconButton>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                disabled={saving}
                onChange={handleFileChange}
              />
              {onSavePicture !== undefined ? (
                <>
                  <IconButton
                    type="button"
                    variant="secondary"
                    size="md"
                    disabled={saving || preparingPhoto}
                    aria-label={t('profile.about.portrait')}
                    title={t('profile.about.portrait')}
                    onClick={() => {
                      pictureInputRef.current?.click();
                    }}
                  >
                    <ImagePlus aria-hidden="true" className="h-4 w-4" />
                  </IconButton>
                  <input
                    ref={pictureInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    disabled={saving}
                    onChange={handlePictureChange}
                  />
                </>
              ) : null}
              {onSaveBanner !== undefined ? (
                <>
                  <IconButton
                    type="button"
                    variant="secondary"
                    size="md"
                    disabled={saving || preparingPhoto}
                    aria-label={t('profile.about.banner')}
                    title={t('profile.about.banner')}
                    onClick={() => {
                      bannerInputRef.current?.click();
                    }}
                  >
                    <ImagePlus aria-hidden="true" className="h-4 w-4" />
                  </IconButton>
                  <input
                    ref={bannerInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    disabled={saving}
                    onChange={handleBannerChange}
                  />
                </>
              ) : null}
              <label htmlFor={textareaId} className="sr-only">
                {t('profile.about.heading')}
              </label>
              <textarea
                id={textareaId}
                value={draft}
                maxLength={ABOUT_ME_MAX_LENGTH}
                disabled={saving}
                onChange={(event) => setDraft(event.target.value)}
                className="min-h-24 min-w-0 flex-1 resize-none rounded-2xl border border-app-border-strong bg-app-card px-4 py-2 text-base text-app-fg whitespace-pre-wrap transition focus-visible:border-app-fg disabled:opacity-50"
              />
              <IconButton
                type="button"
                variant="primary"
                size="md"
                disabled={saving || preparingPhoto}
                aria-label={t('profile.about.save')}
                title={t('profile.about.save')}
                onClick={() => {
                  void saveEdit();
                }}
              >
                {saving ? (
                  <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
                ) : (
                  <Check aria-hidden="true" className="h-4 w-4" />
                )}
              </IconButton>
              <IconButton
                type="button"
                variant="secondary"
                size="md"
                disabled={saving}
                aria-label={t('profile.about.cancel')}
                title={t('profile.about.cancel')}
                onClick={cancelEdit}
              >
                <X aria-hidden="true" className="h-4 w-4" />
              </IconButton>
            </div>
            {pictureUrl !== null ? (
              <div className="flex items-center gap-2">
                {/* eslint-disable-next-line @next/next/no-img-element -- blob or data URL from the profile photo */}
                <img
                  src={pictureUrl}
                  alt={t('profile.about.portraitAlt')}
                  className="h-16 w-16 rounded-full object-cover"
                />
                <IconButton
                  type="button"
                  variant="secondary"
                  size="md"
                  disabled={saving || preparingPhoto}
                  aria-label={t('profile.about.removePortrait')}
                  title={t('profile.about.removePortrait')}
                  onClick={removePicture}
                >
                  <X aria-hidden="true" className="h-4 w-4" />
                </IconButton>
              </div>
            ) : null}
            {bannerUrl !== null ? (
              <div className="flex items-center gap-2">
                {/* eslint-disable-next-line @next/next/no-img-element -- blob or data URL from the wide image */}
                <img
                  src={bannerUrl}
                  alt={t('profile.about.bannerAlt')}
                  className="h-16 w-full rounded-2xl object-cover"
                />
                <IconButton
                  type="button"
                  variant="secondary"
                  size="md"
                  disabled={saving || preparingPhoto}
                  aria-label={t('profile.about.removeBanner')}
                  title={t('profile.about.removeBanner')}
                  onClick={removeBanner}
                >
                  <X aria-hidden="true" className="h-4 w-4" />
                </IconButton>
              </div>
            ) : null}
            {photoDraft !== null || keptPhoto ? (
              <div className="flex items-start gap-3 rounded-2xl border border-app-border bg-app-card-muted p-3">
                {previewSrc !== null ? (
                  // eslint-disable-next-line @next/next/no-img-element -- data URL preview from prepareForumPhoto
                  <img
                    src={previewSrc}
                    alt={t('profile.about.previewAlt')}
                    className="h-20 w-20 rounded-lg object-cover"
                  />
                ) : null}
                <IconButton
                  type="button"
                  variant="secondary"
                  size="md"
                  disabled={saving || preparingPhoto}
                  aria-label={t('profile.about.removePhoto')}
                  title={t('profile.about.removePhoto')}
                  onClick={removePhoto}
                >
                  <X aria-hidden="true" className="h-4 w-4" />
                </IconButton>
              </div>
            ) : null}
            {error !== null ? (
              <p role="alert" className="text-center text-sm text-app-danger">
                {error}
              </p>
            ) : null}
          </div>
        </SundayWritingGate>
      ) : mode === 'owner' && filled ? (
        <div className="flex items-start gap-2">
          <div className="flex min-w-0 flex-1 flex-col gap-3">
            {textFilled && aboutMe !== null ? (
              messageId !== undefined && messageId !== '' ? (
                <TranslatableNoteBody
                  messageId={messageId}
                  text={aboutMe}
                  truncate={false}
                  className="whitespace-pre-wrap text-sm text-app-fg"
                />
              ) : (
                <LinkedText text={aboutMe} className="whitespace-pre-wrap text-sm text-app-fg" />
              )
            ) : null}
            {displayPhoto}
          </div>
          <SundayWritingGate>
            <IconButton
              type="button"
              variant="secondary"
              size="md"
              aria-label={t('profile.about.edit')}
              title={t('profile.about.edit')}
              onClick={startEdit}
            >
              <Pencil aria-hidden="true" className="h-4 w-4" />
            </IconButton>
          </SundayWritingGate>
        </div>
      ) : mode === 'owner' ? (
        <div className="flex flex-col items-stretch gap-3">
          <p className="text-center text-sm text-app-muted">{t('profile.about.empty')}</p>
          <SundayWritingGate>
            <Button type="button" variant="secondary" size="sm" onClick={startEdit}>
              {t('profile.about.write')}
            </Button>
          </SundayWritingGate>
        </div>
      ) : filled ? (
        <>
          {textFilled && aboutMe !== null ? (
            messageId !== undefined && messageId !== '' ? (
              <TranslatableNoteBody
                messageId={messageId}
                text={aboutMe}
                truncate={false}
                className="whitespace-pre-wrap text-sm text-app-fg"
              />
            ) : (
              <LinkedText text={aboutMe} className="whitespace-pre-wrap text-sm text-app-fg" />
            )
          ) : null}
          {displayPhoto}
        </>
      ) : null}

      {canCopy ? (
        <div className="flex items-center justify-center">
          <IconButton
            type="button"
            variant="secondary"
            size="md"
            aria-label={t('profile.copyLink')}
            title={t('profile.copyLink')}
            onClick={() => {
              void copyProfileUrl();
            }}
          >
            {copied ? (
              <Check aria-hidden="true" className="h-4 w-4" />
            ) : (
              <Link2 aria-hidden="true" className="h-4 w-4" />
            )}
          </IconButton>
        </div>
      ) : null}
    </div>
  );
}

/**
 * Copy `text` via a hidden textarea and `document.execCommand('copy')`.
 *
 * @param text - Absolute URL to put on the clipboard.
 * @returns Whether the browser reported a successful copy.
 */
function fallbackCopy(text: string): boolean {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.setAttribute('aria-hidden', 'true');
  ta.className = 'fixed opacity-0';
  ta.readOnly = true;
  document.body.appendChild(ta);
  ta.select();
  let ok = false;
  try {
    ok = document.execCommand('copy');
  } catch {
    ok = false;
  }
  ta.remove();
  return ok;
}
