import Link from 'next/link';
import type { ReactElement } from 'react';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { ThemeSwitcher } from '@/components/ThemeSwitcher';
import { getRequestLocale } from '@/lib/request-locale';
import { getCatalog } from '@/lib/messages';
import { translate } from '@/lib/translate';

/**
 * `/donate` — Send help explainer: pick a forum message, then send Bitcoin.
 *
 * @returns The donate screen.
 */
export default async function DonatePage(): Promise<ReactElement> {
  const locale = await getRequestLocale();
  const messages = getCatalog(locale);
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center gap-10 px-6">
      <div className="absolute top-4 right-5 flex items-center gap-2">
        <ThemeSwitcher />
        <LanguageSwitcher tone="light" />
      </div>
      <div className="flex w-full max-w-md flex-col items-center gap-6">
        <h1 className="text-center text-3xl font-semibold tracking-tight text-app-fg sm:text-4xl">
          {translate(messages, 'donate.pageTitle')}
        </h1>
        <p className="text-center text-app-muted">{translate(messages, 'donate.lead')}</p>
        <Link
          href="/welcome"
          className="rounded-full bg-app-accent px-6 py-3 font-medium text-[#0a090c] no-underline"
        >
          {translate(messages, 'donate.continue')}
        </Link>
      </div>
    </main>
  );
}
