import { proxyApiRequest } from '@/lib/api-proxy';

/**
 * GET `/habits/data` public week-history handler. Forwards the query string to the API habit-tracker route.
 *
 * @param request - Incoming request.
 * @returns The upstream habit-tracker response, or 502 if the api is unreachable.
 * @throws Does not throw.
 */
export function GET(request: Request): Promise<Response> {
  return proxyApiRequest(request, '/habit-tracker');
}

/**
 * POST `/habits/data` authenticated owner and tracker-comment handler. Forwards the authenticated body to the API habit-tracker route.
 *
 * @param request - Incoming request.
 * @returns The upstream habit-tracker response, or 502 if the api is unreachable.
 * @throws Does not throw.
 */
export function POST(request: Request): Promise<Response> {
  return proxyApiRequest(request, '/habit-tracker');
}
