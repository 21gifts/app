import { proxyPosDelete, proxyPosGet, proxyPosPost } from '@/lib/api-proxies';

/**
 * Same-origin proxy of api `GET /pos`, `POST /pos`, and `DELETE /pos`.
 * The page lives at `/pos`.
 */

/**
 * App Router GET for `/pos/charge`.
 *
 * @param request - Incoming request.
 * @returns The proxied upstream response.
 */
export const GET = proxyPosGet;

/**
 * App Router POST for `/pos/charge`.
 *
 * @param request - Incoming request.
 * @returns The proxied upstream response.
 */
export const POST = proxyPosPost;

/**
 * App Router DELETE for `/pos/charge`.
 *
 * @param request - Incoming request.
 * @returns The proxied upstream response.
 */
export const DELETE = proxyPosDelete;
