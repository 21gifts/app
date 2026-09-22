import type { ReactElement } from 'react';
import { AppShell } from '@/components/AppShell';
import { OnboardingGate } from '@/components/OnboardingGate';
import { PlacesMapScreen } from '@/components/PlacesMapScreen';
import { ProfileChromeLeft } from '@/components/ProfileChromeLeft';
import { SignedInChrome } from '@/components/SignedInChrome';

/**
 * `/map` — signed-in map of every forum note that has a place pin.
 *
 * Requires the same welcome gate as `/shops`. There is no `route.ts`
 * beside this page (Next.js forbids that).
 *
 * @returns The map screen.
 */
export default function MapPage(): ReactElement {
  return (
    <AppShell
      mode="flow"
      align="start"
      topLeft={<ProfileChromeLeft />}
      topRight={<SignedInChrome />}
    >
      <OnboardingGate screen="welcome">
        <PlacesMapScreen />
      </OnboardingGate>
    </AppShell>
  );
}
