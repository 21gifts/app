import { proxyPosDelete, proxyPosGet, proxyPosPost } from '@/lib/api-proxies';

/**
 * Same-origin proxy of api `GET /pos`, `POST /pos`, and `DELETE /pos`.
 * The page lives at `/pos`.
 */

/** @param request - Incoming request. @returns Proxied response. */
export const GET = proxyPosGet;

/** @param request - Incoming request. @returns Proxied response. */
export const POST = proxyPosPost;

/** @param request - Incoming request. @returns Proxied response. */
export const DELETE = proxyPosDelete;
