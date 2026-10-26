import type { ReactElement } from 'react';
import { AppShell } from '@/components/AppShell';
import { OnboardingGate } from '@/components/OnboardingGate';
import { ProfileChromeLeft } from '@/components/ProfileChromeLeft';
import { ShopsScreen } from '@/components/ShopsScreen';
import { SignedInChrome } from '@/components/SignedInChrome';

/**
 * `/shops` is the signed-in shop list. The default view lists shop pages.
 * Post at `#post` remains the `#21GiftsShop` forum notes.
 *
 * Requires name + address + living-room rules agreement via
 * {@link OnboardingGate} `screen="welcome"`, same as `/welcome`. There is
 * no `route.ts` beside this page (Next.js forbids that).
 *
 * @returns The shops screen.
 */
export default function ShopsPage(): ReactElement {
  return (
    <AppShell
      mode="flow"
      align="start"
      topLeft={<ProfileChromeLeft />}
      topRight={<SignedInChrome />}
    >
      <OnboardingGate screen="welcome">
        <ShopsScreen />
      </OnboardingGate>
    </AppShell>
  );
}
