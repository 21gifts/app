import { proxyMeLocalePost } from '@/lib/api-proxies';

/**
 * App Router POST for `/me/locale`.
 *
 * A missing or blank bearer is 401 before the proxy, matching the api.
 *
 * @param request - Incoming request.
 * @returns 401, or the proxied upstream response.
 */
export async function POST(request: Request): Promise<Response> {
  const authorization = request.headers.get('authorization');
  if (authorization === null || !/^Bearer \S/.test(authorization)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return proxyMeLocalePost(request);
}
