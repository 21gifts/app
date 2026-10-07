import type { ReactElement } from 'react';
import { AppShell } from '@/components/AppShell';
import { DailyPaymentAmountsScreen } from '@/components/DailyPaymentsScreen';
import { OnboardingGate } from '@/components/OnboardingGate';
import { ProfileChromeLeft } from '@/components/ProfileChromeLeft';
import { SignedInChrome } from '@/components/SignedInChrome';

/**
 * `/grants/payments/amounts` — the daily payout switch and recipient amounts.
 *
 * The chrome back returns to the previous in-app view (the card has no back
 * control). Requires name + address + living-room rules agreement via
 * {@link OnboardingGate} `screen="welcome"`. There is no `route.ts` beside
 * this page (Next.js forbids that); roster HTTP lives under
 * `/funding/daily-roster`. The comment is a separate page.
 *
 * @returns The daily-payment amounts screen.
 */
export default function DailyPaymentAmountsPage(): ReactElement {
  return (
    <AppShell
      mode="fill"
      align="center"
      topLeft={<ProfileChromeLeft />}
      topRight={<SignedInChrome />}
    >
      <OnboardingGate screen="welcome">
        <DailyPaymentAmountsScreen />
      </OnboardingGate>
    </AppShell>
  );
}
