import type { Metadata } from 'next';
import type { ReactElement } from 'react';
import { AppShell } from '@/components/AppShell';
import { HomeWordmark } from '@/components/HomeWordmark';
import { ProfileChromeLeft } from '@/components/ProfileChromeLeft';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { ButtonLink } from '@/components/ui';
import { getRequestLocale } from '@/lib/request-locale';
import { getCatalog } from '@/lib/messages';
import { marketingMetadata } from '@/lib/marketing-metadata';
import { translate } from '@/lib/translate';
import { localizedPublicPath } from '@/lib/public-locale-path';

/** The public gift entry page also has its own canonical search preview. */
export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();
  const messages = getCatalog(locale);
  return marketingMetadata(
    '/donate',
    messages['donate.metaTitle'],
    messages['donate.lead'],
    locale,
  );
}

/**
 * `/donate` — Give Bitcoin explainer: open the forum, choose a payable reaction, then send Bitcoin.
 *
 * @returns The donate screen.
 */
export default async function DonatePage(): Promise<ReactElement> {
  const locale = await getRequestLocale();
  const messages = getCatalog(locale);
  return (
    <AppShell
      mode="fill"
      align="center"
      topLeft={
        <ProfileChromeLeft wordmark={<HomeWordmark publicHref={localizedPublicPath(locale, '/')} />} />
      }
      topRight={<LanguageSwitcher tone="light" />}
    >
      <div className="flex w-full max-w-md flex-col items-center gap-6">
        <h1 className="text-center text-3xl font-semibold tracking-tight text-app-fg sm:text-4xl">
          {translate(messages, 'donate.pageTitle')}
        </h1>
        <p className="text-center text-app-muted">{translate(messages, 'donate.lead')}</p>
        <ButtonLink href="/welcome" variant="accent">
          {translate(messages, 'donate.continue')}
        </ButtonLink>
      </div>
    </AppShell>
  );
}
