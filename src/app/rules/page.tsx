import type { ReactElement } from 'react';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { RulesDocument } from '@/components/RulesDocument';
import { getCatalog } from '@/lib/messages';
import { getRequestLocale } from '@/lib/request-locale';
import { translate } from '@/lib/translate';

/**
 * `/rules` — public living-room rules (light chrome, like `/donate`).
 *
 * @returns The rules screen.
 */
export default async function RulesPage(): Promise<ReactElement> {
  const locale = await getRequestLocale();
  const messages = getCatalog(locale);
  return (
    <main className="relative flex min-h-screen flex-col items-center gap-10 px-6 py-16">
      <div className="absolute top-4 right-5">
        <LanguageSwitcher tone="light" />
      </div>
      <h1 className="text-center text-3xl font-semibold tracking-tight text-neutral-900 sm:text-4xl">
        {translate(messages, 'rules.heading')}
      </h1>
      <RulesDocument messages={messages} />
    </main>
  );
}
