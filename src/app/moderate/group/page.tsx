import type { ReactElement } from 'react';
import { AppShell } from '@/components/AppShell';
import { ModeratorGroupScreen } from '@/components/ModeratorGroupScreen';
import { OnboardingGate } from '@/components/OnboardingGate';
import { ProfileChromeLeft } from '@/components/ProfileChromeLeft';
import { SignedInChrome } from '@/components/SignedInChrome';

/**
 * `/moderate/group` — signed-in closed moderator group thread.
 *
 * `/moderate/group` is the group thread. The chrome back returns to the
 * previous in-app view (the card has no back control). Requires
 * name + username + living-room rules agreement via {@link OnboardingGate}
 * `screen="welcome"`. There is no `route.ts` beside this page (Next.js forbids
 * that); group HTTP lives under `/conversations/moderator-group`.
 *
 * @returns The moderator group screen.
 */
export default function ModeratorGroupPage(): ReactElement {
  return (
    <AppShell
      mode="fill"
      align="center"
      topLeft={<ProfileChromeLeft />}
      topRight={<SignedInChrome />}
    >
      <OnboardingGate screen="welcome">
        <ModeratorGroupScreen />
      </OnboardingGate>
    </AppShell>
  );
}
