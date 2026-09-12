import type { ReactElement } from 'react';
import { Suspense } from 'react';
import { AppShell } from '@/components/AppShell';
import { NotificationsLoader } from '@/components/NotificationsLoader';
import { OnboardingGate } from '@/components/OnboardingGate';
import { ProfileChromeLeft } from '@/components/ProfileChromeLeft';
import { SignedInChrome } from '@/components/SignedInChrome';

/**
 * `/notifications` — signed-in notifications list.
 *
 * Requires name + address + living-room rules agreement via
 * {@link OnboardingGate} `screen="welcome"`, same as `/messages`. There is no
 * `route.ts` beside this page (Next.js forbids that); notification HTTP lives
 * under `/forum/notifications`. Public forum notes stay at `/messages/[id]`.
 *
 * @returns The notifications screen.
 */
export default function NotificationsPage(): ReactElement {
  return (
    <AppShell
      mode="fill"
      align="center"
      topLeft={<ProfileChromeLeft />}
      topRight={<SignedInChrome />}
    >
      <OnboardingGate screen="welcome">
        <Suspense>
          <NotificationsLoader />
        </Suspense>
      </OnboardingGate>
    </AppShell>
  );
}
