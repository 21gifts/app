import { Suspense, type ReactElement } from 'react';
import { HabitTrackerTopRight } from '@/app/habit-tracker/HabitTrackerTopRight';
import { MemberHabits } from '@/app/habit-tracker/MemberHabits';
import { AppShell } from '@/components/AppShell';
import { OnboardingGate } from '@/components/OnboardingGate';
import { ProfileChromeLeft } from '@/components/ProfileChromeLeft';

/**
 * Public habit tracker, signed-out readable.
 *
 * The auth-store read lives in {@link HabitTrackerTopRight}. This page stays
 * a server component; Suspense contains the client-side review query.
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
        <Suspense fallback={null}>
          <MemberHabits />
        </Suspense>
      </OnboardingGate>
    </AppShell>
  );
}
