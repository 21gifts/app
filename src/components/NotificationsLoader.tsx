'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, type ReactElement } from 'react';
import { NotificationsScreen } from '@/components/NotificationsScreen';
import {
  fetchConversations,
  fetchModeratorGroup,
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '@/lib/api';
import { bumpUnreadAppBadgeEpoch, setUnreadAppBadge, unreadAppBadgeEpoch } from '@/lib/app-badge';
import { loadSession } from '@/lib/session-storage';
import type { Notification } from '@/lib/api-types';
import { useAuthStore } from '@/stores/auth-store';

/**
 * Set the home-screen badge to remaining unread: inbox unread plus staff-room
 * unread (`0` or `1`) after notifications became 0 (list viewed /
 * mark-all-read).
 *
 * Captures the badge epoch at start and skips the write if it changed or
 * `loadSession()` is not still `sessionToken`, after both fetches settle. A
 * side that fails contributes 0.
 *
 * @param sessionToken - Bearer token for the signed-in session.
 */
async function setHomeScreenBadgeToRemainingUnread(sessionToken: string): Promise<void> {
  const epoch = unreadAppBadgeEpoch();
  const inboxPromise = fetchConversations(sessionToken).then(
    (rows) => rows.filter((row) => row.unread).length,
    () => 0,
  );
  const moderationPromise = fetchModeratorGroup(sessionToken).then(
    (conversation) => (conversation.unread ? 1 : 0),
    () => 0,
  );
  const [inboxCount, moderationCount] = await Promise.all([inboxPromise, moderationPromise]);
  if (epoch !== unreadAppBadgeEpoch() || loadSession() !== sessionToken) {
    return;
  }
  setUnreadAppBadge(inboxCount + moderationCount);
}

/**
 * Client loader for the signed-in notifications list on `/notifications`.
 *
 * Reads the session from the auth store and fetches notifications (posts, replies,
 * payments, and moderator appointment). After a successful list fetch, marks all
 * as read fire-and-forget and refreshes the home-screen badge to remaining inbox
 * unread plus staff-room unread (`0` or `1`; notifications are treated as 0;
 * visiting this screen does not force the badge to 0 when inbox or staff-room
 * unread remains). Renders nothing when there is no
 * session. There is no composer; opening a `moderator_appointed` row waits for
 * `markNotificationRead` (then still goes to `/welcome` if that POST fails, and
 * skips navigation if the session changed), and any other row goes to the public
 * forum note without waiting.
 *
 * @returns The notifications screen, or `null` without a session.
 */
export function NotificationsLoader(): ReactElement | null {
  const session = useAuthStore((state) => state.session);
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[] | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (session === null) {
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(false);
    void (async () => {
      try {
        const next = await fetchNotifications(session);
        if (cancelled) {
          return;
        }
        setNotifications(next.notifications);
        bumpUnreadAppBadgeEpoch();
        void setHomeScreenBadgeToRemainingUnread(session);
        void markAllNotificationsRead(session)
          .then(() => {
            if (useAuthStore.getState().session !== session) {
              return;
            }
            bumpUnreadAppBadgeEpoch();
            void setHomeScreenBadgeToRemainingUnread(session);
          })
          .catch(() => undefined);
      } catch {
        if (cancelled) {
          return;
        }
        setNotifications(null);
        setError(true);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session, attempt]);

  if (session === null) {
    return null;
  }

  return (
    <NotificationsScreen
      notifications={notifications}
      error={error}
      loading={loading}
      onRetry={() => {
        setAttempt((n) => n + 1);
      }}
      onOpen={(row) => {
        const dest = row.type === 'moderator_appointed' ? '/welcome' : '/messages/' + row.parentId;
        if (row.type !== 'moderator_appointed') {
          void markNotificationRead(session, row.id).catch(() => undefined);
          router.push(dest);
          return;
        }
        void markNotificationRead(session, row.id)
          .catch(() => undefined)
          .then(() => {
            if (useAuthStore.getState().session !== session) {
              return;
            }
            router.push(dest);
          });
      }}
    />
  );
}
