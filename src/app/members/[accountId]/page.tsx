import type { ReactElement } from 'react';
import { AppShell } from '@/components/AppShell';
import { MemberProfileLoader } from '@/components/MemberProfileLoader';
import { OnboardingGate } from '@/components/OnboardingGate';
import { ProfileChromeLeft } from '@/components/ProfileChromeLeft';
import { SignedInChrome } from '@/components/SignedInChrome';

/**
 * `/members/[accountId]` — signed-in member identity card and optional profile note.
 *
 * @param props - Dynamic route params (`accountId`).
 * @returns The member profile screen.
 */
export default async function MemberProfilePage({
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
      <OnboardingGate screen="profile">
        <MemberProfileLoader accountId={accountId} />
      </OnboardingGate>
    </AppShell>
  );
}
