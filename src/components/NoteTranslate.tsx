'use client';

import { Loader2 } from 'lucide-react';
import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type ReactElement,
} from 'react';
import { useTranslations } from '@/components/LocaleProvider';
import { shouldOfferNoteTranslate } from '@/lib/note-language';
import { fetchTranslateAvailable, translateNote } from '@/lib/note-translate';

/** Props for the public forum-note translation control. */
export interface NoteTranslateProps {
  /** Raw public note or reply text. */
  text: string;
}

/**
 * Offer an on-demand translation when the note differs from the active UI locale.
 *
 * @param props - Raw public note or reply text.
 * @returns Translation control and result, or null when unavailable or unnecessary.
 * @throws Does not throw.
 */
export function NoteTranslate({ text }: NoteTranslateProps): ReactElement | null {
  const { locale, t } = useTranslations();
  const [available, setAvailable] = useState<boolean | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [translatedText, setTranslatedText] = useState<string | null>(null);
  const [showTranslation, setShowTranslation] = useState(true);
  const requestId = useRef(0);

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

  useEffect(() => {
    requestId.current += 1;
    setStatus('idle');
    setTranslatedText(null);
    setShowTranslation(true);
  }, [text, locale]);

  if (text.trim() === '' || available !== true || !shouldOfferNoteTranslate(text, locale)) {
    return null;
  }

  const stopKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    event.stopPropagation();
  };

  const requestTranslation = (event: MouseEvent<HTMLButtonElement>): void => {
    event.stopPropagation();
    event.preventDefault();
    setStatus('loading');
    setTranslatedText(null);
    setShowTranslation(true);
    const id = requestId.current + 1;
    requestId.current = id;
    void translateNote(text, locale)
      .then((next) => {
        if (id !== requestId.current) {
          return;
        }
        setTranslatedText(next);
        setStatus('success');
      })
      .catch(() => {
        if (id !== requestId.current) {
          return;
        }
        setStatus('error');
      });
  };

  const controlClass =
    'mt-2 text-xs font-medium text-app-muted underline underline-offset-2 disabled:opacity-50';

  return (
    <div
      onClick={(event) => {
        event.stopPropagation();
      }}
      onKeyDown={stopKeyDown}
    >
      {status === 'success' && translatedText !== null ? (
        <>
          {showTranslation ? (
            <p className="mt-2 whitespace-pre-wrap text-sm text-app-fg">{translatedText}</p>
          ) : null}
          <button
            type="button"
            className={controlClass}
            onClick={(event) => {
              event.stopPropagation();
              event.preventDefault();
              setShowTranslation((shown) => !shown);
            }}
          >
            {showTranslation
              ? t('forum.translateShowOriginal')
              : t('forum.translateShowTranslation')}
          </button>
        </>
      ) : (
        <>
          {status === 'error' ? (
            <p role="alert" className="mt-2 text-sm text-app-danger">
              {t('forum.translateError')}
            </p>
          ) : null}
          <button
            type="button"
            className={controlClass}
            disabled={status === 'loading'}
            onClick={requestTranslation}
          >
            {status === 'loading' ? (
              <Loader2 aria-hidden="true" className="mr-1 inline h-3.5 w-3.5 animate-spin" />
            ) : null}
            {t('forum.translate')}
          </button>
        </>
      )}
    </div>
  );
}
