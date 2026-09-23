import { proxyApiRequest } from '@/lib/api-proxy';

/**
 * App Router GET for a public payment profile.
 *
 * @param request - Incoming request.
 * @param context - Dynamic `username` param.
 * @returns The proxied payment profile response.
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ username: string }> },
): Promise<Response> {
  const { username } = await context.params;
  return proxyApiRequest(request, `/pay/${encodeURIComponent(username)}`);
}
