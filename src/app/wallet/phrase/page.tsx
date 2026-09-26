import type { ReactElement } from 'react';
import { AppShell } from '@/components/AppShell';
import { OnboardingGate } from '@/components/OnboardingGate';
import { SignedInChrome } from '@/components/SignedInChrome';
import { WalletChromeLeft } from '@/components/WalletChromeLeft';
import { WalletPhraseScreen } from '@/components/WalletScreen';

/**
 * `/wallet/phrase` shows the recovery phrase or a recovery error.
 * The receive QR stays on `/wallet`.
 *
 * @returns The recovery subpage.
 */
export default function WalletPhrasePage(): ReactElement {
  return (
    <AppShell mode="fill" topLeft={<WalletChromeLeft />} topRight={<SignedInChrome />}>
      <OnboardingGate screen="wallet">
        <WalletPhraseScreen />
      </OnboardingGate>
    </AppShell>
  );
}
