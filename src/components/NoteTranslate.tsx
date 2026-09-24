'use client';

import { Languages, Loader2 } from 'lucide-react';
import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type ReactElement,
} from 'react';
import { useTranslations } from '@/components/LocaleProvider';
import { IconButton } from '@/components/ui/IconButton';
import { shouldOfferNoteTranslate } from '@/lib/note-language';
import { fetchTranslateAvailable, translateNote } from '@/lib/note-translate';
import { useAuthStore } from '@/stores/auth-store';

/** Props for the public forum-note translation control. */
export interface NoteTranslateProps {
  /** Forum message UUID used for the cached API lookup. */
  messageId: string;
  /** Raw public note or reply text. */
  text: string;
  /** `onButton` uses `text-app-btn-fg` so the control stays readable on `bg-app-btn`. */
  tone?: 'default' | 'onButton';
  /** Parent-owned flag: true while the translated body is on screen. */
  showingTranslation?: boolean;
  /** Called with the translated string after a successful POST. */
  onTranslated?: (translatedText: string) => void;
  /** Called when the visitor toggles Show original / Show translation. */
  onToggleShowing?: () => void;
}

/**
 * Offer an on-demand translation when the note differs from the active UI locale.
 *
 * Control-only: Translate (Languages icon), Show original, Show translation,
 * error, and spinner. Does not render `ForumNoteText` or the translated body.
 * Identity is `messageId + text + locale`.
 *
 * @param props - `messageId` (forum UUID), `text`, optional `tone`,
 *   parent-owned `showingTranslation`, `onTranslated` on success, and
 *   `onToggleShowing` for Show original / Show translation.
 * @returns Translation control, or null when unavailable or unnecessary.
 * @throws Does not throw.
 */
export function NoteTranslate({
  messageId,
  text,
  tone = 'default',
  showingTranslation = false,
  onTranslated,
  onToggleShowing,
}: NoteTranslateProps): ReactElement | null {
  const { locale, t } = useTranslations();
  const session = useAuthStore((state) => state.session);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const requestId = useRef(0);
  const identity = `${messageId}\0${text}\0${locale}`;
  const [seenIdentity, setSeenIdentity] = useState(identity);
  if (identity !== seenIdentity) {
    setSeenIdentity(identity);
    setStatus('idle');
    requestId.current += 1;
  }

  const offering = available === true && shouldOfferNoteTranslate(text, locale);

  useEffect(() => {
    let active = true;
    void fetchTranslateAvailable().then((next) => {
      if (active) {
        setAvailable(next);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  if (text.trim() === '' || !offering) {
    return null;
  }

  const stopKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    event.stopPropagation();
  };

  const requestTranslation = (event: MouseEvent<HTMLButtonElement>): void => {
    event.stopPropagation();
    event.preventDefault();
    setStatus('loading');
    const id = requestId.current + 1;
    requestId.current = id;
    void translateNote(messageId, locale, session)
      .then((next) => {
        if (id !== requestId.current) {
          return;
        }
        setStatus('success');
        onTranslated?.(next);
      })
      .catch(() => {
        if (id !== requestId.current) {
          return;
        }
        setStatus('error');
      });
  };

  const onButton = tone === 'onButton';
  const toggleClass = onButton
    ? 'mt-2 text-xs font-medium text-app-btn-fg underline underline-offset-2 disabled:opacity-50'
    : 'mt-2 text-xs font-medium text-app-muted underline underline-offset-2 disabled:opacity-50';
  const errorClass = onButton ? 'mt-2 text-sm text-app-btn-fg' : 'mt-2 text-sm text-app-danger';
  const translateLabel = t('forum.translate');

  return (
    <div
      onClick={(event) => {
        event.stopPropagation();
      }}
      onKeyDown={stopKeyDown}
    >
      {status === 'success' ? (
        <button
          type="button"
          className={toggleClass}
          onClick={(event) => {
            event.stopPropagation();
            event.preventDefault();
            onToggleShowing?.();
          }}
        >
          {showingTranslation
            ? t('forum.translateShowOriginal')
            : t('forum.translateShowTranslation')}
        </button>
      ) : (
        <>
          {status === 'error' ? (
            <p role="alert" className={errorClass}>
              {t('forum.translateError')}
            </p>
          ) : null}
          <IconButton
            type="button"
            size="sm"
            variant="ghost"
            className={onButton ? 'mt-2 text-app-btn-fg hover:text-app-btn-fg' : 'mt-2'}
            aria-label={translateLabel}
            title={translateLabel}
            disabled={status === 'loading'}
            aria-busy={status === 'loading'}
            onClick={requestTranslation}
          >
            {status === 'loading' ? (
              <Loader2 aria-hidden="true" className="h-4 w-4 shrink-0 animate-spin" />
            ) : (
              <Languages aria-hidden="true" className="h-4 w-4 shrink-0" />
            )}
          </IconButton>
        </>
      )}
    </div>
  );
}
