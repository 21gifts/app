import { proxyWideBannerGet, proxyWideBannerPut } from '@/lib/api-proxies';

/**
 * App Router GET for `/banners/me`.
 *
 * Same-origin Bearer proxy of api `GET /banners/me`.
 *
 * @param request - Incoming request (Bearer session).
 * @returns The proxied upstream response (raw image bytes).
 */
export const GET = proxyWideBannerGet;

/**
 * App Router PUT for `/banners/me`.
 *
 * Same-origin Bearer proxy of api `PUT /banners/me`.
 *
 * @param request - Incoming request (Bearer session and JSON body).
 * @returns The proxied upstream response.
 */
export const PUT = proxyWideBannerPut;
