'use client';

import { useEffect, useState } from 'react';
import { fetchConversations, fetchModeratorGroup, fetchNotifications } from '@/lib/api';
import { setUnreadAppBadge, unreadAppBadgeEpoch } from '@/lib/app-badge';
import { roleAtLeast } from '@/lib/roles';
import { loadSession } from '@/lib/session-storage';
import { useAuthStore } from '@/stores/auth-store';

/**
 * Fetches unread in-app notification, inbox, and staff-room counts for the
 * signed-in session.
 *
 * Calls `GET /forum/notifications` and `GET /conversations` in parallel when a
 * session exists, plus `GET /conversations/moderator-group` when
 * `roleAtLeast(account?.role, 'moderator')`. `refreshKey` retriggers the
 * fetches (Menu open). No session → all three counts `0`. A failure on one
 * side resolves that count to `0` without failing the others. A role below
 * moderator skips the staff-room fetch and contributes `0`. Does not mark
 * notifications or conversations read.
 *
 * The home-screen app badge is the **sum** of notification unread, inbox
 * unread, and staff-room unread (`0` or `1`), written once all started
 * fetches settle (success or failure). A side that was not started, or that
 * failed, contributes `0` to the sum. A hydrating store (`session` null while
 * `loadSession()` still has a token) does not clear the badge. Logout
 * (`loadSession()` null) clears it to `0`. A cancelled fetch does not update
 * React state or the badge. An epoch change after the fetches started skips
 * the badge write.
 *
 * @param refreshKey - Changing this value starts another fetch while signed in.
 * @returns Notification unread count, inbox unread count, and staff-room unread
 * count (`0` or `1`).
 */
export function useUnreadCount(refreshKey: boolean): {
  unreadCount: number;
  inboxUnreadCount: number;
  moderationUnreadCount: number;
} {
  const session = useAuthStore((state) => state.session);
  const account = useAuthStore((state) => state.account);
  const staff = roleAtLeast(account?.role, 'moderator');
  const [unreadCount, setUnreadCount] = useState(0);
  const [inboxUnreadCount, setInboxUnreadCount] = useState(0);
  const [moderationUnreadCount, setModerationUnreadCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    if (session === null) {
      setUnreadCount(0);
      setInboxUnreadCount(0);
      setModerationUnreadCount(0);
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
      const moderationPromise = staff
        ? fetchModeratorGroup(session).then(
            (conversation) => {
              const count = conversation.unread ? 1 : 0;
              if (!cancelled) {
                setModerationUnreadCount(count);
              }
              return { ok: true as const, unreadCount: count };
            },
            () => {
              if (!cancelled) {
                setModerationUnreadCount(0);
              }
              return { ok: false as const, unreadCount: 0 };
            },
          )
        : Promise.resolve().then(() => {
            if (!cancelled) {
              setModerationUnreadCount(0);
            }
            return { ok: false as const, unreadCount: 0 };
          });
      const [notifications, conversations, moderation] = await Promise.all([
        notificationsPromise,
        conversationsPromise,
        moderationPromise,
      ]);
      if (cancelled || epoch !== unreadAppBadgeEpoch()) {
        return;
      }
      setUnreadAppBadge(
        (notifications.ok ? notifications.unreadCount : 0) +
          (conversations.ok ? conversations.unreadCount : 0) +
          (moderation.ok ? moderation.unreadCount : 0),
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [session, refreshKey, staff]);

  return { unreadCount, inboxUnreadCount, moderationUnreadCount };
}
