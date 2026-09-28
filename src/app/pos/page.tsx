import type { ReactElement } from 'react';
import { AppShell } from '@/components/AppShell';
import { OnboardingGate } from '@/components/OnboardingGate';
import { PosScreen } from '@/components/PosScreen';
import { ProfileChromeLeft } from '@/components/ProfileChromeLeft';
import { SignedInChrome } from '@/components/SignedInChrome';

/**
 * `/pos` — the Open CryptoPay QR. Set an amount on `/pos/amount`.
 *
 * @returns The point-of-sale screen.
 */
export default function PosPage(): ReactElement {
  return (
    <AppShell mode="fill" topLeft={<ProfileChromeLeft />} topRight={<SignedInChrome />}>
      <OnboardingGate screen="profile">
        <PosScreen />
      </OnboardingGate>
    </AppShell>
  );
}
