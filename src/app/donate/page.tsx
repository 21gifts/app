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

/** English search preview for `/donate`. Canonical follows the language URL. */
export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();
  return marketingMetadata(
    '/donate',
    'Donate Bitcoin and help someone | 21.gifts',
    'Sign in and open a post in the forum. Write a reaction under it, add an amount and pay from your wallet. The Bitcoin goes to the person who wrote the post.',
    locale,
  );
}

/**
 * `/donate` — Give Bitcoin explainer: open a forum post, write a reaction with an amount, then pay.
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
        <ProfileChromeLeft
          wordmark={<HomeWordmark publicHref={localizedPublicPath(locale, '/')} />}
        />
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
