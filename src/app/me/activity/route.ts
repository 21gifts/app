import { proxyMeActivityGet } from '@/lib/api-proxies';

/**
 * App Router GET for `/me/activity`.
 *
 * @param request - Incoming request.
 * @returns The proxied upstream response.
 */
export const GET = proxyMeActivityGet;
