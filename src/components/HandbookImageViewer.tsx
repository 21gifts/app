'use client';

import { Monitor, Moon, Smartphone, Sun } from 'lucide-react';
import { useMemo, useState, type ReactElement } from 'react';
import { useTranslations } from '@/components/LocaleProvider';
import { Card, IconButton } from '@/components/ui';
import {
  HANDBOOK_COMBOS,
  comboTheme,
  comboViewport,
  defaultCombo,
  makeCombo,
  topicImageSrc,
  type HandbookComboId,
  type HandbookTopic,
} from '@/lib/handbook-topics';

/** Props for {@link HandbookImageViewer}. */
export interface HandbookImageViewerProps {
  /** Topics that have at least one baseline combo. */
  topics: HandbookTopic[];
}

/**
 * Resolve the combo for one topic under the global viewport/theme selection.
 * Prefers the selected viewport/theme when that topic has both; otherwise the
 * one it has. Returns {@link makeCombo} of the viewport/theme that topic
 * actually has.
 *
 * @param topic - Topic with a non-empty `combos` list.
 * @param viewport - Global viewport selection.
 * @param theme - Global theme selection.
 * @returns Combo id to render.
 */
function resolveTopicCombo(
  topic: HandbookTopic,
  viewport: 'desktop' | 'mobile',
  theme: 'light' | 'dark',
): HandbookComboId {
  const hasDesktop = topic.combos.some((combo) => comboViewport(combo) === 'desktop');
  const hasMobile = topic.combos.some((combo) => comboViewport(combo) === 'mobile');
  const nextViewport = hasDesktop && hasMobile ? viewport : hasMobile ? 'mobile' : 'desktop';
  const themeCombos = topic.combos.filter((combo) => comboViewport(combo) === nextViewport);
  const hasLight = themeCombos.some((combo) => comboTheme(combo) === 'light');
  const hasDark = themeCombos.some((combo) => comboTheme(combo) === 'dark');
  const nextTheme = hasLight && hasDark ? theme : hasDark ? 'dark' : 'light';
  const combo = makeCombo(nextViewport, nextTheme);
  return combo;
}

/**
 * Stacked baseline viewer: every topic with combos under global Desktop/Mobile
 * and Light/Dark switches. Switch visibility uses the union of remaining topics.
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
      {remaining.map((topic) => {
        const combo = resolveTopicCombo(topic, viewport, theme);
        return (
          <section key={topic.id} className="flex flex-col gap-3">
            <h3 className="text-base font-semibold text-app-fg">{topic.label}</h3>
            {/* eslint-disable-next-line @next/next/no-img-element -- static handbook baseline PNG */}
            <img
              src={topicImageSrc(topic, combo)}
              alt={topic.label}
              className="max-w-full rounded-lg border border-app-border"
            />
          </section>
        );
      })}
    </div>
  );
}
