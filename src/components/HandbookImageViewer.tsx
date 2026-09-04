'use client';

import { Monitor, Moon, Smartphone, Sun } from 'lucide-react';
import { useMemo, useState, type ReactElement } from 'react';
import { HandbookFigure } from '@/components/HandbookFigure';
import { HandbookOutline } from '@/components/HandbookOutline';
import { HandbookSectionHeading } from '@/components/HandbookSectionHeading';
import { useTranslations } from '@/components/LocaleProvider';
import { Card, IconButton } from '@/components/ui';
import { buildHandbookOutline } from '@/lib/handbook-outline';
import {
  HANDBOOK_COMBOS,
  comboTheme,
  comboViewport,
  defaultCombo,
  makeCombo,
  topicImageSrc,
  type HandbookTopic,
} from '@/lib/handbook-topics';

/** Props for {@link HandbookImageViewer}. */
export interface HandbookImageViewerProps {
  /** Topics that have at least one baseline combo. */
  topics: HandbookTopic[];
}

/**
 * Nested handbook screens: table of contents (chapter → screen → variant) and
 * compact figures for every topic that has the selected combo under global
 * Desktop/Mobile and Light/Dark switches. Topics missing that combo are
 * omitted. Switch visibility uses the union of remaining topics.
 *
 * @param props - Topic catalog.
 * @returns The viewer, or `null` when no topic has combos.
 */
export function HandbookImageViewer({ topics }: HandbookImageViewerProps): ReactElement | null {
  const { t } = useTranslations();
  const remaining = useMemo(() => topics.filter((topic) => topic.combos.length > 0), [topics]);
  const catalogUnion = HANDBOOK_COMBOS.filter((combo) =>
    remaining.some((topic) => topic.combos.includes(combo)),
  );
  const initial = defaultCombo(catalogUnion);
  const [viewport, setViewport] = useState<'desktop' | 'mobile'>(
    initial ? comboViewport(initial) : 'desktop',
  );
  const [theme, setTheme] = useState<'light' | 'dark'>(initial ? comboTheme(initial) : 'light');

  const showViewport = useMemo(() => {
    const hasDesktop = remaining.some((topic) =>
      topic.combos.some((combo) => comboViewport(combo) === 'desktop'),
    );
    const hasMobile = remaining.some((topic) =>
      topic.combos.some((combo) => comboViewport(combo) === 'mobile'),
    );
    return hasDesktop && hasMobile;
  }, [remaining]);

  const showTheme = useMemo(() => {
    const hasLight = remaining.some((topic) =>
      topic.combos.some((combo) => comboTheme(combo) === 'light'),
    );
    const hasDark = remaining.some((topic) =>
      topic.combos.some((combo) => comboTheme(combo) === 'dark'),
    );
    return hasLight && hasDark;
  }, [remaining]);

  const combo = makeCombo(viewport, theme);
  const visible = remaining.filter((topic) => topic.combos.includes(combo));
  const outline = buildHandbookOutline(visible);

  if (remaining.length === 0) {
    return null;
  }

  return (
    <div className="mt-8 flex flex-col gap-8">
      {showViewport || showTheme ? (
        <Card maxWidth="xl" className="items-stretch">
          {showViewport ? (
            <div role="group" aria-label={t('handbook.viewport')} className="flex gap-2">
              <IconButton
                type="button"
                variant={viewport === 'desktop' ? 'primary' : 'secondary'}
                aria-label={t('handbook.desktop')}
                onClick={() => {
                  setViewport('desktop');
                }}
              >
                <Monitor aria-hidden="true" className="h-4 w-4" />
              </IconButton>
              <IconButton
                type="button"
                variant={viewport === 'mobile' ? 'primary' : 'secondary'}
                aria-label={t('handbook.mobile')}
                onClick={() => {
                  setViewport('mobile');
                }}
              >
                <Smartphone aria-hidden="true" className="h-4 w-4" />
              </IconButton>
            </div>
          ) : null}
          {showTheme ? (
            <div role="group" aria-label={t('handbook.appearance')} className="flex gap-2">
              <IconButton
                type="button"
                variant={theme === 'light' ? 'primary' : 'secondary'}
                aria-label={t('handbook.light')}
                onClick={() => {
                  setTheme('light');
                }}
              >
                <Sun aria-hidden="true" className="h-4 w-4" />
              </IconButton>
              <IconButton
                type="button"
                variant={theme === 'dark' ? 'primary' : 'secondary'}
                aria-label={t('handbook.dark')}
                onClick={() => {
                  setTheme('dark');
                }}
              >
                <Moon aria-hidden="true" className="h-4 w-4" />
              </IconButton>
            </div>
          ) : null}
        </Card>
      ) : null}
      <div className="lg:grid lg:grid-cols-[minmax(12rem,16rem)_1fr] lg:items-start lg:gap-10">
        <HandbookOutline chapters={outline} />
        <div className="mt-8 flex flex-col gap-12 lg:mt-0">
          {outline.map((chapter) => (
            <section key={chapter.id} className="flex flex-col gap-8">
              <HandbookSectionHeading level={2} id={chapter.id} label={chapter.label} />
              {chapter.screens.map((screen) => (
                <section key={screen.id} className="flex flex-col gap-4">
                  <HandbookSectionHeading level={3} id={screen.id} label={screen.label} />
                  <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                    {screen.topics.map((leaf) => (
                      <HandbookFigure
                        key={leaf.topic.id}
                        id={leaf.id}
                        label={leaf.topic.label}
                        description={leaf.topic.description}
                        src={topicImageSrc(leaf.topic, combo)}
                        alt={leaf.topic.label}
                      />
                    ))}
                  </div>
                </section>
              ))}
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
