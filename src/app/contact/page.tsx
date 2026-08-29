import type { ReactElement } from 'react';
import { ContactLoader } from '@/components/ContactLoader';
import { OnboardingGate } from '@/components/OnboardingGate';
import { SignedInChrome } from '@/components/SignedInChrome';

/**
 * `/contact` — signed-in in-app contact (only way to reach 21.gifts).
 *
 * Requires name + address via {@link OnboardingGate} `screen="welcome"`, same
 * as `/welcome`. The same-origin proxy lives at `POST /contact/submit`.
 *
 * @returns The contact screen.
 */
export default function ContactPage(): ReactElement {
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center gap-10 px-6">
      <SignedInChrome />
      <OnboardingGate screen="welcome">
        <ContactLoader />
      </OnboardingGate>
    </main>
  );
}
