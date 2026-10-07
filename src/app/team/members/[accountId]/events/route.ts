import { proxyTeamMemberEventsGet } from '@/lib/api-proxies';

/**
 * App Router GET for `/team/members/[accountId]/events`.
 *
 * @param request - Incoming request (Bearer session; query string forwarded).
 * @param context - Dynamic route params (`accountId`).
 * @returns The proxied upstream response.
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ accountId: string }> },
): Promise<Response> {
  const { accountId } = await context.params;
  return proxyTeamMemberEventsGet(request, accountId);
}
