import type { ReactElement } from 'react';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { LoginCard } from '@/components/LoginCard';
import { OnboardingGate } from '@/components/OnboardingGate';
import { ThemeSwitcher } from '@/components/ThemeSwitcher';
import { PageChrome, Wordmark } from '@/components/ui';

/**
 * `/login` — the passkey sign-in page.
 *
 * Single title lives inside {@link LoginCard} (`login.heading`).
 *
 * @returns The login screen.
 */
export default function LoginPage(): ReactElement {
  return (
    <PageChrome
      topLeft={<Wordmark href="/" />}
      topRight={
        <>
          <ThemeSwitcher />
          <LanguageSwitcher tone="light" />
        </>
      }
    >
      <OnboardingGate screen="login">
        <LoginCard />
      </OnboardingGate>
    </PageChrome>
  );
}
