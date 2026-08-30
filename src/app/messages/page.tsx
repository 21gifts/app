import type { ReactElement } from 'react';
import { Suspense } from 'react';
import { InboxLoader } from '@/components/InboxLoader';
import { OnboardingGate } from '@/components/OnboardingGate';
import { SignedInChrome } from '@/components/SignedInChrome';

/**
 * `/messages` — signed-in private-message inbox (intern #11).
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
    <main className="relative flex min-h-screen flex-col items-center justify-center gap-10 px-6">
      <SignedInChrome />
      <OnboardingGate screen="welcome">
        <Suspense>
          <InboxLoader />
        </Suspense>
      </OnboardingGate>
    </main>
  );
}
