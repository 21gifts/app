import type { ReactElement } from 'react';
import { RulesPageChrome } from '@/components/RulesPageChrome';
import { HabitTracker } from '@/components/HabitTracker';

/**
 * Public tracker with session-aware controls and a private-to-this-area comment stream.
 *
 * @returns The page element inside the public page chrome.
 */
export default function HabitTrackerPage(): ReactElement {
  return (
    <RulesPageChrome>
      <HabitTracker />
    </RulesPageChrome>
  );
}
