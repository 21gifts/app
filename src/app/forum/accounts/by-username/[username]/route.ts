import { proxyForumAccountByUsernameGet } from '@/lib/api-proxies';

/**
 * GET /forum/accounts/by-username/[username], the exact account lookup.
 *
 * @param request - Incoming Bearer request.
 * @param context - Dynamic username.
 * @returns The upstream account response.
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ username: string }> },
): Promise<Response> {
  const { username } = await context.params;
  return proxyForumAccountByUsernameGet(request, username);
}
