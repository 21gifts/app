'use client';

import Link from 'next/link';
import { useState, type ReactElement } from 'react';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { useTranslations } from '@/components/LocaleProvider';
import { PwaInstall } from '@/components/PwaInstall';
import { ButtonLink, Wordmark } from '@/components/ui';

/**
 * Sticky dark header for marketing pages: wordmark, section nav, optional
 * PWA install control, language switcher, login CTA, and a mobile menu toggle.
 *
 * @returns The header element.
 */
export function MarketingHeader(): ReactElement {
  const [open, setOpen] = useState(false);
  const { t } = useTranslations();

  const closeMenu = (): void => {
    setOpen(false);
  };

  return (
    <header className="sticky top-0 z-50 flex items-center justify-between border-b border-paper/10 bg-ink/85 px-5 py-3.5 backdrop-blur-xl">
      <Wordmark href="/" tone="dark" />
      <div className="flex items-center gap-4">
        <nav
          aria-label={t('aria.primary')}
          className={`items-center gap-6 text-sm text-paper/80 ${open ? 'absolute top-full right-0 left-0 flex flex-col border-b border-paper/10 bg-ink px-5 py-4' : 'hidden md:flex'}`}
        >
          <Link href="/#how" onClick={closeMenu}>
            {t('nav.how')}
          </Link>
          <Link href="/#why" onClick={closeMenu}>
            {t('nav.why')}
          </Link>
          <Link href="/#faq" onClick={closeMenu}>
            {t('nav.faq')}
          </Link>
          <Link href="/stats" onClick={closeMenu}>
            {t('nav.stats')}
          </Link>
          <Link href="/handbook" onClick={closeMenu}>
            {t('nav.handbook')}
          </Link>
          <span onClick={closeMenu}>
            <ButtonLink href="/login" variant="accent" tone="dark" size="sm">
              {t('nav.login')}
            </ButtonLink>
          </span>
          <PwaInstall tone="dark" placement="header" />
        </nav>
        <LanguageSwitcher tone="dark" />
        <button
          type="button"
          className="flex min-h-11 min-w-11 flex-col items-center justify-center gap-1.5 md:hidden"
          aria-label={t('aria.menu')}
          aria-expanded={open}
          onClick={() => {
            setOpen((current) => !current);
          }}
        >
          <span className="block h-0.5 w-5 bg-paper" />
          <span className="block h-0.5 w-5 bg-paper" />
          <span className="block h-0.5 w-5 bg-paper" />
        </button>
      </div>
    </header>
  );
}
