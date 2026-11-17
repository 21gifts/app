import type { ReactElement } from 'react';
import { OpenLoansScreen } from '@/app/loans/OpenLoansScreen';
import { OpenLoansTopRight } from '@/app/loans/OpenLoansTopRight';
import { AppShell } from '@/components/AppShell';
import { OnboardingGate } from '@/components/OnboardingGate';
import { ProfileChromeLeft } from '@/components/ProfileChromeLeft';

/**
 * Public open-loan overview, signed-out readable.
 *
 * The auth-store read lives in {@link OpenLoansTopRight}. This page stays a
 * server component. JSON is `GET /loans/open` (`src/app/loans/open/route.ts`);
 * Next.js forbids `route.ts` beside this page. `/loans/repay` is a different
 * route and is not wrapped by a layout here.
 *
 * @returns The open-loans page.
 */
export default function OpenLoansPage(): ReactElement {
  return (
    <AppShell
      mode="fill"
      align="center"
      topLeft={<ProfileChromeLeft />}
      topRight={<OpenLoansTopRight />}
    >
      <OnboardingGate screen="welcome" allowGuest>
        <OpenLoansScreen />
      </OnboardingGate>
    </AppShell>
  );
}
