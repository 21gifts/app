import type { ReactElement } from 'react';
import { AppShell } from '@/components/AppShell';
import { ModerateScreen } from '@/components/ModerateScreen';
import { OnboardingGate } from '@/components/OnboardingGate';
import { ProfileChromeLeft } from '@/components/ProfileChromeLeft';
import { SignedInChrome } from '@/components/SignedInChrome';

/**
 * `/moderate` — signed-in moderation hub for moderators.
 *
 * `/moderate` is the hub; `/moderate/hidden` is the hidden-notes list. Requires
 * name + address + living-room rules agreement via {@link OnboardingGate}
 * `screen="welcome"`. There is no `route.ts` beside this page (Next.js forbids
 * that); hidden-note HTTP lives under `/forum/messages/hidden`.
 *
 * @returns The moderation hub.
 */
export default function ModeratePage(): ReactElement {
  return (
    <AppShell
      mode="fill"
      align="center"
      topLeft={<ProfileChromeLeft />}
      topRight={<SignedInChrome />}
    >
      <OnboardingGate screen="welcome">
        <ModerateScreen />
      </OnboardingGate>
    </AppShell>
  );
}
