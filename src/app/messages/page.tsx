import type { ReactElement } from 'react';
import { Suspense } from 'react';
import { AppShell } from '@/components/AppShell';
import { InboxLoader } from '@/components/InboxLoader';
import { OnboardingGate } from '@/components/OnboardingGate';
import { SignedInChrome } from '@/components/SignedInChrome';
import { Wordmark } from '@/components/ui';

/**
 * `/messages` — signed-in private-message inbox.
 *
 * Requires name + address + living-room rules agreement via
 * {@link OnboardingGate} `screen="welcome"`, same as `/contact`. Public
 * forum notes stay at `/messages/[id]`. There is no `route.ts` beside this
 * page (Next.js forbids that); conversation HTTP lives under
 * `/conversations`.
 *
 * @returns The inbox screen.
 */
export default function MessagesPage(): ReactElement {
  return (
    <AppShell
      mode="fill"
      align="center"
      topLeft={<Wordmark href="/welcome" />}
      topRight={<SignedInChrome />}
    >
      <OnboardingGate screen="welcome">
        <Suspense>
          <InboxLoader />
        </Suspense>
      </OnboardingGate>
    </AppShell>
  );
}
