'use client';

import { useEffect, useState } from 'react';
import { fetchNotifications } from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';

/**
 * Fetches the unread in-app notification count for the signed-in session.
 *
 * Calls `GET /forum/notifications` when a session exists. `refreshKey` retriggers
 * the fetch (Menu open). No session → `0`. Errors resolve to `0` without
 * throwing into the UI. Does not mark notifications read.
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
      return () => {
        cancelled = true;
      };
    }
    void (async () => {
      try {
        const list = await fetchNotifications(session);
        if (cancelled) {
          return;
        }
        setUnreadCount(list.unreadCount);
      } catch {
        if (!cancelled) {
          setUnreadCount(0);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session, refreshKey]);

  return { unreadCount };
}
