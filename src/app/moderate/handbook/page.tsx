import type { ReactElement } from 'react';
import { AppShell } from '@/components/AppShell';
import { ModerateHandbookScreen } from '@/components/ModerateHandbookScreen';
import { OnboardingGate } from '@/components/OnboardingGate';
import { ProfileChromeLeft } from '@/components/ProfileChromeLeft';
import { SignedInChrome } from '@/components/SignedInChrome';

/**
 * `/moderate/handbook` — signed-in staff handbook of how 21.gifts works.
 *
 * `/moderate` is the hub; `/moderate/handbook` is the chapter list. Requires
 * name + address + living-room rules agreement via {@link OnboardingGate}
 * `screen="welcome"`. There is no `route.ts` beside this page.
 *
 * @returns The handbook screen.
 */
export default function ModerateHandbookPage(): ReactElement {
  return (
    <AppShell
      mode="fill"
      align="center"
      topLeft={<ProfileChromeLeft />}
      topRight={<SignedInChrome />}
    >
      <OnboardingGate screen="welcome">
        <ModerateHandbookScreen />
      </OnboardingGate>
    </AppShell>
  );
}
