import type { ReactElement } from 'react';
import { AppShell } from '@/components/AppShell';
import { FundingApplicationDetailScreen } from '@/components/FundingApplicationDetailScreen';
import { OnboardingGate } from '@/components/OnboardingGate';
import { ProfileChromeLeft } from '@/components/ProfileChromeLeft';
import { SignedInChrome } from '@/components/SignedInChrome';

/**
 * `/grants/applications/[accountId]` — signed-in staff grant-application review.
 *
 * The chrome back goes to `/grants/applications` (the card has no back
 * control). Requires name + address + living-room rules agreement via
 * {@link OnboardingGate} `screen="welcome"`. There is no `route.ts` beside
 * this page (Next.js forbids that); application HTTP lives under
 * `/funding/applications/:accountId`.
 *
 * @param props - Dynamic route params (`accountId`).
 * @returns The application-detail screen.
 */
export default async function FundingApplicationDetailPage({
  params,
}: {
  params: Promise<{ accountId: string }>;
}): Promise<ReactElement> {
  const { accountId } = await params;
  return (
    <AppShell
      mode="fill"
      align="center"
      topLeft={
        <ProfileChromeLeft
          backHref="/grants/applications"
          backLabelKey="funding.applications.heading"
        />
      }
      topRight={<SignedInChrome />}
    >
      <OnboardingGate screen="welcome">
        <FundingApplicationDetailScreen accountId={accountId} />
      </OnboardingGate>
    </AppShell>
  );
}
