'use client';

import type { ReactElement } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/AppShell';
import { MemberHabits } from '@/components/MemberHabits';
import { OnboardingGate } from '@/components/OnboardingGate';
import { ProfileChromeLeft } from '@/components/ProfileChromeLeft';
import { SignedInChrome } from '@/components/SignedInChrome';
import { useTranslations } from '@/components/LocaleProvider';
import { useAuthStore } from '@/stores/auth-store';

function HabitTrackerTopRight(): ReactElement {
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
 * Public habit tracker, signed-out readable.
 *
 * @returns The habit-tracker page.
 */
export default function HabitTrackerPage(): ReactElement {
  return (
    <AppShell
      mode="fill"
      align="center"
      topLeft={<ProfileChromeLeft />}
      topRight={<HabitTrackerTopRight />}
    >
      <OnboardingGate screen="welcome" allowGuest>
        <MemberHabits />
      </OnboardingGate>
    </AppShell>
  );
}
