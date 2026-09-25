'use client';

import type { ReactElement } from 'react';
import Link from 'next/link';
import { ForumHomeWordmark } from '@/components/ForumHomeWordmark';
import { OnboardingGate } from '@/components/OnboardingGate';
import { SignedInChrome } from '@/components/SignedInChrome';
import { useTranslations } from '@/components/LocaleProvider';
import { WelcomeScreen } from '@/components/WelcomeScreen';
import { PageChrome } from '@/components/ui';
import { useAuthStore } from '@/stores/auth-store';

function WelcomeTopRight(): ReactElement {
  const { t } = useTranslations();
  const session = useAuthStore((state) => state.session);
  if (session !== null) {
    return <SignedInChrome />;
  }
  return (
    <Link href="/login" className="text-sm font-medium text-app-fg underline underline-offset-2">
      {t('nav.login')}
    </Link>
  );
}

/**
 * `/welcome` — shown when name, address, and living-room rules agreement are saved.
 *
 * @returns The welcome screen.
 */
export default function WelcomePage(): ReactElement {
  return (
    <PageChrome topLeft={<ForumHomeWordmark />} topRight={<WelcomeTopRight />}>
      <OnboardingGate screen="welcome" allowGuest>
        <WelcomeScreen />
      </OnboardingGate>
    </PageChrome>
  );
}
