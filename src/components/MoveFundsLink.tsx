'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect } from 'react';
import { requestMoveFunds } from '@/lib/move-funds';

/**
 * Root listener for move-funds links: any page opened with `?move=1` (for
 * example `/wallet?move=1` from a message or an email) asks for the
 * move-funds flow with `requestMoveFunds('link')`. The request waits in this tab until
 * a signed-in screen opens the flow, so a visitor who still has to sign in
 * gets it afterwards. The flow removes the parameter once it opened.
 *
 * @returns `null` (side-effect only).
 */
export function MoveFundsLink(): null {
  const move = useSearchParams().get('move') === '1';
  useEffect(() => {
    if (move) {
      requestMoveFunds('link');
    }
  }, [move]);
  return null;
}
