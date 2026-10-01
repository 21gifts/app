'use client';

import { Check, Copy } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type ReactElement } from 'react';
import { useTranslations } from '@/components/LocaleProvider';
import { Card, IconButton } from '@/components/ui';
import { fetchExternalAuthorProfile } from '@/lib/api';
import type { ExternalAuthorProfile as ExternalAuthorProfileData } from '@/lib/api-types';

/** Copied-icon flash duration, matching {@link ForumBoard}. */
const COPY_RESET_MS = 1200;

/** Props for {@link ExternalAuthorProfile}. */
export interface ExternalAuthorProfileProps {
  /** Forum message id whose external author to load. */
  messageId: string;
  /** Card name until the profile loads, and when the fetch returns null. Empty means view.unnamed. */
  fallbackName: string;
}

/**
 * Copy `text` via a hidden textarea and `document.execCommand('copy')`.
 *
 * @param text - String to put on the clipboard.
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

/**
 * Member-profile card for a forum author with no 21.gifts account.
 *
 * Same sections as the member card (name, optional addresses, npub to copy).
 * Not a dialog: no overlay, portal, close control, or hint paragraph.
 *
 * @param props - See {@link ExternalAuthorProfileProps}.
 * @returns The profile card.
 */
export function ExternalAuthorProfile({
  messageId,
  fallbackName,
}: ExternalAuthorProfileProps): ReactElement {
  const { t } = useTranslations();
  const [profile, setProfile] = useState<ExternalAuthorProfileData | null>(null);
  const [copied, setCopied] = useState(false);
  const copyMounted = useRef(true);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const next = await fetchExternalAuthorProfile(messageId);
      if (!cancelled) {
        setProfile(next);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [messageId]);

  const displayName =
    profile === null
      ? fallbackName.trim() !== ''
        ? fallbackName
        : t('view.unnamed')
      : profile.name;
  const nip05 = profile?.nip05 ?? '';
  const lud16 = profile?.lud16 ?? '';
  const showNip05 = nip05 !== '';
  const showLud16 = lud16 !== '' && lud16.toLowerCase() !== nip05.toLowerCase();

  const copyNpub = async (): Promise<void> => {
    /* v8 ignore next 3 -- Copy renders only after a profile has loaded */
    if (profile === null) {
      return;
    }
    try {
      await navigator.clipboard.writeText(profile.npub);
      if (!copyMounted.current) {
        return;
      }
      flashCopied();
    } catch {
      if (!copyMounted.current) {
        return;
      }
      if (fallbackCopy(profile.npub)) {
        flashCopied();
      }
    }
  };

  return (
    <div className="flex w-full max-w-sm flex-col items-center gap-6">
      <Card surface={false}>
        <h1 className="text-center text-2xl font-semibold tracking-tight sm:text-3xl">
          {t('profile.title')}
        </h1>
        <div className="flex w-full flex-col items-stretch gap-3 border-t border-app-border pt-6">
          <p className="text-center text-xs tracking-widest text-app-subtle uppercase">
            {t('name.heading')}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <p className="min-w-0 truncate text-sm text-app-fg">{displayName}</p>
            <span className="rounded-full border border-app-border-strong px-2 py-0.5 text-xs font-medium text-app-muted">
              {t('forum.via.nostr')}
            </span>
          </div>
        </div>
        {showNip05 ? (
          <div className="flex w-full flex-col items-stretch gap-3 border-t border-app-border pt-6">
            <p className="text-center text-xs tracking-widest text-app-subtle uppercase">
              {t('forum.externalProfileNip05')}
            </p>
            <p className="min-w-0 break-all text-center text-sm text-app-fg">{nip05}</p>
          </div>
        ) : null}
        {showLud16 ? (
          <div className="flex w-full flex-col items-stretch gap-3 border-t border-app-border pt-6">
            <p className="text-center text-xs tracking-widest text-app-subtle uppercase">
              {t('forum.externalProfileLud16')}
            </p>
            <p className="min-w-0 break-all text-center text-sm text-app-fg">{lud16}</p>
          </div>
        ) : null}
        {profile !== null ? (
          <div className="flex w-full flex-col items-stretch gap-3 border-t border-app-border pt-6">
            <p className="text-center text-xs tracking-widest text-app-subtle uppercase">
              {t('forum.externalProfileNpub')}
            </p>
            <p className="min-w-0 break-all text-center text-sm text-app-fg">{profile.npub}</p>
            <div className="flex items-center justify-center">
              <IconButton
                type="button"
                variant="secondary"
                size="md"
                aria-label={
                  copied ? t('forum.externalProfileCopied') : t('forum.externalProfileCopy')
                }
                title={copied ? t('forum.externalProfileCopied') : t('forum.externalProfileCopy')}
                onClick={() => {
                  void copyNpub();
                }}
              >
                {copied ? (
                  <Check aria-hidden="true" className="h-4 w-4" />
                ) : (
                  <Copy aria-hidden="true" className="h-4 w-4" />
                )}
              </IconButton>
            </div>
          </div>
        ) : null}
      </Card>
    </div>
  );
}
