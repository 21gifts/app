import type { ReactElement } from 'react';
import { AppShell } from '@/components/AppShell';
import { OnboardingGate } from '@/components/OnboardingGate';
import { ProfileChromeLeft } from '@/components/ProfileChromeLeft';
import { SignedInChrome } from '@/components/SignedInChrome';
import { WalletScreen } from '@/components/WalletScreen';

/**
 * `/wallet` — recovery phrase for new accounts and optional activate for existing ones.
 *
 * @returns The wallet screen.
 */
export default function WalletPage(): ReactElement {
  return (
    <AppShell mode="flow" topLeft={<ProfileChromeLeft />} topRight={<SignedInChrome />}>
      <OnboardingGate screen="wallet">
        <WalletScreen />
      </OnboardingGate>
    </AppShell>
  );
}
