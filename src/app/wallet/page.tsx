import type { ReactElement } from 'react';
import { AppShell } from '@/components/AppShell';
import { OnboardingGate } from '@/components/OnboardingGate';
import { ProfileChromeLeft } from '@/components/ProfileChromeLeft';
import { SignedInChrome } from '@/components/SignedInChrome';
import { WalletScreen } from '@/components/WalletScreen';

/**
 * `/wallet` shows Activate recovery phrase when the account cannot show a
 * phrase yet, otherwise Show recovery phrase under Advanced functions.
 *
 * @returns The wallet screen.
 */
export default function WalletPage(): ReactElement {
  return (
    <AppShell mode="fill" topLeft={<ProfileChromeLeft />} topRight={<SignedInChrome />}>
      <OnboardingGate screen="wallet">
        <WalletScreen />
      </OnboardingGate>
    </AppShell>
  );
}
