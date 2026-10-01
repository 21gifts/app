import type { ReactElement } from 'react';
import { AppShell } from '@/components/AppShell';
import { DailyPaymentsScreen } from '@/components/DailyPaymentsScreen';
import { OnboardingGate } from '@/components/OnboardingGate';
import { ProfileChromeLeft } from '@/components/ProfileChromeLeft';
import { SignedInChrome } from '@/components/SignedInChrome';

/**
 * `/grants/payments` — daily payout comment, switch, and recipient list.
 *
 * The chrome back returns to the previous in-app view (the card has no back
 * control). Requires name + address + living-room rules agreement via
 * {@link OnboardingGate} `screen="welcome"`. There is no `route.ts` beside
 * this page (Next.js forbids that); roster HTTP lives under
 * `/funding/daily-roster`.
 *
 * @returns The daily-payments screen.
 */
export default function DailyPaymentsPage(): ReactElement {
  return (
    <AppShell
      mode="fill"
      align="center"
      topLeft={<ProfileChromeLeft />}
      topRight={<SignedInChrome />}
    >
      <OnboardingGate screen="welcome">
        <DailyPaymentsScreen />
      </OnboardingGate>
    </AppShell>
  );
}
