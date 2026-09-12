import Link from 'next/link';
import type { ReactElement } from 'react';
import { Wordmark } from '@/components/ui';
import { getCatalog } from '@/lib/messages';
import { getRequestLocale } from '@/lib/request-locale';
import { translate } from '@/lib/translate';

/**
 * Marketing footer: wordmark, section links including About, legal, GitHub, and a quiet verse.
 *
 * @returns The footer element.
 */
export async function MarketingFooter(): Promise<ReactElement> {
  const locale = await getRequestLocale();
  const messages = getCatalog(locale);

  return (
    <footer className="border-t border-paper/10 px-5 py-10">
      <div className="mx-auto flex max-w-[1100px] flex-col items-start gap-6 sm:flex-row sm:items-center sm:justify-between">
        <Wordmark tone="dark" size="footer" />
        <nav
          aria-label={translate(messages, 'aria.footer')}
          className="flex flex-wrap gap-4 text-sm text-paper/70"
        >
          <Link href="/#how">{translate(messages, 'nav.how')}</Link>
          <Link href="/#why">{translate(messages, 'nav.why')}</Link>
          <Link href="/#faq">{translate(messages, 'nav.faq')}</Link>
          <Link href="/about">{translate(messages, 'nav.about')}</Link>
          <Link href="/handbook">{translate(messages, 'nav.handbook')}</Link>
          <Link href="/legal">{translate(messages, 'nav.legal')}</Link>
          <Link href="/rules">{translate(messages, 'nav.rules')}</Link>
        </nav>
        <a
          href="https://github.com/21gifts"
          className="text-sm text-paper/70"
          aria-label={translate(messages, 'aria.github')}
        >
          GitHub
        </a>
      </div>
      <p className="mx-auto mt-8 max-w-[1100px] text-center text-sm italic text-paper/50">
        {translate(messages, 'footer.verse')}
        <span className="mt-2 block text-xs not-italic font-medium tracking-widest text-accent uppercase">
          {translate(messages, 'footer.verseRef')}
        </span>
      </p>
    </footer>
  );
}
