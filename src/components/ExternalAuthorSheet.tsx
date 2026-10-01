'use client';

import { Check, Copy, X } from 'lucide-react';
import { useEffect, useState, type ReactElement } from 'react';
import { createPortal } from 'react-dom';
import { useTranslations } from '@/components/LocaleProvider';
import { Card, IconButton } from '@/components/ui';
import { fetchExternalAuthorProfile } from '@/lib/api';
import type { ExternalAuthorProfile } from '@/lib/api-types';

/** Props for {@link ExternalAuthorSheet}. */
export interface ExternalAuthorSheetProps {
  /** Forum message id whose external author to load. */
  messageId: string;
  /** Card name shown until the profile loads, and when the fetch returns null. */
  fallbackName: string;
  /** Dismisses the overlay. */
  onClose: () => void;
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
 * Overlay with the public Nostr profile for an external forum author.
 *
 * Portaled to `document.body`. A quoted note is `relative z-10`, and that
 * stacking context would paint this fixed overlay under the page chrome.
 *
 * @param props - See {@link ExternalAuthorSheetProps}.
 * @returns The overlay dialog.
 */
export function ExternalAuthorSheet({
  messageId,
  fallbackName,
  onClose,
}: ExternalAuthorSheetProps): ReactElement {
  const { t } = useTranslations();
  const [profile, setProfile] = useState<ExternalAuthorProfile | null>(null);
  const [copied, setCopied] = useState(false);

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

  const displayName = profile === null ? fallbackName : profile.name;
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
      setCopied(true);
    } catch {
      if (fallbackCopy(profile.npub)) {
        setCopied(true);
      }
    }
  };

  const dialog = (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={displayName}
      className="fixed inset-0 z-50 flex items-center justify-center bg-app-overlay p-4"
      onClick={(event) => {
        event.stopPropagation();
      }}
      onKeyDown={(event) => {
        event.stopPropagation();
      }}
    >
      <Card maxWidth="sm">
        <div className="flex w-full items-start justify-between gap-3">
          <h2 className="text-lg font-semibold tracking-tight text-app-fg">{displayName}</h2>
          <IconButton
            type="button"
            variant="ghost"
            size="md"
            aria-label={t('forum.externalProfileClose')}
            onClick={onClose}
          >
            <X aria-hidden="true" className="h-4 w-4" />
          </IconButton>
        </div>
        <span className="rounded-full border border-app-border-strong px-2 py-0.5 text-xs font-medium text-app-muted">
          {t('forum.via.nostr')}
        </span>
        <p className="text-sm text-app-muted">{t('forum.via.nostrHint')}</p>
        {showNip05 ? (
          <div className="flex w-full flex-col gap-1">
            <p className="text-sm text-app-muted">{t('forum.externalProfileNip05')}</p>
            <p className="text-sm text-app-fg break-all">{nip05}</p>
          </div>
        ) : null}
        {showLud16 ? (
          <div className="flex w-full flex-col gap-1">
            <p className="text-sm text-app-muted">{t('forum.externalProfileLud16')}</p>
            <p className="text-sm text-app-fg break-all">{lud16}</p>
          </div>
        ) : null}
        {profile !== null ? (
          <div className="flex w-full flex-col items-center gap-2">
            <p className="text-sm text-app-muted">{t('forum.externalProfileNpub')}</p>
            <p className="text-sm text-app-fg break-all">{profile.npub}</p>
            <IconButton
              type="button"
              variant="ghost"
              size="sm"
              aria-label={
                copied ? t('forum.externalProfileCopied') : t('forum.externalProfileCopy')
              }
              onClick={() => {
                void copyNpub();
              }}
            >
              {copied ? (
                <Check aria-hidden="true" className="h-3.5 w-3.5" />
              ) : (
                <Copy aria-hidden="true" className="h-3.5 w-3.5" />
              )}
            </IconButton>
          </div>
        ) : null}
      </Card>
    </div>
  );

  return createPortal(dialog, document.body);
}
