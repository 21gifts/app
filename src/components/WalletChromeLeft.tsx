'use client';

import { useLayoutEffect, useState, type ReactElement } from 'react';
import { ProfileChromeLeft } from '@/components/ProfileChromeLeft';
import { WALLET_BACK_FALLBACK, walletBackHref } from '@/lib/wallet-return';

/**
 * Page `/wallet` chrome, shown only until the card registers its own Back.
 *
 * A plain click takes one history step (`history.back()`), or opens the
 * forum when this tab has no previous page. The href is the remembered path
 * for a modified click. The wordmark opens the forum.
 *
 * @returns {@link ProfileChromeLeft} for the page-level wallet Back.
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
      onBackClick={() => {
        if (window.history.length > 1) {
          window.history.back();
          return;
        }
        window.location.assign(WALLET_BACK_FALLBACK);
      }}
    />
  );
}
