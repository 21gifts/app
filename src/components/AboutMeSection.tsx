'use client';

import { Check, Link2, Pencil, X } from 'lucide-react';
import { useCallback, useEffect, useId, useRef, useState, type ReactElement } from 'react';
import { useTranslations } from '@/components/LocaleProvider';
import { Button, IconButton } from '@/components/ui';
import { MissingRequirementsError } from '@/lib/missing-requirements';

/** Max length of an About me note, matching the API. */
const ABOUT_ME_MAX_LENGTH = 500;

/** Copied-icon flash duration, matching {@link ForumBoard}. */
const COPY_RESET_MS = 1200;

/** Owner can edit; public only shows filled text. */
export type AboutMeSectionMode = 'owner' | 'public';

/** Props for {@link AboutMeSection}. */
export type AboutMeSectionProps = {
  /** Current About me text; whitespace-only or equal to `name` counts as unfilled. */
  aboutMe: string | null;
  /** Owner can edit; public only shows filled text. */
  mode: AboutMeSectionMode;
  /** Display name used to treat a name-only auto note as unfilled. */
  name?: string | null;
  /** Absolute URL to copy; omit or empty string hides the copy control. */
  profileUrl?: string;
  /** Persist edited text (owner mode). Return `false` to keep the editor open. */
  onSave?: (text: string) => Promise<boolean | void>;
};

/**
 * About me block for profile cards: heading plus text or empty prompt,
 * optional owner edit (pencil / write), and optional copy-profile-link.
 *
 * @param props - About me value, owner vs public mode, optional display name,
 * optional profile URL and save.
 * @returns The section, or `null` in public mode when unfilled and there is no copy URL.
 */
export function AboutMeSection({
  aboutMe,
  mode,
  name,
  profileUrl,
  onSave,
}: AboutMeSectionProps): ReactElement | null {
  const { t } = useTranslations();
  const textareaId = useId();
  const copyMounted = useRef(true);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(aboutMe ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const trimmedAbout = typeof aboutMe === 'string' ? aboutMe.trim() : '';
  const trimmedName = (name ?? '').trim();
  const filled =
    trimmedAbout !== '' &&
    (trimmedName === '' || trimmedAbout.toLowerCase() !== trimmedName.toLowerCase());
  const canCopy = typeof profileUrl === 'string' && profileUrl.length > 0;

  useEffect(() => {
    copyMounted.current = true;
    return () => {
      copyMounted.current = false;
      if (copyTimer.current !== null) {
        clearTimeout(copyTimer.current);
      }
    };
  }, []);

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
    setError(null);
    setEditing(true);
  }, [aboutMe]);

  const cancelEdit = useCallback((): void => {
    setDraft(aboutMe ?? '');
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
      const saved = await onSave(draft);
      if (saved === false) {
        return;
      }
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
  }, [draft, onSave, t]);

  if (mode === 'public' && !filled && !canCopy) {
    return null;
  }

  return (
    <div className="flex w-full flex-col items-stretch gap-3 border-t border-app-border pt-6">
      {mode === 'owner' || filled ? (
        <p className="text-center text-xs tracking-widest text-app-subtle uppercase">
          {t('profile.about.heading')}
        </p>
      ) : null}

      {mode === 'owner' && editing ? (
        <div className="flex flex-col items-stretch gap-3">
          <div className="flex items-start gap-2">
            <label htmlFor={textareaId} className="sr-only">
              {t('profile.about.heading')}
            </label>
            <textarea
              id={textareaId}
              value={draft}
              maxLength={ABOUT_ME_MAX_LENGTH}
              disabled={saving}
              onChange={(event) => setDraft(event.target.value)}
              className="min-h-24 min-w-0 flex-1 resize-y rounded-2xl border border-app-border-strong bg-app-card px-4 py-2 text-base text-app-fg whitespace-pre-wrap transition focus-visible:border-app-fg disabled:opacity-50"
            />
            <IconButton
              type="button"
              variant="primary"
              size="md"
              disabled={saving}
              aria-label={t('profile.about.save')}
              title={t('profile.about.save')}
              onClick={() => {
                void saveEdit();
              }}
            >
              <Check aria-hidden="true" className="h-4 w-4" />
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
          {error !== null ? (
            <p role="alert" className="text-center text-sm text-app-danger">
              {error}
            </p>
          ) : null}
        </div>
      ) : mode === 'owner' && filled ? (
        <div className="flex items-start gap-2">
          <p className="min-w-0 flex-1 whitespace-pre-wrap text-sm text-app-fg">{aboutMe}</p>
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
        </div>
      ) : mode === 'owner' ? (
        <div className="flex flex-col items-stretch gap-3">
          <p className="text-center text-sm text-app-muted">{t('profile.about.empty')}</p>
          <Button type="button" variant="secondary" size="sm" onClick={startEdit}>
            {t('profile.about.write')}
          </Button>
        </div>
      ) : filled ? (
        <p className="whitespace-pre-wrap text-sm text-app-fg">{aboutMe}</p>
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
