import type { ReactElement } from 'react';
import { AppShell } from '@/components/AppShell';
import { OnboardingGate } from '@/components/OnboardingGate';
import { ProfileChromeLeft } from '@/components/ProfileChromeLeft';
import { ShopActivityShopsScreen } from '@/components/ShopActivityShopsScreen';
import { SignedInChrome } from '@/components/SignedInChrome';

/**
 * `/moderate/shops` — signed-in staff per-shop activity table.
 *
 * Same shell and gate as `/moderate/payouts`. JSON lives under
 * `/shops/activity/shops`, the api path.
 *
 * @returns The per-shop activity screen.
 */
export default function ShopActivityPage(): ReactElement {
  return (
    <AppShell
      mode="fill"
      align="center"
      topLeft={<ProfileChromeLeft />}
      topRight={<SignedInChrome />}
    >
      <OnboardingGate screen="welcome">
        <ShopActivityShopsScreen />
      </OnboardingGate>
    </AppShell>
  );
}
