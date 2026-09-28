import { proxyProfilePhotoGet, proxyProfilePhotoPut } from '@/lib/api-proxies';

/**
 * App Router GET for `/pictures/me`.
 *
 * Same-origin Bearer proxy of api `GET /pictures/me`.
 *
 * @param request - Incoming request (Bearer session).
 * @returns The proxied upstream response (raw image bytes).
 */
export const GET = proxyProfilePhotoGet;

/**
 * App Router PUT for `/pictures/me`.
 *
 * Same-origin Bearer proxy of api `PUT /pictures/me`.
 *
 * @param request - Incoming request (Bearer session and JSON body).
 * @returns The proxied upstream response.
 */
export const PUT = proxyProfilePhotoPut;
