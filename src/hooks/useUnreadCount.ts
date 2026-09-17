'use client';

import { useEffect, useState } from 'react';
import { fetchConversations, fetchNotifications } from '@/lib/api';
import { setUnreadAppBadge, unreadAppBadgeEpoch } from '@/lib/app-badge';
import { loadSession } from '@/lib/session-storage';
import { useAuthStore } from '@/stores/auth-store';

/**
 * Fetches unread in-app notification and inbox counts for the signed-in session.
 *
 * Calls `GET /forum/notifications` and `GET /conversations` in parallel when a
 * session exists. `refreshKey` retriggers the fetches (Menu open). No session →
 * both counts `0`. A failure on one side resolves that count to `0` without
 * failing the other. Does not mark notifications or conversations read.
 *
 * The home-screen app badge follows the **notifications** count only, via
 * `setUnreadAppBadge`. A hydrating store (`session` null while `loadSession()`
 * still has a token) does not clear the badge. Logout (`loadSession()` null)
 * and notification fetch errors clear it to `0`. A conversations error does
 * not write the badge. A cancelled fetch does not update React state or the
 * badge. An epoch change after the notifications fetch started skips the
 * badge write.
 *
 * @param refreshKey - Changing this value starts another fetch while signed in.
 * @returns Notification unread count and inbox unread count.
 */
export function useUnreadCount(refreshKey: boolean): {
  unreadCount: number;
  inboxUnreadCount: number;
} {
  const session = useAuthStore((state) => state.session);
  const [unreadCount, setUnreadCount] = useState(0);
  const [inboxUnreadCount, setInboxUnreadCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    if (session === null) {
      setUnreadCount(0);
      setInboxUnreadCount(0);
      if (loadSession() === null) {
        setUnreadAppBadge(0);
      }
      return () => {
        cancelled = true;
      };
    }
    void (async () => {
      const epoch = unreadAppBadgeEpoch();
      const notificationsPromise = fetchNotifications(session).then(
        (list) => {
          if (cancelled) {
            return;
          }
          setUnreadCount(list.unreadCount);
          if (epoch === unreadAppBadgeEpoch()) {
            setUnreadAppBadge(list.unreadCount);
          }
        },
        () => {
          if (cancelled) {
            return;
          }
          setUnreadCount(0);
          if (epoch === unreadAppBadgeEpoch()) {
            setUnreadAppBadge(0);
          }
        },
      );
      const conversationsPromise = fetchConversations(session).then(
        (rows) => {
          if (cancelled) {
            return;
          }
          setInboxUnreadCount(rows.filter((row) => row.unread).length);
        },
        () => {
          if (cancelled) {
            return;
          }
          setInboxUnreadCount(0);
        },
      );
      await Promise.all([notificationsPromise, conversationsPromise]);
    })();
    return () => {
      cancelled = true;
    };
  }, [session, refreshKey]);

  return { unreadCount, inboxUnreadCount };
}
