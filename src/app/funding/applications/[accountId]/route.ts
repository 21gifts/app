import { proxyFundingApplicationGet } from '@/lib/api-proxies';

/**
 * App Router GET for `/funding/applications/[accountId]`.
 *
 * Same-origin Bearer proxy of api GET `/funding/applications/:accountId`.
 *
 * @param request - Incoming request (Bearer session).
 * @param context - Dynamic route params (`accountId`).
 * @returns The proxied upstream response.
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ accountId: string }> },
): Promise<Response> {
  const { accountId } = await context.params;
  return proxyFundingApplicationGet(request, accountId);
}
