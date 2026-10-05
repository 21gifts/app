import { proxyApiRequest } from '@/lib/api-proxy';

/**
 * Same-origin proxy to the api `/habits`. Forwards Authorization and Time-Zone.
 * Does not pay.
 *
 * @param request - Incoming App Router request.
 * @returns The proxied upstream response.
 */
export function GET(request: Request): Promise<Response> {
  return proxyApiRequest(request, '/habits');
}

/**
 * Same-origin proxy to the api `/habits`. Forwards Authorization and Time-Zone.
 * Does not pay.
 *
 * @param request - Incoming App Router request.
 * @returns The proxied upstream response.
 */
export function POST(request: Request): Promise<Response> {
  return proxyApiRequest(request, '/habits');
}
