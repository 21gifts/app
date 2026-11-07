'use client';

import type { ReactElement } from 'react';
import Link from 'next/link';
import { ForumHomeWordmark } from '@/components/ForumHomeWordmark';
import { OnboardingGate } from '@/components/OnboardingGate';
import { ProfileChromeLeft } from '@/components/ProfileChromeLeft';
import { SignedInChrome } from '@/components/SignedInChrome';
import { useTranslations } from '@/components/LocaleProvider';
import { WelcomeScreen } from '@/components/WelcomeScreen';
import { PageChrome } from '@/components/ui';
import { useAuthStore } from '@/stores/auth-store';

function WelcomeTopLeft(): ReactElement {
  return <ProfileChromeLeft hideHistoryArrow wordmark={<ForumHomeWordmark />} />;
}

function WelcomeTopRight(): ReactElement {
  const { t } = useTranslations();
  const session = useAuthStore((state) => state.session);
  const lockedSession = useAuthStore((state) => state.lockedSession);
  // A held-back session gets the login card in the page, not a Log in link.
  if (session !== null || lockedSession !== null) {
    return <SignedInChrome />;
  }
  return (
    <Link href="/login" className="text-sm font-medium text-app-fg underline underline-offset-2">
      {t('nav.login')}
    </Link>
  );
}

/**
 * `/welcome` — shown when name, username, and living-room rules agreement are saved.
 *
 * @returns The welcome screen.
 */
export default function WelcomePage(): ReactElement {
  return (
    <PageChrome topLeft={<WelcomeTopLeft />} topRight={<WelcomeTopRight />}>
      <OnboardingGate screen="welcome" allowGuest>
        <WelcomeScreen />
      </OnboardingGate>
    </PageChrome>
  );
}
