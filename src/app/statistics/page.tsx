'use client';

import type { ReactElement } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/AppShell';
import { OnboardingGate } from '@/components/OnboardingGate';
import { ProfileChromeLeft } from '@/components/ProfileChromeLeft';
import { SignedInChrome } from '@/components/SignedInChrome';
import { useTranslations } from '@/components/LocaleProvider';
import { StatisticsScreen } from '@/components/StatisticsScreen';
import { useAuthStore } from '@/stores/auth-store';

function StatisticsTopRight(): ReactElement {
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
 * `/statistics` — measured people and shop counts for every visitor, including
 * signed-out. Not a funding goal. Moderator functions stay staff-only.
 * Incomplete signed-in setup still follows the welcome gate.
 *
 * Requires name + address + living-room rules agreement via {@link OnboardingGate}
 * `screen="welcome"` when signed in. `allowGuest` lets a signed-out visitor
 * through. There is no `route.ts` beside this page (Next.js forbids
 * that). Gift-stats HTTP lives under `/gifts/stats`.
 *
 * @returns The statistics page.
 */
export default function StatisticsPage(): ReactElement {
  return (
    <AppShell
      mode="fill"
      align="center"
      topLeft={<ProfileChromeLeft />}
      topRight={<StatisticsTopRight />}
    >
      <OnboardingGate screen="welcome" allowGuest>
        <StatisticsScreen />
      </OnboardingGate>
    </AppShell>
  );
}
