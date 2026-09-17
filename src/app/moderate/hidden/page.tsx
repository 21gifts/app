import type { ReactElement } from 'react';
import { AppShell } from '@/components/AppShell';
import { HiddenNotesScreen } from '@/components/HiddenNotesScreen';
import { OnboardingGate } from '@/components/OnboardingGate';
import { ProfileChromeLeft } from '@/components/ProfileChromeLeft';
import { SignedInChrome } from '@/components/SignedInChrome';

/**
 * `/moderate/hidden` — signed-in hidden-notes list for founders and moderators.
 *
 * `/moderate` is the hub; `/moderate/hidden` is the hidden-notes list. Requires
 * name + address + living-room rules agreement via {@link OnboardingGate}
 * `screen="welcome"`. There is no `route.ts` beside this page (Next.js forbids
 * that); hidden-note HTTP lives under `/forum/messages/hidden`.
 *
 * @returns The hidden-notes screen.
 */
export default function HiddenNotesPage(): ReactElement {
  return (
    <AppShell
      mode="fill"
      align="center"
      topLeft={<ProfileChromeLeft />}
      topRight={<SignedInChrome />}
    >
      <OnboardingGate screen="welcome">
        <HiddenNotesScreen />
      </OnboardingGate>
    </AppShell>
  );
}
