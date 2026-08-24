import { proxyGiftsGet } from '@/lib/api-proxies';

/**
 * App Router GET for `/gifts`.
 *
 * @param request - Incoming request (`day` query).
 * @returns The proxied upstream response.
 */
export const GET = proxyGiftsGet;
