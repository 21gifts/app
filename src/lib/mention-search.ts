import { z } from 'zod';

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
 * Omits `q` when `query` is empty so the api returns the first page.
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
  return mentionSearchSchema.parse(await response.json()).accounts;
}

const accountByUsernameSchema = z.object({
  id: z.string(),
  username: z.string(),
  name: z.string(),
});

/**
 * Exact account lookup for one shop username.
 *
 * 404 is a missing account. The stored spelling is accepted as-is.
 *
 * @param sessionToken - Bearer session.
 * @param username - Username to look up.
 * @returns `found` when the account exists, or `missing` on 404.
 * @throws Error on any other status, a 200 body without string `id`, `username`, and `name`, or a fetch failure.
 */
export async function lookupAccountByUsername(
  sessionToken: string,
  username: string,
): Promise<'found' | 'missing'> {
  const response = await fetch(`/forum/accounts/by-username/${encodeURIComponent(username)}`, {
    headers: { Authorization: `Bearer ${sessionToken}` },
  });
  if (response.status === 404) {
    return 'missing';
  }
  if (response.status !== 200) {
    throw new Error(`Failed to look up account: ${String(response.status)}`);
  }
  accountByUsernameSchema.parse(await response.json());
  return 'found';
}
