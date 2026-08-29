import type { ForumMessage } from '@/lib/api-types';

/** Client-side forum list filter / sort mode. */
export type ForumFeedMode = 'active' | 'all' | 'popular';

/** Default feed mode on the welcome forum (paid notes, newest-first). */
export const DEFAULT_FORUM_FEED_MODE: ForumFeedMode = 'active';

/** Selector button order: Active, All, Most popular. */
export const FORUM_FEED_MODES: readonly ForumFeedMode[] = ['active', 'all', 'popular'];

/**
 * Filters and sorts a loaded forum thread for the selected feed mode.
 *
 * Ranking is among the already-loaded messages only. Does not mutate `messages`.
 *
 * @param messages - Newest-first list from the api / loader merge.
 * @param mode - Active (paid, newest-first), All (unchanged), or Most popular (paid, sats desc).
 * @returns A new array of visible messages for the mode.
 */
export function visibleForumMessages(
  messages: readonly ForumMessage[],
  mode: ForumFeedMode,
): ForumMessage[] {
  if (mode === 'all') {
    return [...messages];
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
