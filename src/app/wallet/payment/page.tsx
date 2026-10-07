import { Suspense, type ReactElement } from 'react';
import { AppShell } from '@/components/AppShell';
import { OnboardingGate } from '@/components/OnboardingGate';
import { SignedInChrome } from '@/components/SignedInChrome';
import { WalletChromeLeft } from '@/components/WalletChromeLeft';
import { WalletPaymentDetails } from '@/components/WalletPaymentDetails';

/**
 * `/wallet/payment?id=…` shows one wallet payment, opened from a row of the
 * `/wallet` payment list.
 *
 * @returns The payment screen.
 */
export default function WalletPaymentPage(): ReactElement {
  return (
    <AppShell mode="fill" topLeft={<WalletChromeLeft />} topRight={<SignedInChrome />}>
      <OnboardingGate screen="wallet">
        <Suspense fallback={null}>
          <WalletPaymentDetails />
        </Suspense>
      </OnboardingGate>
    </AppShell>
  );
}
