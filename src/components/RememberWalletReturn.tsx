'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, type ReactElement } from 'react';
import { rememberWalletReturn } from '@/lib/wallet-return';

/**
 * Records the current in-app path so `/wallet` back can return here.
 *
 * Wallet itself is ignored by {@link rememberWalletReturn}, so a visit to
 * `/wallet` does not overwrite the page the member came from.
 *
 * @returns `null` (side-effect only).
 */
export function RememberWalletReturn(): ReactElement | null {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const query = searchParams.toString();

  useEffect(() => {
    rememberWalletReturn(query === '' ? pathname : `${pathname}?${query}`);
  }, [pathname, query]);

  return null;
}
