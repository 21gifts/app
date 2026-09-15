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
 * @param count - Unread notification count. Values greater than 0 set the badge;
 * zero clears it.
 */
export function setUnreadAppBadge(count: number): void {
  const nav = navigator as AppBadgeNavigator;
  if (count > 0 && typeof nav.setAppBadge === 'function') {
    void nav.setAppBadge(count).catch(() => undefined);
  } else if (typeof nav.clearAppBadge === 'function') {
    void nav.clearAppBadge().catch(() => undefined);
  }
}
