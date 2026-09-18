'use client';

import { useSearchParams } from 'next/navigation';
import { type ReactElement } from 'react';
import { ProfileChromeLeft } from '@/components/ProfileChromeLeft';

/**
 * Client `/messages` chrome: forum back on the list, All conversations on an
 * open thread.
 *
 * Reads `?c=`. A non-empty `c` is an open thread; missing or empty `c` is the
 * list.
 *
 * @returns {@link ProfileChromeLeft} for the current inbox view.
 */
export function MessagesChromeLeft(): ReactElement {
  const searchParams = useSearchParams();
  const openId = searchParams.get('c');
  if (openId !== null && openId !== '') {
    return <ProfileChromeLeft backHref="/messages" backLabelKey="inbox.back" />;
  }
  return <ProfileChromeLeft />;
}
