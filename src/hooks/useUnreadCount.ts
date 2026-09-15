'use client';

import { useEffect, useState } from 'react';
import { fetchNotifications } from '@/lib/api';
import { setUnreadAppBadge, unreadAppBadgeEpoch } from '@/lib/app-badge';
import { loadSession } from '@/lib/session-storage';
import { useAuthStore } from '@/stores/auth-store';

/**
 * Fetches the unread in-app notification count for the signed-in session.
 *
 * Calls `GET /forum/notifications` when a session exists. `refreshKey` retriggers
 * the fetch (Menu open). No session → `0`. Errors resolve to `0` without
 * throwing into the UI. Does not mark notifications read. Also updates the
 * home-screen app badge via `setUnreadAppBadge` with the same number (or `0`
 * when there is no session or the fetch fails). A cancelled fetch does not
 * update state or the badge.
 *
 * @param refreshKey - Changing this value starts another fetch while signed in.
 * @returns Current unread count.
 */
export function useUnreadCount(refreshKey: boolean): { unreadCount: number } {
  const session = useAuthStore((state) => state.session);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    if (session === null) {
      setUnreadCount(0);
      if (loadSession() === null) {
        setUnreadAppBadge(0);
      }
      return () => {
        cancelled = true;
      };
    }
    void (async () => {
      const epoch = unreadAppBadgeEpoch();
      try {
        const list = await fetchNotifications(session);
        if (cancelled) {
          return;
        }
        setUnreadCount(list.unreadCount);
        if (epoch === unreadAppBadgeEpoch()) {
          setUnreadAppBadge(list.unreadCount);
        }
      } catch {
        if (!cancelled) {
          setUnreadCount(0);
          if (epoch === unreadAppBadgeEpoch()) {
            setUnreadAppBadge(0);
          }
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session, refreshKey]);

  return { unreadCount };
}
