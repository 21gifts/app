import Link from 'next/link';
import type { ReactElement } from 'react';

/** Shell for the wordmark color. */
export type WordmarkTone = 'app' | 'dark';

/** Props for {@link Wordmark}. */
export interface WordmarkProps {
  /** Destination. Omit for a non-link mark (footer). */
  href?: string;
  /** App foreground or paper-on-ink. Default `app`. */
  tone?: WordmarkTone;
  /** Extra classes. */
  className?: string;
}

/**
 * Text wordmark `21.gifts` — the brand mark, not a drawn logo.
 *
 * @param props - See {@link WordmarkProps}.
 * @returns The wordmark element.
 */
export function Wordmark({ href, tone = 'app', className }: WordmarkProps): ReactElement {
  const toneClass = tone === 'dark' ? 'text-paper' : 'text-app-fg';
  const extra = className === undefined || className === '' ? '' : ` ${className}`;
  const classes = `text-[17px] font-bold no-underline ${toneClass}${extra}`;
  if (href === undefined || href === '') {
    return <span className={classes}>21.gifts</span>;
  }
  return (
    <Link href={href} className={classes}>
      21.gifts
    </Link>
  );
}
