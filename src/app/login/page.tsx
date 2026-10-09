import type { Metadata } from 'next';
import type { ReactElement } from 'react';
import { AppShell } from '@/components/AppShell';
import { HomeWordmark } from '@/components/HomeWordmark';
import { ProfileChromeLeft } from '@/components/ProfileChromeLeft';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { LoginCard } from '@/components/LoginCard';
import { OnboardingGate } from '@/components/OnboardingGate';

/** Sign-in is a utility screen, not a search landing page. */
export const metadata: Metadata = { robots: { index: false, follow: false } };

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
      topLeft={<ProfileChromeLeft wordmark={<HomeWordmark />} />}
      topRight={<LanguageSwitcher tone="light" />}
    >
      <OnboardingGate screen="login">
        <LoginCard />
      </OnboardingGate>
    </AppShell>
  );
}
