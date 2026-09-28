import type { Metadata } from 'next';
import type { ReactElement } from 'react';
import { RulesDocument } from '@/components/RulesDocument';
import { RulesPageChrome } from '@/components/RulesPageChrome';
import { getCatalog } from '@/lib/messages';
import { getRequestLocale } from '@/lib/request-locale';
import { marketingMetadata } from '@/lib/marketing-metadata';
import { translate } from '@/lib/translate';

/** Search preview for the public living room rules. */
export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();
  const messages = getCatalog(locale);
  return marketingMetadata(
    '/rules',
    `${messages['rules.heading']} | 21.gifts`,
    messages['rules.lead'],
    locale,
  );
}

/**
 * `/rules` — public living-room rules (app chrome, like `/donate`).
 *
 * @returns The rules screen.
 */
export default async function RulesPage(): Promise<ReactElement> {
  const locale = await getRequestLocale();
  const messages = getCatalog(locale);
  return (
    <RulesPageChrome>
      <h1 className="text-center text-3xl font-semibold tracking-tight text-app-fg sm:text-4xl">
        {translate(messages, 'rules.heading')}
      </h1>
      <RulesDocument messages={messages} />
    </RulesPageChrome>
  );
}
