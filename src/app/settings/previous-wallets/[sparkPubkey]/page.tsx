import type { ReactElement } from 'react';
import { AppShell } from '@/components/AppShell';
import { OnboardingGate } from '@/components/OnboardingGate';
import { ProfileChromeLeft } from '@/components/ProfileChromeLeft';
import { RemainingBalanceScreen } from '@/components/RemainingBalanceScreen';
import { SignedInChrome } from '@/components/SignedInChrome';

/**
 * `/settings/previous-wallets/[sparkPubkey]` — **Transfer remaining balance**:
 * the owner moves what is left in a wallet the account used before a social
 * recovery to the current wallet, and can then remove it. Opened from the
 * previous wallets on `/settings`.
 *
 * Requires name + username + living-room rules agreement via {@link OnboardingGate}
 * `screen="profile"`, like `/settings`.
 *
 * @param props - Dynamic route params (`sparkPubkey`, the previous wallet's identity key).
 * @returns The previous wallet's screen.
 */
export default async function PreviousWalletPage({
  params,
}: {
  params: Promise<{ sparkPubkey: string }>;
}): Promise<ReactElement> {
  const { sparkPubkey } = await params;
  return (
    <AppShell mode="fill" topLeft={<ProfileChromeLeft />} topRight={<SignedInChrome />}>
      <OnboardingGate screen="profile">
        <RemainingBalanceScreen sparkPubkey={sparkPubkey} />
      </OnboardingGate>
    </AppShell>
  );
}
