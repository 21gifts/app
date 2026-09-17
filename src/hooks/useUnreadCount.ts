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
 * The home-screen app badge is the **sum** of notification unread and inbox
 * unread, written once both fetches settle (success or failure). A
 * notifications error still writes the inbox side; a conversations error still
 * writes the notifications side; either side failing contributes `0` to the
 * sum. A hydrating store (`session` null while `loadSession()` still has a
 * token) does not clear the badge. Logout (`loadSession()` null) clears it to
 * `0`. A cancelled fetch does not update React state or the badge. An epoch
 * change after the fetches started skips the badge write.
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
          if (!cancelled) {
            setUnreadCount(list.unreadCount);
          }
          return { ok: true as const, unreadCount: list.unreadCount };
        },
        () => {
          if (!cancelled) {
            setUnreadCount(0);
          }
          return { ok: false as const, unreadCount: 0 };
        },
      );
      const conversationsPromise = fetchConversations(session).then(
        (rows) => {
          const count = rows.filter((row) => row.unread).length;
          if (!cancelled) {
            setInboxUnreadCount(count);
          }
          return { ok: true as const, unreadCount: count };
        },
        () => {
          if (!cancelled) {
            setInboxUnreadCount(0);
          }
          return { ok: false as const, unreadCount: 0 };
        },
      );
      const [notifications, conversations] = await Promise.all([
        notificationsPromise,
        conversationsPromise,
      ]);
      if (cancelled || epoch !== unreadAppBadgeEpoch()) {
        return;
      }
      setUnreadAppBadge(
        (notifications.ok ? notifications.unreadCount : 0) +
          (conversations.ok ? conversations.unreadCount : 0),
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [session, refreshKey]);

  return { unreadCount, inboxUnreadCount };
}
