'use client';

import type { ReactElement, ReactNode } from 'react';
import { useTranslations } from '@/components/LocaleProvider';

/**
 * Localized title, intro, and section nav for `/handbook`. Kept as a client
 * island so the page can stay `force-static` and read markdown from disk at
 * build time (standalone runtime has no `docs/` tree).
 *
 * @param props - Section-nav links as `children`.
 * @returns The heading, intro paragraph, and localized section nav.
 */
export function HandbookIntro(props: { children: ReactNode }): ReactElement {
  const { t } = useTranslations();
  return (
    <>
      <h1 className="text-3xl font-semibold">{t('handbook.title')}</h1>
      <p className="mt-4 text-white/60">
        {t('handbook.introBefore')}{' '}
        <a
          className="text-[#f7931a] underline underline-offset-2"
          href="https://github.com/21gifts/api/tree/develop/docs/handbook"
        >
          21gifts/api
        </a>
        {t('handbook.introAfter')}
      </p>
      <nav aria-label={t('aria.handbookSections')} className="mt-8 flex flex-wrap gap-4 text-sm">
        {props.children}
      </nav>
    </>
  );
}
