import { proxyMembersCreditsGet } from '@/lib/api-proxies';

/**
 * App Router GET for `/forum/members/[accountId]/credits`.
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
  return proxyMembersCreditsGet(request, accountId);
}
