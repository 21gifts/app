import type { ReactElement } from 'react';
import { Suspense } from 'react';
import { InboxLoader } from '@/components/InboxLoader';
import { OnboardingGate } from '@/components/OnboardingGate';
import { SignedInChrome } from '@/components/SignedInChrome';
import { PageChrome, Wordmark } from '@/components/ui';

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
    <PageChrome topLeft={<Wordmark href="/welcome" />} topRight={<SignedInChrome />}>
      <OnboardingGate screen="welcome">
        <Suspense>
          <InboxLoader />
        </Suspense>
      </OnboardingGate>
    </PageChrome>
  );
}
