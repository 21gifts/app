'use client';

import { useState, type KeyboardEvent, type MouseEvent, type ReactElement } from 'react';
import { LinkedText, type TextMention } from '@/components/LinkedText';
import { useTranslations } from '@/components/LocaleProvider';
import { forumTextPreview } from '@/lib/forum-text-preview';

/** Props for a public forum note or reply body with optional Show more. */
export interface ForumNoteTextProps {
  /** Raw public note or reply text. */
  text: string;
  /** Paragraph className (keep whitespace-pre-wrap from the caller). */
  className: string;
  /** When true, forward plain rendering to {@link LinkedText} (no autolinks). */
  plain?: boolean;
  /** Member marks. Omitted when the author name is not a member button. */
  mentions?: readonly TextMention[];
}

/**
 * Render a public forum note or reply body, collapsing long text behind Show more.
 *
 * @param props - Body text, paragraph className, and optional plain mode.
 * @returns The paragraph, or null when text is empty.
 * @throws Does not throw.
 */
export function ForumNoteText({
  text,
  className,
  plain = false,
  mentions,
}: ForumNoteTextProps): ReactElement | null {
  const { t } = useTranslations();
  const [expanded, setExpanded] = useState(false);
  const { preview, truncated } = forumTextPreview(text);

  if (text === '') {
    return null;
  }

  if (!truncated || expanded) {
    return (
      <LinkedText
        text={text}
        className={className}
        {...(plain ? { plain: true } : {})}
        {...(mentions === undefined ? {} : { mentions })}
      />
    );
  }

  return (
    <LinkedText
      text={preview}
      className={className}
      {...(plain ? { plain: true } : {})}
      {...(mentions === undefined ? {} : { mentions })}
      suffix={
        <>
          …{' '}
          <button
            type="button"
            className={
              className.split(/\s+/).includes('text-app-btn-fg')
                ? 'text-sm font-medium text-app-btn-fg underline underline-offset-2'
                : 'text-sm font-medium text-app-fg underline underline-offset-2'
            }
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
