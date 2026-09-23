import { proxyTranslateAvailableGet, proxyTranslateNotePost } from '@/lib/api-proxies';

/**
 * GET `/translate` availability handler.
 *
 * @param request - Incoming request.
 * @returns Upstream `{ available }` (always 200 from the api).
 * @throws Does not throw.
 */
export function GET(request: Request): Promise<Response> {
  return proxyTranslateAvailableGet(request);
}

/**
 * POST `/translate` proxy handler.
 *
 * @param request - Incoming request containing `{ messageId, target }`.
 * @returns The translated text or a structured 400, 502, or 503 response.
 * @throws Does not throw.
 */
export function POST(request: Request): Promise<Response> {
  return proxyTranslateNotePost(request);
}
