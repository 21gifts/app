'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { logInteraction, startInteractionLog } from '@/lib/interaction-log';
import { useAuthStore } from '@/stores/auth-store';

/** Path prefix of a member profile: `/members/<accountId>`. */
const MEMBER_PREFIX = '/members/';

/** Member profile path. */
const MEMBER_PATH = /^\/members\/[^/]+$/;

/**
 * Sends the signed-in member's interaction log while the app is open, and
 * records `screen_view` for every view (path without query), plus
 * `profile_opened` on a member profile. Nothing is recorded without a session.
 *
 * @returns `null` because the root listener has no visual surface.
 */
export function InteractionLog(): null {
  const pathname = usePathname();
  const signedIn = useAuthStore((state) => state.session !== null);
  useEffect(() => startInteractionLog(), []);
  useEffect(() => {
    if (!signedIn) {
      return;
    }
    logInteraction('screen_view');
    if (MEMBER_PATH.test(pathname)) {
      logInteraction('profile_opened', { accountId: pathname.slice(MEMBER_PREFIX.length) });
    }
  }, [pathname, signedIn]);
  return null;
}
