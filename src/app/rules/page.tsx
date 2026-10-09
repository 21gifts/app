import type { Metadata } from 'next';
import type { ReactElement } from 'react';
import { RulesDocument } from '@/components/RulesDocument';
import { RulesPageChrome } from '@/components/RulesPageChrome';
import { getCatalog } from '@/lib/messages';
import { getRequestLocale } from '@/lib/request-locale';
import { marketingMetadata } from '@/lib/marketing-metadata';
import { translate } from '@/lib/translate';

/** English search preview for `/rules`. Canonical follows the language URL. */
export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();
  return marketingMetadata(
    '/rules',
    'Living room rules | 21.gifts',
    'You are a guest in a living room with the windows open. Everything you write here is public, and anyone walking past can read along.',
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
