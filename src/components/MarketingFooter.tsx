'use client';

import Link from 'next/link';
import type { ReactElement } from 'react';
import { useTranslations } from '@/components/LocaleProvider';

/**
 * Marketing footer: wordmark, section links, legal, and GitHub.
 *
 * @returns The footer element.
 */
export function MarketingFooter(): ReactElement {
  const { t } = useTranslations();

  return (
    <footer className="border-t border-white/10 px-5 py-10">
      <div className="mx-auto flex max-w-[1100px] flex-col items-start gap-6 sm:flex-row sm:items-center sm:justify-between">
        <span className="font-bold">21.gifts</span>
        <nav aria-label={t('aria.footer')} className="flex flex-wrap gap-4 text-sm text-white/70">
          <Link href="/#how">{t('nav.how')}</Link>
          <Link href="/#why">{t('nav.why')}</Link>
          <Link href="/#faq">{t('nav.faq')}</Link>
          <Link href="/handbook">{t('nav.handbook')}</Link>
          <Link href="/legal">{t('nav.legal')}</Link>
        </nav>
        <a
          href="https://github.com/21gifts"
          className="text-sm text-white/70"
          aria-label={t('aria.github')}
        >
          GitHub
        </a>
      </div>
    </footer>
  );
}
