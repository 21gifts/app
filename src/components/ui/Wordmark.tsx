import Link from 'next/link';
import type { ReactElement } from 'react';

/** Shell for the wordmark color. */
export type WordmarkTone = 'app' | 'dark';

/** Type size: header chrome 17px vs marketing footer 15px. */
export type WordmarkSize = 'header' | 'footer';

/** Props for {@link Wordmark}. */
export interface WordmarkProps {
  /** Destination. Omit for a non-link mark (footer). */
  href?: string;
  /** App foreground or paper-on-ink. Default `app`. */
  tone?: WordmarkTone;
  /** Header 17px or footer 15px. Default `header`. */
  size?: WordmarkSize;
  /** Extra classes. */
  className?: string;
}

/**
 * Text wordmark `21.gifts` — the brand mark, not a drawn logo.
 *
 * @param props - See {@link WordmarkProps}.
 * @returns The wordmark element.
 */
export function Wordmark({
  href,
  tone = 'app',
  size = 'header',
  className,
}: WordmarkProps): ReactElement {
  const toneClass = tone === 'dark' ? 'text-paper' : 'text-app-fg';
  const sizeClass = size === 'footer' ? 'text-[15px]' : 'text-[17px]';
  const extra = className === undefined || className === '' ? '' : ` ${className}`;
  const classes = `${sizeClass} font-bold no-underline ${toneClass}${extra}`;
  if (href === undefined || href === '') {
    return <span className={classes}>21.gifts</span>;
  }
  return (
    <Link href={href} className={classes}>
      21.gifts
    </Link>
  );
}
