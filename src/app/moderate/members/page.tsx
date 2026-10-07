import type { ReactElement } from 'react';
import { AppShell } from '@/components/AppShell';
import { OnboardingGate } from '@/components/OnboardingGate';
import { ProfileChromeLeft } from '@/components/ProfileChromeLeft';
import { SignedInChrome } from '@/components/SignedInChrome';
import { TeamMemberSearchScreen } from '@/components/TeamMemberSearchScreen';

/**
 * `/moderate/members` — signed-in staff member search of the member-data area.
 *
 * This page is the search. The chrome back returns to the previous in-app
 * view (the card has no back control). Requires name + username +
 * living-room rules agreement via {@link OnboardingGate} `screen="welcome"`,
 * same as `/moderate`. JSON lives under `/team/members`, because Next.js
 * forbids a `route.ts` beside this page.
 *
 * @returns The member search screen.
 */
export default function TeamMembersPage(): ReactElement {
  return (
    <AppShell
      mode="fill"
      align="center"
      topLeft={<ProfileChromeLeft />}
      topRight={<SignedInChrome />}
    >
      <OnboardingGate screen="welcome">
        <TeamMemberSearchScreen />
      </OnboardingGate>
    </AppShell>
  );
}
