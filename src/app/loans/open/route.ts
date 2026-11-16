import { proxyApiRequest } from '@/lib/api-proxy';

/**
 * Same-origin proxy to the api `GET /loans/open`.
 *
 * Public. Forwards `Authorization` only when the browser sent it. Does not pay.
 * The HTML page is `/loans` (`OpenLoansPage`), not this route.
 *
 * @param request - Incoming App Router request.
 * @returns The proxied upstream response.
 */
export function GET(request: Request): Promise<Response> {
  return proxyApiRequest(request, '/loans/open');
}
