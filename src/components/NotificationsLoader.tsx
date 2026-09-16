'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, type ReactElement } from 'react';
import { NotificationsScreen } from '@/components/NotificationsScreen';
import { fetchNotifications, markAllNotificationsRead, markNotificationRead } from '@/lib/api';
import { bumpUnreadAppBadgeEpoch, setUnreadAppBadge } from '@/lib/app-badge';
import type { Notification } from '@/lib/api-types';
import { useAuthStore } from '@/stores/auth-store';

/**
 * Client loader for the signed-in notifications list on `/notifications`.
 *
 * Reads the session from the auth store and fetches notifications (posts, replies,
 * payments, and moderator appointment). After a successful list fetch, marks all
 * as read fire-and-forget and clears the home-screen badge (`setUnreadAppBadge(0)`).
 * Renders nothing when there is no session. There is no composer; opening a
 * `moderator_appointed` row goes to `/welcome`, and any other row goes to the
 * public forum note.
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
        setUnreadAppBadge(0);
        void markAllNotificationsRead(session)
          .then(() => {
            if (useAuthStore.getState().session !== session) {
              return;
            }
            bumpUnreadAppBadgeEpoch();
            setUnreadAppBadge(0);
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
        void markNotificationRead(session, row.id).catch(() => undefined);
        router.push(row.type === 'moderator_appointed' ? '/welcome' : '/messages/' + row.parentId);
      }}
    />
  );
}
