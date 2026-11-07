import type { ReactElement } from 'react';
import { AppShell } from '@/components/AppShell';
import { LoanRepayScreen } from '@/components/LoanRepayScreen';
import { OnboardingGate } from '@/components/OnboardingGate';
import { SignedInChrome } from '@/components/SignedInChrome';
import { WalletChromeLeft } from '@/components/WalletChromeLeft';

/**
 * `/loans/repay` combines every current loan repayment into one wallet flow.
 *
 * @returns The signed-in loan repayment screen.
 */
export default function LoanRepayPage(): ReactElement {
  return (
    <AppShell mode="fill" topLeft={<WalletChromeLeft />} topRight={<SignedInChrome />}>
      <OnboardingGate screen="wallet">
        <LoanRepayScreen />
      </OnboardingGate>
    </AppShell>
  );
}
