'use client';

import { useEffect, useState } from 'react';
import {
  fetchConversations,
  fetchModeratorGroup,
  fetchNotifications,
  fetchTrustProposals,
} from '@/lib/api';
import { setUnreadAppBadge, unreadAppBadgeEpoch } from '@/lib/app-badge';
import { roleAtLeast } from '@/lib/roles';
import { loadSession } from '@/lib/session-storage';
import { useAuthStore } from '@/stores/auth-store';

/**
 * Fetches unread in-app notification, inbox, staff-room, and open-proposal
 * counts for the signed-in session.
 *
 * Calls `GET /forum/notifications` and `GET /conversations` in parallel when a
 * session exists, plus `GET /conversations/moderator-group` and
 * `GET /trust/proposals` when `roleAtLeast(account?.role, 'moderator')`.
 * `refreshKey` retriggers the fetches (Menu open). No session → all counts
 * `0`. A failure on one side resolves that count to `0` without failing the
 * others. A role below moderator skips the staff-room and proposals fetches
 * and contributes `0`. Does not mark notifications or conversations read.
 *
 * `moderationUnreadCount` is staff-room unread (`0` or `1`) plus
 * `proposalCount`, for the Menu Moderation row. Hub Open proposals uses
 * `proposalCount` alone.
 *
 * The home-screen app badge is the **sum** of notification unread, inbox
 * unread, and staff-room unread (`0` or `1`), written once all started
 * fetches settle (success or failure), unless `options.writeBadge` is
 * `false`. Open-proposal count is **not** added: proposal rows already sit
 * in notification unread. A side that was not started, or that failed,
 * contributes `0` to the sum. A hydrating store (`session` null while
 * `loadSession()` still has a token) does not clear the badge. Logout
 * (`loadSession()` null) clears it to `0` when badge writes are enabled.
 * `writeBadge: false` still fetches and returns the counts but never calls
 * `setUnreadAppBadge`, including that logout / session-null `0` write. A
 * cancelled fetch does not update React state or the badge. An epoch change
 * after the fetches started skips the badge write.
 *
 * @param refreshKey - Changing this value starts another fetch while signed in.
 * @param options - Optional. Omit to keep the default badge write. When
 * `writeBadge` is `false`, still fetches and returns the counts but never
 * writes the home-screen badge (including logout / session-null).
 * @returns Notification unread count, inbox unread count, Menu moderation
 * count (staff-room plus open proposals), and open-proposal count.
 */
export function useUnreadCount(
  refreshKey: boolean,
  options?: { writeBadge?: boolean },
): {
  unreadCount: number;
  inboxUnreadCount: number;
  moderationUnreadCount: number;
  proposalCount: number;
} {
  const session = useAuthStore((state) => state.session);
  const account = useAuthStore((state) => state.account);
  const staff = roleAtLeast(account?.role, 'moderator');
  const writeBadge = options?.writeBadge !== false;
  const [unreadCount, setUnreadCount] = useState(0);
  const [inboxUnreadCount, setInboxUnreadCount] = useState(0);
  const [staffRoomUnread, setStaffRoomUnread] = useState(0);
  const [proposalCount, setProposalCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    if (session === null) {
      setUnreadCount(0);
      setInboxUnreadCount(0);
      setStaffRoomUnread(0);
      setProposalCount(0);
      if (writeBadge && loadSession() === null) {
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
                setStaffRoomUnread(count);
              }
              return { ok: true as const, unreadCount: count };
            },
            () => {
              if (!cancelled) {
                setStaffRoomUnread(0);
              }
              return { ok: false as const, unreadCount: 0 };
            },
          )
        : Promise.resolve().then(() => {
            if (!cancelled) {
              setStaffRoomUnread(0);
            }
            return { ok: false as const, unreadCount: 0 };
          });
      const proposalsPromise = staff
        ? fetchTrustProposals(session).then(
            (rows) => {
              const count = rows.length;
              if (!cancelled) {
                setProposalCount(count);
              }
              return { ok: true as const, count };
            },
            () => {
              if (!cancelled) {
                setProposalCount(0);
              }
              return { ok: false as const, count: 0 };
            },
          )
        : Promise.resolve().then(() => {
            if (!cancelled) {
              setProposalCount(0);
            }
            return { ok: false as const, count: 0 };
          });
      const [notifications, conversations, moderation] = await Promise.all([
        notificationsPromise,
        conversationsPromise,
        moderationPromise,
        proposalsPromise,
      ]);
      if (cancelled || epoch !== unreadAppBadgeEpoch()) {
        return;
      }
      if (writeBadge) {
        setUnreadAppBadge(
          (notifications.ok ? notifications.unreadCount : 0) +
            (conversations.ok ? conversations.unreadCount : 0) +
            (moderation.ok ? moderation.unreadCount : 0),
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session, refreshKey, staff, writeBadge]);

  return {
    unreadCount,
    inboxUnreadCount,
    moderationUnreadCount: staffRoomUnread + proposalCount,
    proposalCount,
  };
}
