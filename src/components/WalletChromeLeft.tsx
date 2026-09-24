'use client';

import { useEffect, useState, type ReactElement } from 'react';
import { ProfileChromeLeft } from '@/components/ProfileChromeLeft';
import { WALLET_BACK_FALLBACK, walletBackHref } from '@/lib/wallet-return';

/**
 * Client `/wallet` chrome: back to the remembered in-app page, wordmark to
 * the forum.
 *
 * The first paint uses `/welcome`, matching the server (module memory is
 * per process and empty there). After mount, the href becomes the path
 * remembered in this tab. Forum fallback uses `profile.back`; any other
 * path uses `nav.back`.
 *
 * @returns {@link ProfileChromeLeft} for the current wallet return path.
 */
export function WalletChromeLeft(): ReactElement {
  const [href, setHref] = useState(WALLET_BACK_FALLBACK);
  useEffect(() => {
    setHref(walletBackHref());
  }, []);
  return (
    <ProfileChromeLeft
      backHref={href}
      backLabelKey={href === '/welcome' ? 'profile.back' : 'nav.back'}
    />
  );
}
