'use client';

import { useLayoutEffect, useState, type ReactElement } from 'react';
import { createPortal } from 'react-dom';
import { ForumNoteText } from '@/components/ForumNoteText';
import { LinkedText } from '@/components/LinkedText';
import { useTranslations } from '@/components/LocaleProvider';
import { NoteTranslate, type NoteTranslateSource } from '@/components/NoteTranslate';

const DEFAULT_BODY_CLASS = 'whitespace-pre-wrap text-sm text-app-fg';

/** Props for {@link TranslatableNoteBody}. */
export interface TranslatableNoteBodyProps {
  /** Forum message UUID used for the cached API lookup. */
  messageId: string;
  /** Raw public note or reply text. */
  text: string;
  /** Forum-message source by default, or a containing conversation. */
  source?: NoteTranslateSource;
  /** When true, render original and translated bodies as plain text. */
  plain?: boolean;
  /** When true, collapse long original bodies behind Show more. */
  truncate?: boolean;
  /** Paragraph class for the visible body. */
  className?: string;
  /** Applied only to the visible translated body. */
  formatTranslated?: (text: string) => string;
  /**
   * When set, the Translate control portals into this element (forum footer
   * icon row). Default stacks the control under the body.
   */
  controlSlotId?: string;
}

/**
 * Render a note body and replace it with the translation in the same commit.
 *
 * Holds translated text and the showing flag. Visible body is original XOR
 * translation — not via a parent `useEffect` after paint.
 *
 * @param props - `messageId`, `text`, optional `source`, `plain` / `truncate`
 *   (`truncate` applies only to the original body), optional
 *   `className` (`text-app-btn-fg` selects NoteTranslate `tone="onButton"`),
 *   optional `formatTranslated` (applied only to the visible translation),
 *   optional `controlSlotId` to portal the control into the footer icon row.
 * @returns Original or translated body plus the translate control, or null when text is empty.
 * @throws Does not throw.
 */
export function TranslatableNoteBody({
  messageId,
  text,
  source,
  plain = false,
  truncate = true,
  className = DEFAULT_BODY_CLASS,
  formatTranslated,
  controlSlotId,
}: TranslatableNoteBodyProps): ReactElement | null {
  const { locale } = useTranslations();
  const [controlSlot, setControlSlot] = useState<HTMLElement | null>(null);
  useLayoutEffect(() => {
    if (controlSlotId === undefined) {
      setControlSlot(null);
      return;
    }
    setControlSlot(document.getElementById(controlSlotId));
  }, [controlSlotId]);
  const [translatedText, setTranslatedText] = useState<string | null>(null);
  const [showingTranslation, setShowingTranslation] = useState(false);
  const sourceIdentity =
    source?.kind === 'conversation' ? `${source.kind}\0${source.conversationId}` : 'message';
  const identity = `${sourceIdentity}\0${messageId}\0${text}\0${locale}`;
  const [seenIdentity, setSeenIdentity] = useState(identity);
  if (identity !== seenIdentity) {
    setSeenIdentity(identity);
    setTranslatedText(null);
    setShowingTranslation(false);
  }
  if (text === '') {
    return null;
  }
  const onButton = className.split(/\s+/).includes('text-app-btn-fg');
  const original = truncate ? (
    <ForumNoteText text={text} className={className} {...(plain ? { plain: true } : {})} />
  ) : (
    <LinkedText text={text} className={className} {...(plain ? { plain: true } : {})} />
  );
  const visible =
    showingTranslation && translatedText !== null ? (
      <ForumNoteText
        text={formatTranslated === undefined ? translatedText : formatTranslated(translatedText)}
        className={className}
        {...(plain ? { plain: true } : {})}
      />
    ) : (
      original
    );
  const control = (
    <NoteTranslate
      messageId={messageId}
      text={text}
      showingTranslation={showingTranslation}
      placement={controlSlotId === undefined ? 'block' : 'row'}
      onTranslated={(next) => {
        setTranslatedText(next);
        setShowingTranslation(true);
      }}
      onToggleShowing={() => {
        setShowingTranslation((shown) => !shown);
      }}
      {...(onButton ? { tone: 'onButton' as const } : {})}
      {...(source === undefined ? {} : { source })}
    />
  );
  const placed =
    controlSlotId === undefined
      ? control
      : controlSlot !== null
        ? createPortal(control, controlSlot)
        : null;
  return (
    <>
      {visible}
      {placed}
    </>
  );
}
