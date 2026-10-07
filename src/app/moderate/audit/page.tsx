import type { ReactElement } from 'react';
import { AccessAuditScreen } from '@/components/AccessAuditScreen';
import { AppShell } from '@/components/AppShell';
import { OnboardingGate } from '@/components/OnboardingGate';
import { ProfileChromeLeft } from '@/components/ProfileChromeLeft';
import { SignedInChrome } from '@/components/SignedInChrome';

/**
 * `/moderate/audit` — signed-in access log of team reads of member data.
 *
 * The chrome back returns to the previous in-app view (the card has no back
 * control). Same onboarding gate as `/moderate`. JSON lives under
 * `/team/audit`, because Next.js forbids a `route.ts` beside this page.
 *
 * @returns The access-log screen.
 */
export default function AccessAuditPage(): ReactElement {
  return (
    <AppShell
      mode="fill"
      align="center"
      topLeft={<ProfileChromeLeft />}
      topRight={<SignedInChrome />}
    >
      <OnboardingGate screen="welcome">
        <AccessAuditScreen />
      </OnboardingGate>
    </AppShell>
  );
}
