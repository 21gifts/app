import { proxyGiftsStatsGet } from '@/lib/api-proxies';

/**
 * App Router GET for `/gifts/stats`.
 *
 * @param request - Incoming request.
 * @returns The proxied upstream response.
 */
export const GET = proxyGiftsStatsGet;
