import type { ReactElement } from 'react';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { RulesDocument } from '@/components/RulesDocument';
import { ThemeSwitcher } from '@/components/ThemeSwitcher';
import { getCatalog } from '@/lib/messages';
import { getRequestLocale } from '@/lib/request-locale';
import { translate } from '@/lib/translate';

/**
 * `/rules` — public living-room rules (app chrome, like `/donate`).
 *
 * @returns The rules screen.
 */
export default async function RulesPage(): Promise<ReactElement> {
  const locale = await getRequestLocale();
  const messages = getCatalog(locale);
  return (
    <main className="relative flex min-h-screen flex-col items-center gap-10 px-6 py-16">
      <div className="absolute top-4 right-5 flex items-center gap-2">
        <ThemeSwitcher />
        <LanguageSwitcher tone="light" />
      </div>
      <h1 className="text-center text-3xl font-semibold tracking-tight text-app-fg sm:text-4xl">
        {translate(messages, 'rules.heading')}
      </h1>
      <RulesDocument messages={messages} />
    </main>
  );
}
