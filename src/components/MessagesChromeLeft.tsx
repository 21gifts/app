'use client';

import { type ReactElement } from 'react';
import { ProfileChromeLeft } from '@/components/ProfileChromeLeft';

/**
 * Client `/messages` chrome. Always the shared previous-view arrow; the stack
 * records the list then the open thread, so a thread opened from the list
 * returns there. A thread opened from somewhere else returns there.
 *
 * @returns {@link ProfileChromeLeft} for the inbox chrome.
 */
export function MessagesChromeLeft(): ReactElement {
  return <ProfileChromeLeft />;
}
