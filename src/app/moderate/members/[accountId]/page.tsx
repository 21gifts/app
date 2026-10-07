import type { ReactElement } from 'react';
import { AppShell } from '@/components/AppShell';
import { OnboardingGate } from '@/components/OnboardingGate';
import { ProfileChromeLeft } from '@/components/ProfileChromeLeft';
import { SignedInChrome } from '@/components/SignedInChrome';
import { TeamMemberDataScreen } from '@/components/TeamMemberDataScreen';

/**
 * `/moderate/members/[accountId]` — signed-in staff page of one member's
 * wallet data and activity.
 *
 * The chrome back returns to the previous in-app view (the card has no back
 * control). Same onboarding gate as `/moderate`. JSON lives under
 * `/team/members/:id/wallet` and `/team/members/:id/events`.
 *
 * @param props - Dynamic route params (`accountId`).
 * @returns The member-data screen.
 */
export default async function TeamMemberDataPage({
  params,
}: {
  params: Promise<{ accountId: string }>;
}): Promise<ReactElement> {
  const { accountId } = await params;
  return (
    <AppShell
      mode="fill"
      align="center"
      topLeft={<ProfileChromeLeft />}
      topRight={<SignedInChrome />}
    >
      <OnboardingGate screen="welcome">
        <TeamMemberDataScreen accountId={accountId} />
      </OnboardingGate>
    </AppShell>
  );
}
