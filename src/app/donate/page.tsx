import type { ReactElement } from 'react';
import { AppShell } from '@/components/AppShell';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { ThemeSwitcher } from '@/components/ThemeSwitcher';
import { ButtonLink, Wordmark } from '@/components/ui';
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
    <AppShell
      mode="fill"
      align="center"
      topLeft={<Wordmark href="/" />}
      topRight={
        <>
          <ThemeSwitcher />
          <LanguageSwitcher tone="light" />
        </>
      }
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
