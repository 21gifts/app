import type { ReactElement } from 'react';
import { AppShell } from '@/components/AppShell';
import { OnboardingGate } from '@/components/OnboardingGate';
import { PosAmount } from '@/components/PosScreen';
import { ProfileChromeLeft } from '@/components/ProfileChromeLeft';
import { SignedInChrome } from '@/components/SignedInChrome';

/**
 * `/pos/amount` — choose the sat amount. The QR stays on `/pos`.
 *
 * @returns The amount page.
 */
export default function PosAmountPage(): ReactElement {
  return (
    <AppShell
      mode="fill"
      topLeft={<ProfileChromeLeft backHref="/pos" backLabelKey="nav.back" />}
      topRight={<SignedInChrome />}
    >
      <OnboardingGate screen="profile">
        <PosAmount />
      </OnboardingGate>
    </AppShell>
  );
}
