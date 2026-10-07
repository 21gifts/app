import { z } from 'zod';
import { logInteraction } from '@/lib/interaction-log';

const mentionSearchSchema = z.object({
  accounts: z.array(
    z.object({
      id: z.string(),
      username: z.string(),
      name: z.string(),
    }),
  ),
});

/**
 * Username suggestions for an `@` token in a forum composer.
 *
 * Omits `q` when `query` is empty so the api returns the first page. A
 * non-empty search is recorded as `search` with the term and the result count.
 *
 * @param sessionToken - Bearer session.
 * @param query - Lowercase username prefix, or `""` for the first page.
 * @returns Matching accounts, at most one page.
 * @throws Error on a non-200 status or a body that fails validation.
 */
export async function searchMentionAccounts(
  sessionToken: string,
  query: string,
): Promise<{ id: string; username: string; name: string }[]> {
  const path = query === '' ? '/forum/mentions' : `/forum/mentions?q=${encodeURIComponent(query)}`;
  const response = await fetch(path, {
    headers: { Authorization: `Bearer ${sessionToken}` },
  });
  if (!response.ok) {
    throw new Error(`Failed to search mentions: ${String(response.status)}`);
  }
  const accounts = mentionSearchSchema.parse(await response.json()).accounts;
  if (query !== '') {
    logInteraction('search', { query, results: accounts.length });
  }
  return accounts;
}
