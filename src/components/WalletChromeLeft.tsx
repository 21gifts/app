'use client';

import { useLayoutEffect, useState, type ReactElement } from 'react';
import { ProfileChromeLeft } from '@/components/ProfileChromeLeft';
import { WALLET_BACK_FALLBACK, walletBackHref } from '@/lib/wallet-return';

/**
 * Client `/wallet` chrome: back to the remembered in-app page, wordmark to
 * the forum.
 *
 * The server render links to `/welcome`. Before paint, the href becomes the
 * path this tab remembered (`sessionStorage` plus a `globalThis` slot, so a
 * second copy of the module still sees it). Forum fallback uses
 * `profile.back`; any other path uses `nav.back`.
 *
 * @returns {@link ProfileChromeLeft} for the current wallet return path.
 */
export function WalletChromeLeft(): ReactElement {
  const [href, setHref] = useState(WALLET_BACK_FALLBACK);
  useLayoutEffect(() => {
    setHref(walletBackHref());
  }, []);
  return (
    <ProfileChromeLeft
      backHref={href}
      backLabelKey={href === '/welcome' ? 'profile.back' : 'nav.back'}
    />
  );
}
