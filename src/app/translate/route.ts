import { proxyTranslateGet, proxyTranslatePost } from '@/lib/translate-upstream';

/**
 * GET `/translate` availability handler.
 *
 * @returns An always-200 response describing whether translation is configured.
 * @throws Does not throw.
 */
export const GET = proxyTranslateGet;

/**
 * POST `/translate` proxy handler.
 *
 * @param request - Incoming request containing the note text and target locale.
 * @returns The translated text or a structured 400, 502, or 503 response.
 * @throws Does not throw.
 */
export const POST = proxyTranslatePost;
