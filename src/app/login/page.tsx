import type { ReactElement } from 'react';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { LoginCard } from '@/components/LoginCard';
import { OnboardingGate } from '@/components/OnboardingGate';
import { ThemeSwitcher } from '@/components/ThemeSwitcher';
import { getRequestLocale } from '@/lib/request-locale';
import { getCatalog } from '@/lib/messages';
import { translate } from '@/lib/translate';

/**
 * `/login` — the passkey sign-in page.
 *
 * @returns The login screen.
 */
export default async function LoginPage(): Promise<ReactElement> {
  const locale = await getRequestLocale();
  const messages = getCatalog(locale);
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center gap-10 px-6">
      <div className="absolute top-4 right-5 flex items-center gap-2">
        <ThemeSwitcher />
        <LanguageSwitcher tone="light" />
      </div>
      <OnboardingGate screen="login">
        <h1 className="text-center text-3xl font-semibold tracking-tight text-app-fg sm:text-4xl">
          {translate(messages, 'login.pageTitle')}
        </h1>
        <LoginCard />
      </OnboardingGate>
    </main>
  );
}
