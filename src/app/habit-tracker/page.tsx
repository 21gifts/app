import type { ReactElement } from 'react';
import { RulesPageChrome } from '@/components/RulesPageChrome';
import { HabitTracker } from '@/components/HabitTracker';

/** Public tracker with session-aware controls and a private-to-this-area comment stream. */
export default function HabitTrackerPage(): ReactElement {
  return (
    <RulesPageChrome>
      <HabitTracker />
    </RulesPageChrome>
  );
}
