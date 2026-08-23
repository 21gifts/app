'use client';

import Link from 'next/link';
import { useState, type ReactElement } from 'react';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { useTranslations } from '@/components/LocaleProvider';

/**
 * Sticky dark header for marketing pages: wordmark, section nav, language
 * switcher, login CTA, and a mobile menu toggle.
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
    <header className="sticky top-0 z-50 flex items-center justify-between border-b border-white/10 bg-[#0a090c]/85 px-5 py-3.5 backdrop-blur-xl">
      <Link href="/" className="text-[17px] font-bold text-white no-underline">
        21.gifts
      </Link>
      <div className="flex items-center gap-4">
        <nav
          aria-label={t('aria.primary')}
          className={`items-center gap-6 text-sm text-white/80 ${open ? 'absolute top-full right-0 left-0 flex flex-col border-b border-white/10 bg-[#0a090c] px-5 py-4' : 'hidden md:flex'}`}
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
          <Link href="/handbook" onClick={closeMenu}>
            {t('nav.handbook')}
          </Link>
          <Link
            href="/login"
            className="rounded-full bg-[#f7931a] px-4 py-2 font-medium text-[#0a090c] no-underline"
            onClick={closeMenu}
          >
            {t('nav.login')}
          </Link>
        </nav>
        <LanguageSwitcher tone="dark" />
        <button
          type="button"
          className="flex flex-col gap-1.5 md:hidden"
          aria-label={t('aria.menu')}
          aria-expanded={open}
          onClick={() => {
            setOpen((current) => !current);
          }}
        >
          <span className="block h-0.5 w-5 bg-white" />
          <span className="block h-0.5 w-5 bg-white" />
          <span className="block h-0.5 w-5 bg-white" />
        </button>
      </div>
    </header>
  );
}
