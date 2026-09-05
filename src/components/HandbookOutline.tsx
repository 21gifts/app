import type { ReactElement } from 'react';
import type { HandbookOutlineChapter } from '@/lib/handbook-outline';

/** Props for {@link HandbookOutline}. */
export interface HandbookOutlineProps {
  /** Nested chapter → screen → variant tree (visible combo only). */
  chapters: HandbookOutlineChapter[];
  /** Accessible nav name and heading (already translated). */
  title: string;
}

/**
 * Three-level table of contents for handbook screens: chapter, screen, variant.
 *
 * @param props - Outline chapters and translated title.
 * @returns A sticky nav, or `null` when `chapters` is empty.
 */
export function HandbookOutline({ chapters, title }: HandbookOutlineProps): ReactElement | null {
  if (chapters.length === 0) {
    return null;
  }
  return (
    <nav
      aria-label={title}
      className="lg:sticky lg:top-24 lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto"
    >
      <p className="text-sm font-semibold text-paper">{title}</p>
      <ol className="mt-3 flex flex-col gap-2 text-sm">
        {chapters.map((chapter) => (
          <li key={chapter.id}>
            <a
              href={`#${chapter.id}`}
              className="text-accent underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-paper"
            >
              {chapter.label}
            </a>
            <ol className="mt-1 ml-4 flex flex-col gap-1">
              {chapter.screens.map((screen) => (
                <li key={screen.id}>
                  <a
                    href={`#${screen.id}`}
                    className="text-paper/80 underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-paper"
                  >
                    {screen.label}
                  </a>
                  <ol className="mt-1 ml-4 flex flex-col gap-0.5">
                    {screen.topics.map((leaf) => (
                      <li key={leaf.id}>
                        <a
                          href={`#${leaf.id}`}
                          className="text-paper/60 underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-paper"
                        >
                          {leaf.label}
                        </a>
                      </li>
                    ))}
                  </ol>
                </li>
              ))}
            </ol>
          </li>
        ))}
      </ol>
    </nav>
  );
}
