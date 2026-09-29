'use client';

import { type ReactElement } from 'react';
import { ProfileChromeLeft } from '@/components/ProfileChromeLeft';

/**
 * Page `/wallet` chrome, shown only until the card registers its own Back.
 *
 * The arrow returns to the previous in-app view, or `/welcome` when this tab
 * has none. The wordmark opens the forum.
 *
 * @returns {@link ProfileChromeLeft} for the page-level wallet Back.
 */
export function WalletChromeLeft(): ReactElement {
  return <ProfileChromeLeft />;
}
