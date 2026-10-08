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
import { closeLocalPushNotifications, pushTagForNotification } from '@/lib/push';
import { roleAtLeast } from '@/lib/roles';
import { loadSession } from '@/lib/session-storage';
import type { Notification } from '@/lib/api-types';
import { useAuthStore } from '@/stores/auth-store';

/**
 * Set the home-screen badge to remaining unread: inbox unread plus staff-room
 * unread (`0` or `1`) after notifications became 0 (list viewed /
 * mark-all-read).
 *
 * Captures the badge epoch at start and skips the write if it changed or
 * `loadSession()` is not still `sessionToken`, after the started fetches
 * settle. Fetches `GET /conversations/moderator-group` only when
 * `roleAtLeast(account?.role, 'moderator')`; a role below moderator
 * contributes `0` without starting that request. A side that fails
 * contributes 0.
 *
 * @param sessionToken - Bearer token for the signed-in session.
 */
async function setHomeScreenBadgeToRemainingUnread(sessionToken: string): Promise<void> {
  const epoch = unreadAppBadgeEpoch();
  const inboxPromise = fetchConversations(sessionToken).then(
    (rows) => rows.filter((row) => row.unread).length,
    () => 0,
  );
  const moderationPromise = roleAtLeast(useAuthStore.getState().account?.role, 'moderator')
    ? fetchModeratorGroup(sessionToken).then(
        (conversation) => (conversation.unread ? 1 : 0),
        () => 0,
      )
    : Promise.resolve(0);
  const [inboxCount, moderationCount] = await Promise.all([inboxPromise, moderationPromise]);
  if (epoch !== unreadAppBadgeEpoch() || loadSession() !== sessionToken) {
    return;
  }
  setUnreadAppBadge(inboxCount + moderationCount);
}

/**
 * Where a notification row opens. Replies and mentions open the message that
 * triggered them. Posts, zaps, and hearts open the forum note, not a receipt id.
 *
 * @param row - One notification from the list.
 * @returns An in-app path.
 */
function notificationOpenPath(row: Notification): string {
  if (row.type === 'moderator_proposal') {
    return '/moderate/proposals';
  }
  if (row.type === 'moderator_appointed') {
    return '/welcome';
  }
  const id =
    row.type === 'forum_reply' || row.type === 'forum_mention' ? row.replyId : row.parentId;
  return `/messages/${encodeURIComponent(id)}`;
}

/**
 * Client loader for the signed-in notifications list on `/notifications`.
 *
 * Reads the session from the auth store and fetches notifications (posts, replies,
 * payments, hearts, moderator appointment, and moderator proposal). After a successful
 * list fetch, marks all as read fire-and-forget and refreshes the home-screen
 * badge to remaining inbox unread plus staff-room unread (`0` or `1`;
 * notifications are treated as 0; visiting this screen does not force the badge
 * to 0 when inbox or staff-room unread remains). Fetches the staff room only when
 * `roleAtLeast(account?.role, 'moderator')`; below moderator the remaining
 * badge is inbox unread only. Renders nothing when there is no
 * session. The list keeps every fetched row, including those with `readAt` set. There is no
 * composer; opening a `moderator_proposal` row goes to `/moderate/proposals`
 * and does not call `markNotificationRead`; opening a `moderator_appointed`
 * row waits for `markNotificationRead` (then still goes to `/welcome` if that
 * POST fails, and skips navigation if the session changed). A `forum_reply`
 * or `forum_mention` opens `/messages/{replyId}` without waiting. A
 * `forum_post`, `zap`, or `heart` opens `/messages/{parentId}` without waiting. Ids are
 * URI-encoded. Opening a non-proposal row also closes the matching local
 * Web Push notification without waiting for the POST.
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
        const dest = notificationOpenPath(row);
        if (row.type === 'moderator_proposal') {
          router.push(dest);
          return;
        }
        const tag = pushTagForNotification(row);
        if (tag !== null) {
          void closeLocalPushNotifications([tag]);
        }
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
