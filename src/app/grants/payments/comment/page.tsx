import type { ReactElement } from 'react';
import { AppShell } from '@/components/AppShell';
import { DailyPaymentCommentScreen } from '@/components/DailyPaymentsScreen';
import { OnboardingGate } from '@/components/OnboardingGate';
import { ProfileChromeLeft } from '@/components/ProfileChromeLeft';
import { SignedInChrome } from '@/components/SignedInChrome';

/**
 * `/grants/payments/comment` — the daily payout comment only.
 *
 * The chrome back returns to the previous in-app view (the card has no back
 * control). Requires name + address + living-room rules agreement via
 * {@link OnboardingGate} `screen="welcome"`. There is no `route.ts` beside
 * this page (Next.js forbids that); roster HTTP lives under
 * `/funding/daily-roster`. Amounts are a separate page.
 *
 * @returns The daily-payment comment screen.
 */
export default function DailyPaymentCommentPage(): ReactElement {
  return (
    <AppShell
      mode="fill"
      align="center"
      topLeft={<ProfileChromeLeft />}
      topRight={<SignedInChrome />}
    >
      <OnboardingGate screen="welcome">
        <DailyPaymentCommentScreen />
      </OnboardingGate>
    </AppShell>
  );
}
