import { proxyMeAboutPut } from '@/lib/api-proxies';

/**
 * App Router PUT for `/me/about`.
 *
 * @param request - Incoming request.
 * @returns The proxied upstream response.
 */
export const PUT = proxyMeAboutPut;
