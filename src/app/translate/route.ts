import { proxyTranslateAvailableGet, proxyTranslateNotePost } from '@/lib/api-proxies';

/**
 * GET `/translate` availability handler.
 *
 * @param request - Incoming request.
 * @returns 200 `{ available: boolean }` or 502 if the api is unreachable.
 * @throws Does not throw.
 */
export function GET(request: Request): Promise<Response> {
  return proxyTranslateAvailableGet(request);
}

/**
 * POST `/translate` proxy handler.
 *
 * @param request - Incoming request containing `{ messageId, target }`.
 * @returns `{ translatedText, cached }` or 400/404/503/502.
 * @throws Does not throw.
 */
export function POST(request: Request): Promise<Response> {
  return proxyTranslateNotePost(request);
}
