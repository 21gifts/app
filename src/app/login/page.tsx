import type { ReactElement } from 'react';
import { AppShell } from '@/components/AppShell';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { LoginCard } from '@/components/LoginCard';
import { OnboardingGate } from '@/components/OnboardingGate';
import { ThemeSwitcher } from '@/components/ThemeSwitcher';
import { Wordmark } from '@/components/ui';

/**
 * `/login` — the passkey sign-in page.
 *
 * Single title lives inside {@link LoginCard} (`login.heading`).
 *
 * @returns The login screen.
 */
export default function LoginPage(): ReactElement {
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
      <OnboardingGate screen="login">
        <LoginCard />
      </OnboardingGate>
    </AppShell>
  );
}
