import type { ReactElement } from 'react';
import { AppShell } from '@/components/AppShell';
import { ContactLoader } from '@/components/ContactLoader';
import { OnboardingGate } from '@/components/OnboardingGate';
import { ProfileChromeLeft } from '@/components/ProfileChromeLeft';
import { SignedInChrome } from '@/components/SignedInChrome';

/**
 * `/contact` — signed-in in-app contact (only way to reach 21.gifts).
 *
 * Requires name + address + living-room rules agreement via
 * {@link OnboardingGate} `screen="welcome"`, same as `/welcome`. The
 * same-origin proxy lives at `POST /contact/submit`.
 *
 * @returns The contact screen.
 */
export default function ContactPage(): ReactElement {
  return (
    <AppShell
      mode="fill"
      align="center"
      topLeft={<ProfileChromeLeft />}
      topRight={<SignedInChrome />}
    >
      <OnboardingGate screen="welcome">
        <ContactLoader />
      </OnboardingGate>
    </AppShell>
  );
}
