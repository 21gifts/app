'use client';

import { Monitor, Moon, Smartphone, Sun } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState, type ReactElement } from 'react';
import { HandbookFigure } from '@/components/HandbookFigure';
import { HandbookLightbox } from '@/components/HandbookLightbox';
import { HandbookOutline } from '@/components/HandbookOutline';
import { HandbookSectionHeading } from '@/components/HandbookSectionHeading';
import { useTranslations } from '@/components/LocaleProvider';
import { IconButton } from '@/components/ui';
import { buildHandbookOutline, nextOutlineIndex } from '@/lib/handbook-outline';
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
 * Desktop/Mobile and Light/Dark switches. Left/Right arrows step through
 * every visible variant in a shared lightbox. Topics missing that combo are
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
  const slides = useMemo(
    () => outline.flatMap((chapter) => chapter.screens.flatMap((screen) => screen.topics)),
    [outline],
  );
  const [activeId, setActiveId] = useState<string | null>(null);
  const activeIndex = activeId === null ? -1 : slides.findIndex((slide) => slide.id === activeId);
  /* v8 ignore next — findIndex match is always in-range */
  const activeSlide = activeIndex >= 0 ? (slides[activeIndex] ?? null) : null;

  const step = useCallback(
    (direction: 1 | -1): void => {
      /* v8 ignore next 3 — keydown and chevrons only fire when slides exist */
      if (slides.length === 0) {
        return;
      }
      const current = activeIndex >= 0 ? activeIndex : null;
      const next = nextOutlineIndex(slides.length, current, direction);
      const slide = slides[next];
      if (slide !== undefined) {
        setActiveId(slide.id);
      }
    },
    [activeIndex, slides],
  );

  const closeGallery = useCallback((): void => {
    setActiveId(null);
  }, []);

  useEffect(() => {
    if (activeId !== null && !slides.some((slide) => slide.id === activeId)) {
      setActiveId(null);
    }
  }, [activeId, slides]);

  useEffect(() => {
    if (activeId === null) {
      return;
    }
    const node = document.getElementById(activeId);
    if (node !== null && typeof node.scrollIntoView === 'function') {
      node.scrollIntoView({ block: 'nearest' });
    }
  }, [activeId]);

  useEffect(() => {
    if (slides.length === 0) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') {
        return;
      }
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) {
        return;
      }
      const target = event.target;
      if (target instanceof HTMLElement) {
        const tag = target.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable) {
          return;
        }
      }
      event.preventDefault();
      step(event.key === 'ArrowRight' ? 1 : -1);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [slides.length, step]);

  if (remaining.length === 0) {
    return null;
  }

  return (
    <div className="mt-8 flex flex-col gap-8">
      {showViewport || showTheme ? (
        <div className="flex flex-wrap items-center gap-4 rounded-3xl border border-paper/10 p-4">
          {showViewport ? (
            <div role="group" aria-label={t('handbook.viewport')} className="flex gap-2">
              <IconButton
                type="button"
                variant={viewport === 'desktop' ? 'primary' : 'ghost'}
                className={
                  viewport === 'desktop'
                    ? 'bg-accent text-ink hover:bg-accent'
                    : 'text-paper/60 hover:bg-paper/10 hover:text-paper'
                }
                aria-label={t('handbook.desktop')}
                onClick={() => {
                  setViewport('desktop');
                }}
              >
                <Monitor aria-hidden="true" className="h-4 w-4" />
              </IconButton>
              <IconButton
                type="button"
                variant={viewport === 'mobile' ? 'primary' : 'ghost'}
                className={
                  viewport === 'mobile'
                    ? 'bg-accent text-ink hover:bg-accent'
                    : 'text-paper/60 hover:bg-paper/10 hover:text-paper'
                }
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
                variant={theme === 'light' ? 'primary' : 'ghost'}
                className={
                  theme === 'light'
                    ? 'bg-accent text-ink hover:bg-accent'
                    : 'text-paper/60 hover:bg-paper/10 hover:text-paper'
                }
                aria-label={t('handbook.light')}
                onClick={() => {
                  setTheme('light');
                }}
              >
                <Sun aria-hidden="true" className="h-4 w-4" />
              </IconButton>
              <IconButton
                type="button"
                variant={theme === 'dark' ? 'primary' : 'ghost'}
                className={
                  theme === 'dark'
                    ? 'bg-accent text-ink hover:bg-accent'
                    : 'text-paper/60 hover:bg-paper/10 hover:text-paper'
                }
                aria-label={t('handbook.dark')}
                onClick={() => {
                  setTheme('dark');
                }}
              >
                <Moon aria-hidden="true" className="h-4 w-4" />
              </IconButton>
            </div>
          ) : null}
        </div>
      ) : null}
      <div className="lg:grid lg:grid-cols-[minmax(12rem,16rem)_1fr] lg:items-start lg:gap-10">
        <HandbookOutline chapters={outline} title={t('handbook.contents')} />
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
                        onOpen={() => {
                          setActiveId(leaf.id);
                        }}
                      />
                    ))}
                  </div>
                </section>
              ))}
            </section>
          ))}
        </div>
      </div>
      <HandbookLightbox
        open={activeSlide !== null}
        src={activeSlide === null ? '' : topicImageSrc(activeSlide.topic, combo)}
        alt={activeSlide === null ? '' : activeSlide.topic.label}
        onClose={closeGallery}
        {...(slides.length > 1 ? { onPrevious: () => step(-1), onNext: () => step(1) } : {})}
      />
    </div>
  );
}
