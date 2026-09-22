import { fetchConversations, fetchModeratorGroup, fetchNotifications } from '@/lib/api';
import { roleAtLeast } from '@/lib/roles';
import { loadSession } from '@/lib/session-storage';
import { useAuthStore } from '@/stores/auth-store';

type AppBadgeNavigator = Navigator & {
  setAppBadge?: (contents?: number) => Promise<void>;
  clearAppBadge?: () => Promise<void>;
};

let badgeEpoch = 0;

/**
 * Invalidate in-flight unread badge writes (e.g. after mark-all-read).
 *
 * @returns The new epoch. Callers that started a fetch before this bump must
 * not apply `setUnreadAppBadge` with a stale count.
 */
export function bumpUnreadAppBadgeEpoch(): number {
  badgeEpoch += 1;
  return badgeEpoch;
}

/**
 * Current badge epoch. Capture before an async fetch; skip the write if it
 * changed.
 *
 * @returns The current home-screen badge epoch.
 */
export function unreadAppBadgeEpoch(): number {
  return badgeEpoch;
}

/**
 * Set or clear the installed PWA home-screen unread badge via the Badging API.
 *
 * When `count` is greater than 0 and `navigator.setAppBadge` exists, sets that
 * number. Otherwise clears the badge when `navigator.clearAppBadge` exists.
 * Missing APIs are a no-op. Rejections are swallowed so badge writes never
 * throw into the UI.
 *
 * @param count - Unread in-app notification count plus inbox unread
 * conversations plus staff-room unread (`0` or `1`). Open-proposal count is
 * not included: proposal rows already sit in notification unread. Values
 * greater than 0 set the badge; zero clears it.
 */
export function setUnreadAppBadge(count: number): void {
  const nav = navigator as AppBadgeNavigator;
  if (count > 0 && typeof nav.setAppBadge === 'function') {
    void nav.setAppBadge(count).catch(() => undefined);
  } else if (typeof nav.clearAppBadge === 'function') {
    void nav.clearAppBadge().catch(() => undefined);
  }
}

/**
 * Refresh the home-screen badge to notification unread plus inbox unread plus
 * staff-room unread (`0` or `1`). Does not fetch or add open-proposal count.
 *
 * Fetches `GET /forum/notifications` and, unless `inboxUnreadOverride` is
 * passed, `GET /conversations`. Unless `moderationUnreadOverride` is passed,
 * fetches `GET /conversations/moderator-group` only when
 * `roleAtLeast(account?.role, 'moderator')` on the signed-in auth-store
 * account (`unread` true → `1`, else `0`; throw/404 → `0`). A role below
 * moderator contributes `0` without starting that request. When
 * `moderationUnreadOverride` is set, skip the fetch and use that number
 * (even for staff). Any side failing contributes `0`. Captures the badge
 * epoch at start; skips the write if it changed (callers that already know a
 * newer count should `bumpUnreadAppBadgeEpoch` first) or if `loadSession()` is
 * no longer `sessionToken`. Fetch errors are swallowed so callers can
 * fire-and-forget.
 *
 * @param sessionToken - Bearer token for the signed-in session.
 * @param inboxUnreadOverride - When set, use this inbox unread count instead of
 * fetching conversations (e.g. the local list after mark-read).
 * @param moderationUnreadOverride - When set, use this staff-room unread count
 * instead of fetching the moderator group (e.g. `0` after opening the room).
 * When omitted, still skip the fetch if the signed-in account is below
 * moderator.
 * @returns Resolves after the badge write is requested or skipped. Never
 * rejects.
 */
export async function refreshUnreadAppBadge(
  sessionToken: string,
  inboxUnreadOverride?: number,
  moderationUnreadOverride?: number,
): Promise<void> {
  const epoch = unreadAppBadgeEpoch();
  const notificationsPromise = fetchNotifications(sessionToken).then(
    (list) => list.unreadCount,
    () => 0,
  );
  const inboxPromise =
    inboxUnreadOverride !== undefined
      ? Promise.resolve(inboxUnreadOverride)
      : fetchConversations(sessionToken).then(
          (rows) => rows.filter((row) => row.unread).length,
          () => 0,
        );
  const moderationPromise =
    moderationUnreadOverride !== undefined
      ? Promise.resolve(moderationUnreadOverride)
      : roleAtLeast(useAuthStore.getState().account?.role, 'moderator')
        ? fetchModeratorGroup(sessionToken).then(
            (conversation) => (conversation.unread ? 1 : 0),
            () => 0,
          )
        : Promise.resolve(0);
  const [notificationUnread, inboxUnread, moderationUnread] = await Promise.all([
    notificationsPromise,
    inboxPromise,
    moderationPromise,
  ]);
  if (epoch !== unreadAppBadgeEpoch()) {
    return;
  }
  if (loadSession() !== sessionToken) {
    return;
  }
  setUnreadAppBadge(notificationUnread + inboxUnread + moderationUnread);
}
