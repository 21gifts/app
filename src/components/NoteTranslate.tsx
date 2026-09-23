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
import { ForumNoteText } from '@/components/ForumNoteText';
import { LinkedText } from '@/components/LinkedText';
import { useTranslations } from '@/components/LocaleProvider';
import { shouldOfferNoteTranslate } from '@/lib/note-language';
import { fetchTranslateAvailable, translateNote } from '@/lib/note-translate';

const DEFAULT_BODY_CLASS = 'whitespace-pre-wrap text-sm text-app-fg';

/** Props for the public forum-note translation control. */
export interface NoteTranslateProps {
  /** Raw public note or reply text. */
  text: string;
  /** When true, render the translated body as plain text with no autolinks. */
  plain?: boolean;
  /** `onButton` uses `text-app-btn-fg` so the control stays readable on `bg-app-btn`. */
  tone?: 'default' | 'onButton';
  /** Class for the translated body when it replaces the original. */
  bodyClassName?: string;
  /** Called when the translated body is shown in place of the original. */
  onShowingTranslation?: (showing: boolean) => void;
}

/** Props for {@link TranslatableNoteBody}. */
export interface TranslatableNoteBodyProps {
  /** Raw public note or reply text. */
  text: string;
  /** When true, render original and translated bodies as plain text. */
  plain?: boolean;
  /** When true, collapse long bodies behind Show more. */
  truncate?: boolean;
  /** Paragraph class for the visible body. */
  className?: string;
}

/**
 * Offer an on-demand translation when the note differs from the active UI locale.
 *
 * @param props - Raw public note or reply text, optional plain mode, and optional button tone.
 * @returns Translation control and result, or null when unavailable or unnecessary.
 * @throws Does not throw.
 */
export function NoteTranslate({
  text,
  plain = false,
  tone = 'default',
  bodyClassName,
  onShowingTranslation,
}: NoteTranslateProps): ReactElement | null {
  const { locale, t } = useTranslations();
  const [available, setAvailable] = useState<boolean | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [translatedText, setTranslatedText] = useState<string | null>(null);
  const [showTranslation, setShowTranslation] = useState(true);
  const requestId = useRef(0);
  const identity = `${text}\0${locale}`;
  const [seenIdentity, setSeenIdentity] = useState(identity);
  if (identity !== seenIdentity) {
    setSeenIdentity(identity);
    setStatus('idle');
    setTranslatedText(null);
    setShowTranslation(true);
    requestId.current += 1;
  }

  const offering = available === true && shouldOfferNoteTranslate(text, locale);
  const replacing = offering && status === 'success' && showTranslation && translatedText !== null;

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
    onShowingTranslation?.(replacing);
  }, [replacing, onShowingTranslation]);

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

  const onButton = tone === 'onButton';
  const controlClass = onButton
    ? 'mt-2 text-xs font-medium text-app-btn-fg underline underline-offset-2 disabled:opacity-50'
    : 'mt-2 text-xs font-medium text-app-muted underline underline-offset-2 disabled:opacity-50';
  const bodyClass =
    bodyClassName ??
    (onButton
      ? 'mt-2 whitespace-pre-wrap text-sm text-app-btn-fg'
      : 'mt-2 whitespace-pre-wrap text-sm text-app-fg');
  const errorClass = onButton ? 'mt-2 text-sm text-app-btn-fg' : 'mt-2 text-sm text-app-danger';

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
            <ForumNoteText
              text={translatedText}
              className={bodyClass}
              {...(plain ? { plain: true } : {})}
            />
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
            <p role="alert" className={errorClass}>
              {t('forum.translateError')}
            </p>
          ) : null}
          <button
            type="button"
            className={controlClass}
            disabled={status === 'loading'}
            aria-busy={status === 'loading'}
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

/**
 * Render a note body and replace it with the translation when the visitor asks.
 *
 * @param props - Body text, optional plain/truncate flags, and paragraph class.
 * @returns Original or translated body plus the translate control, or null when text is empty.
 * @throws Does not throw.
 */
export function TranslatableNoteBody({
  text,
  plain = false,
  truncate = true,
  className = DEFAULT_BODY_CLASS,
}: TranslatableNoteBodyProps): ReactElement | null {
  const [showingTranslation, setShowingTranslation] = useState(false);
  if (text === '') {
    return null;
  }
  const onButton = className.split(/\s+/).includes('text-app-btn-fg');
  const original = truncate ? (
    <ForumNoteText text={text} className={className} {...(plain ? { plain: true } : {})} />
  ) : (
    <LinkedText text={text} className={className} {...(plain ? { plain: true } : {})} />
  );
  return (
    <>
      {showingTranslation ? null : original}
      <NoteTranslate
        text={text}
        {...(plain ? { plain: true } : {})}
        {...(onButton ? { tone: 'onButton' as const } : {})}
        bodyClassName={className}
        onShowingTranslation={setShowingTranslation}
      />
    </>
  );
}
