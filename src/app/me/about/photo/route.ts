import { proxyMeAboutPhotoGet } from '@/lib/api-proxies';

/**
 * App Router GET for `/me/about/photo`.
 *
 * Same-origin Bearer proxy of api `GET /me/about/photo`.
 *
 * @param request - Incoming request (Bearer session).
 * @returns The proxied upstream response (raw image bytes).
 */
export const GET = proxyMeAboutPhotoGet;
