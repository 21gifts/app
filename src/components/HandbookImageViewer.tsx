'use client';

import { Monitor, Moon, Smartphone, Sun } from 'lucide-react';
import { useMemo, useState, type ReactElement } from 'react';
import { useTranslations } from '@/components/LocaleProvider';
import { Card, IconButton } from '@/components/ui';
import {
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
 * One-topic baseline viewer: Desktop/Mobile and Light/Dark switches only
 * when those files exist for the selected topic. No dead switch.
 *
 * @param props - Topic catalog.
 * @returns The viewer, or `null` when `topics` is empty.
 */
export function HandbookImageViewer({ topics }: HandbookImageViewerProps): ReactElement | null {
  const { t } = useTranslations();
  const first = topics[0];
  const [topicId, setTopicId] = useState(first?.id ?? '');
  const topic = topics.find((row) => row.id === topicId) ?? first;
  const [viewport, setViewport] = useState<'desktop' | 'mobile'>(
    topic === undefined ? 'desktop' : comboViewport(defaultCombo(topic.combos) ?? 'desktop-light'),
  );
  const [theme, setTheme] = useState<'light' | 'dark'>(
    topic === undefined ? 'light' : comboTheme(defaultCombo(topic.combos) ?? 'desktop-light'),
  );

  const active = useMemo(() => {
    if (topic === undefined) {
      return null;
    }
    const hasDesktop = topic.combos.some((combo) => comboViewport(combo) === 'desktop');
    const hasMobile = topic.combos.some((combo) => comboViewport(combo) === 'mobile');
    const nextViewport = hasDesktop && hasMobile ? viewport : hasMobile ? 'mobile' : 'desktop';
    const themeCombos = topic.combos.filter((combo) => comboViewport(combo) === nextViewport);
    const hasLight = themeCombos.some((combo) => comboTheme(combo) === 'light');
    const hasDark = themeCombos.some((combo) => comboTheme(combo) === 'dark');
    const nextTheme = hasLight && hasDark ? theme : hasDark ? 'dark' : 'light';
    const combo = makeCombo(nextViewport, nextTheme);
    const resolved: HandbookComboId = topic.combos.includes(combo)
      ? combo
      : (defaultCombo(topic.combos) ?? 'desktop-light');
    return {
      topic,
      viewport: nextViewport,
      theme: nextTheme,
      combo: resolved,
      showViewport: hasDesktop && hasMobile,
      showTheme: hasLight && hasDark,
    };
  }, [theme, topic, viewport]);

  if (active === null || topic === undefined) {
    return null;
  }

  return (
    <Card maxWidth="xl" className="mt-8 items-stretch">
      <label className="flex w-full flex-col gap-2 text-sm font-medium text-app-fg">
        {t('handbook.topic')}
        <select
          aria-label={t('handbook.topic')}
          value={active.topic.id}
          onChange={(event) => {
            const next = topics.find((row) => row.id === event.target.value);
            setTopicId(event.target.value);
            if (next !== undefined) {
              const combo = defaultCombo(next.combos);
              if (combo !== null) {
                setViewport(comboViewport(combo));
                setTheme(comboTheme(combo));
              }
            }
          }}
          className="w-full rounded-2xl border border-app-border-strong bg-app-card px-4 py-2 text-sm text-app-fg outline-none"
        >
          {topics.map((row) => (
            <option key={row.id} value={row.id}>
              {row.label}
            </option>
          ))}
        </select>
      </label>
      {active.showViewport ? (
        <div role="group" aria-label={t('handbook.viewport')} className="flex gap-2">
          <IconButton
            type="button"
            variant={active.viewport === 'desktop' ? 'primary' : 'secondary'}
            aria-label={t('handbook.desktop')}
            onClick={() => {
              setViewport('desktop');
            }}
          >
            <Monitor aria-hidden="true" className="h-4 w-4" />
          </IconButton>
          <IconButton
            type="button"
            variant={active.viewport === 'mobile' ? 'primary' : 'secondary'}
            aria-label={t('handbook.mobile')}
            onClick={() => {
              setViewport('mobile');
            }}
          >
            <Smartphone aria-hidden="true" className="h-4 w-4" />
          </IconButton>
        </div>
      ) : null}
      {active.showTheme ? (
        <div role="group" aria-label={t('handbook.appearance')} className="flex gap-2">
          <IconButton
            type="button"
            variant={active.theme === 'light' ? 'primary' : 'secondary'}
            aria-label={t('handbook.light')}
            onClick={() => {
              setTheme('light');
            }}
          >
            <Sun aria-hidden="true" className="h-4 w-4" />
          </IconButton>
          <IconButton
            type="button"
            variant={active.theme === 'dark' ? 'primary' : 'secondary'}
            aria-label={t('handbook.dark')}
            onClick={() => {
              setTheme('dark');
            }}
          >
            <Moon aria-hidden="true" className="h-4 w-4" />
          </IconButton>
        </div>
      ) : null}
      {/* eslint-disable-next-line @next/next/no-img-element -- static handbook baseline PNG */}
      <img
        src={topicImageSrc(active.topic, active.combo)}
        alt={active.topic.label}
        className="max-w-full rounded-lg border border-app-border"
      />
    </Card>
  );
}
