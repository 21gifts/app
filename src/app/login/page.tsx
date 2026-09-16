import type { ReactElement } from 'react';
import { AppShell } from '@/components/AppShell';
import { HomeWordmark } from '@/components/HomeWordmark';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { LoginCard } from '@/components/LoginCard';
import { OnboardingGate } from '@/components/OnboardingGate';

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
      topLeft={<HomeWordmark />}
      topRight={<LanguageSwitcher tone="light" />}
    >
      <OnboardingGate screen="login">
        <LoginCard />
      </OnboardingGate>
    </AppShell>
  );
}
