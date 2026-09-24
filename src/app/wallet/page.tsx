import type { ReactElement } from 'react';
import { AppShell } from '@/components/AppShell';
import { OnboardingGate } from '@/components/OnboardingGate';
import { SignedInChrome } from '@/components/SignedInChrome';
import { WalletChromeLeft } from '@/components/WalletChromeLeft';
import { WalletScreen } from '@/components/WalletScreen';

/**
 * `/wallet` shows Add recovery phrase when `passkeyCredentialId` is missing
 * or empty, otherwise Show recovery phrase under Advanced functions.
 *
 * @returns The wallet screen.
 */
export default function WalletPage(): ReactElement {
  return (
    <AppShell mode="fill" topLeft={<WalletChromeLeft />} topRight={<SignedInChrome />}>
      <OnboardingGate screen="wallet">
        <WalletScreen />
      </OnboardingGate>
    </AppShell>
  );
}
