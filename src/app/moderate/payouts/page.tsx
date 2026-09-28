import type { ReactElement } from 'react';
import { AppShell } from '@/components/AppShell';
import { FundingPayoutsScreen } from '@/components/FundingPayoutsScreen';
import { OnboardingGate } from '@/components/OnboardingGate';
import { ProfileChromeLeft } from '@/components/ProfileChromeLeft';
import { SignedInChrome } from '@/components/SignedInChrome';

/**
 * `/moderate/payouts` — signed-in staff payout-per-person table.
 *
 * `/moderate` is the hub; this page is the table. Requires name +
 * address + living-room rules agreement via {@link OnboardingGate}
 * `screen="welcome"`, same as `/moderate`. HTML `/moderate/payouts` is the
 * table, not a GET proxy; JSON lives under `/funding/payout-days`, because
 * Next.js forbids a `route.ts` beside this page.
 *
 * @returns The payout-per-person screen.
 */
export default function PayoutsPage(): ReactElement {
  return (
    <AppShell
      mode="fill"
      align="center"
      topLeft={<ProfileChromeLeft />}
      topRight={<SignedInChrome />}
    >
      <OnboardingGate screen="welcome">
        <FundingPayoutsScreen />
      </OnboardingGate>
    </AppShell>
  );
}
