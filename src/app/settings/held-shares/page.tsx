import type { ReactElement } from 'react';
import { AppShell } from '@/components/AppShell';
import { HeldSharesScreen } from '@/components/HeldSharesScreen';
import { OnboardingGate } from '@/components/OnboardingGate';
import { ProfileChromeLeft } from '@/components/ProfileChromeLeft';
import { SignedInChrome } from '@/components/SignedInChrome';

/**
 * `/settings/held-shares` — the shares the signed-in member keeps for other
 * members' social recovery, opened from **Shares I keep for others** on
 * `/settings`.
 *
 * Requires name + username + living-room rules agreement via {@link OnboardingGate}
 * `screen="profile"`, like `/settings`.
 *
 * @returns The kept-shares screen.
 */
export default function HeldSharesPage(): ReactElement {
  return (
    <AppShell mode="fill" topLeft={<ProfileChromeLeft />} topRight={<SignedInChrome />}>
      <OnboardingGate screen="profile">
        <HeldSharesScreen />
      </OnboardingGate>
    </AppShell>
  );
}
