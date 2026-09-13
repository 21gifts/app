import { proxyMembersRepliesGet } from '@/lib/api-proxies';

/**
 * App Router GET for `/forum/members/[accountId]/replies`.
 *
 * @param request - Incoming request.
 * @param context - Dynamic route params (`accountId`).
 * @returns The proxied upstream response.
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ accountId: string }> },
): Promise<Response> {
  const { accountId } = await context.params;
  return proxyMembersRepliesGet(request, accountId);
}
