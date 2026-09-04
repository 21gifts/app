'use client';

import type { ReactElement } from 'react';
import { useTranslations } from '@/components/LocaleProvider';
import type { HandbookOutlineChapter } from '@/lib/handbook-outline';

/** Props for {@link HandbookOutline}. */
export interface HandbookOutlineProps {
  /** Nested chapter → screen → variant tree (visible combo only). */
  chapters: HandbookOutlineChapter[];
}

/**
 * Three-level table of contents for handbook screens: chapter, screen, variant.
 *
 * @param props - Outline chapters.
 * @returns A sticky nav, or `null` when `chapters` is empty.
 */
export function HandbookOutline({ chapters }: HandbookOutlineProps): ReactElement | null {
  const { t } = useTranslations();
  if (chapters.length === 0) {
    return null;
  }
  const title = t('handbook.contents');
  return (
    <nav
      aria-label={title}
      className="lg:sticky lg:top-24 lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto"
    >
      <p className="text-sm font-semibold text-app-fg">{title}</p>
      <ol className="mt-3 flex flex-col gap-2 text-sm">
        {chapters.map((chapter) => (
          <li key={chapter.id}>
            <a href={`#${chapter.id}`} className="text-accent underline underline-offset-2">
              {chapter.label}
            </a>
            <ol className="mt-1 ml-4 flex flex-col gap-1">
              {chapter.screens.map((screen) => (
                <li key={screen.id}>
                  <a href={`#${screen.id}`} className="text-paper/80 underline underline-offset-2">
                    {screen.label}
                  </a>
                  <ol className="mt-1 ml-4 flex flex-col gap-0.5">
                    {screen.topics.map((leaf) => (
                      <li key={leaf.id}>
                        <a
                          href={`#${leaf.id}`}
                          className="text-paper/60 underline underline-offset-2"
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
