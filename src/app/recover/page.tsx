import type { ReactElement } from 'react';
import { AppShell } from '@/components/AppShell';
import { HomeWordmark } from '@/components/HomeWordmark';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { ProfileChromeLeft } from '@/components/ProfileChromeLeft';
import { RecoverScreen } from '@/components/RecoverScreen';

/**
 * `/recover` — the signed-out social recovery of an account whose passkey is
 * lost, opened from **Recover account via Social Recovery** on `/login`. Same
 * chrome as `/login`. Not behind `OnboardingGate`: its login gate would
 * leave the page once the recovered account signs in, before its balance has
 * moved.
 *
 * @returns The recovery screen.
 */
export default function RecoverPage(): ReactElement {
  return (
    <AppShell
      mode="fill"
      align="center"
      topLeft={<ProfileChromeLeft wordmark={<HomeWordmark />} />}
      topRight={<LanguageSwitcher tone="light" />}
    >
      <RecoverScreen />
    </AppShell>
  );
}
