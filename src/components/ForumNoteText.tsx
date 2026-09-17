'use client';

import { useState, type KeyboardEvent, type MouseEvent, type ReactElement } from 'react';
import { LinkedText } from '@/components/LinkedText';
import { useTranslations } from '@/components/LocaleProvider';
import { forumTextPreview } from '@/lib/forum-text-preview';

/** Props for a public forum note or reply body with optional Show more. */
export interface ForumNoteTextProps {
  /** Raw public note or reply text. */
  text: string;
  /** Paragraph className (keep whitespace-pre-wrap from the caller). */
  className: string;
}

/**
 * Render a public forum note or reply body, collapsing long text behind Show more.
 *
 * @param props - Body text and paragraph className.
 * @returns The paragraph, or null when text is empty.
 * @throws Does not throw.
 */
export function ForumNoteText({ text, className }: ForumNoteTextProps): ReactElement | null {
  const { t } = useTranslations();
  const [expanded, setExpanded] = useState(false);
  const { preview, truncated } = forumTextPreview(text);

  if (text === '') {
    return null;
  }

  if (!truncated || expanded) {
    return <LinkedText text={text} className={className} />;
  }

  return (
    <LinkedText
      text={preview}
      className={className}
      suffix={
        <>
          …{' '}
          <button
            type="button"
            className="text-sm font-medium text-app-fg underline underline-offset-2"
            aria-expanded={false}
            onClick={(event: MouseEvent<HTMLButtonElement>) => {
              event.stopPropagation();
              event.preventDefault();
              setExpanded(true);
            }}
            onKeyDown={(event: KeyboardEvent<HTMLButtonElement>) => {
              event.stopPropagation();
            }}
          >
            {t('forum.showMore')}
          </button>
        </>
      }
    />
  );
}
