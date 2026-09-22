import type { ReactElement } from 'react';
import { AppShell } from '@/components/AppShell';
import { OnboardingGate } from '@/components/OnboardingGate';
import { ProfileChromeLeft } from '@/components/ProfileChromeLeft';
import { ShopsScreen } from '@/components/ShopsScreen';
import { SignedInChrome } from '@/components/SignedInChrome';

/**
 * `/shops` — signed-in shop listings (forum notes tagged `#21GiftsShop`).
 *
 * Requires name + address + living-room rules agreement via
 * {@link OnboardingGate} `screen="welcome"`, same as `/welcome`. An
 * unconfirmed recovery phrase (`account.setup === 'wallet'`) does not
 * replace this page. There is no `route.ts` beside this page (Next.js
 * forbids that).
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
