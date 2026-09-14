import type { ForumMessage } from '@/lib/api-types';

/** Client-side forum list filter / sort mode. */
export type ForumFeedMode = 'active' | 'unpaid' | 'all' | 'popular';

/** Default feed mode on the welcome forum (paid notes, newest-first). */
export const DEFAULT_FORUM_FEED_MODE: ForumFeedMode = 'active';

/** Window event: already-on-home chrome asked to scroll to top and apply new posts. */
export const FORUM_HOME_EVENT = '21gifts:forum-home';

/** Visible-tab poll interval for GET /forum/messages (ms). */
export const FORUM_LIST_POLL_MS = 30_000;

/** Selector button order: Active, No gifts yet, All, Most popular. */
export const FORUM_FEED_MODES: readonly ForumFeedMode[] = ['active', 'unpaid', 'all', 'popular'];

/**
 * Checks whether a fetched forum list contains a message not present in the loaded list.
 *
 * @param current - The currently loaded forum messages, or null before the initial load. An empty array is a loaded empty feed.
 * @param fetched - The newly fetched forum messages.
 * @returns True when a loaded list (including empty) is missing at least one fetched message id. Null current is not unseen.
 */
export function hasUnseenForumPosts(
  current: readonly ForumMessage[] | null,
  fetched: readonly ForumMessage[],
): boolean {
  if (current === null) {
    return false;
  }

  const currentIds = new Set(current.map((message) => message.id));
  return fetched.some((message) => !currentIds.has(message.id));
}

/**
 * Filters and sorts a loaded forum thread for the selected feed mode.
 *
 * Ranking is among the already-loaded messages only. Does not mutate `messages`.
 *
 * @param messages - Newest-first list from the api / loader merge.
 * @param mode - Active (paid, newest-first), No gifts yet (zero sats), All (unchanged), or Most popular (paid, sats desc).
 * @returns A new array of visible messages for the mode.
 */
export function visibleForumMessages(
  messages: readonly ForumMessage[],
  mode: ForumFeedMode,
): ForumMessage[] {
  if (mode === 'all') {
    return [...messages];
  }

  if (mode === 'unpaid') {
    return messages.filter((message) => message.sats === 0);
  }

  const paid = messages.filter((message) => message.sats > 0);

  if (mode === 'active') {
    return paid;
  }

  return [...paid].sort((a, b) => {
    if (b.sats !== a.sats) {
      return b.sats - a.sats;
    }
    if (a.createdAt !== b.createdAt) {
      return b.createdAt.localeCompare(a.createdAt);
    }
    return b.id.localeCompare(a.id);
  });
}

/**
 * Counts loaded zero-sat notes created after the visitor last opened No gifts yet.
 *
 * Pure: no I/O and does not mutate `messages`. A missing or invalid `seenAt`
 * is a first visit and returns `0` even when unpaid notes exist.
 *
 * @param messages - Newest-first list from the api / loader merge.
 * @param seenAt - ISO last-visit stamp, or `null` when never opened.
 * @returns How many currently loaded unpaid notes are strictly newer than `seenAt`.
 */
export function unpaidNewCount(messages: readonly ForumMessage[], seenAt: string | null): number {
  if (seenAt === null) {
    return 0;
  }
  const seenMs = Date.parse(seenAt);
  if (!Number.isFinite(seenMs)) {
    return 0;
  }

  let count = 0;
  for (const message of messages) {
    if (message.sats !== 0) {
      continue;
    }
    const createdMs = Date.parse(message.createdAt);
    if (!Number.isFinite(createdMs)) {
      continue;
    }
    if (createdMs > seenMs) {
      count += 1;
    }
  }
  return count;
}
