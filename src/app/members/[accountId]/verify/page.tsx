import type { ReactElement } from 'react';
import { AppShell } from '@/components/AppShell';
import { MemberVerifyScreen } from '@/components/MemberVerifyScreen';
import { OnboardingGate } from '@/components/OnboardingGate';
import { ProfileChromeLeft } from '@/components/ProfileChromeLeft';
import { SignedInChrome } from '@/components/SignedInChrome';

/**
 * `/members/[accountId]/verify` — the stored-name check for a basis member.
 *
 * The chrome back returns to the previous in-app view; the card has no back
 * control. There is no `route.ts` beside this page (Next.js forbids that);
 * member HTTP stays on the existing `fetchMember` client.
 *
 * @param props - Dynamic route params (`accountId`).
 * @returns The member verify screen.
 */
export default async function MemberVerifyPage({
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
        <MemberVerifyScreen accountId={accountId} />
      </OnboardingGate>
    </AppShell>
  );
}
