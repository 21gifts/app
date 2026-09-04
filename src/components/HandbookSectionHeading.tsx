import type { ReactElement } from 'react';
import { HandbookCopyLink } from '@/components/HandbookCopyLink';

/** Props for {@link HandbookSectionHeading}. */
export interface HandbookSectionHeadingProps {
  /** Heading level: chapter (2) or screen (3). */
  level: 2 | 3;
  /** Hash id without `#`. */
  id: string;
  /** Visible permalink text. */
  label: string;
}

const HEADING_CLASS: Record<2 | 3, string> = {
  2: 'scroll-mt-24 text-xl font-semibold text-accent',
  3: 'scroll-mt-24 text-lg font-semibold text-app-fg',
};

/**
 * Chapter or screen heading with a permalink and {@link HandbookCopyLink}.
 *
 * @param props - Level, id, and label.
 * @returns The heading row.
 */
export function HandbookSectionHeading({
  level,
  id,
  label,
}: HandbookSectionHeadingProps): ReactElement {
  const Tag = level === 2 ? 'h2' : 'h3';
  return (
    <div className="flex flex-wrap items-baseline gap-2">
      <Tag id={id} className={HEADING_CLASS[level]}>
        <a href={`#${id}`}>{label}</a>
      </Tag>
      <HandbookCopyLink targetId={id} label={label} />
    </div>
  );
}
