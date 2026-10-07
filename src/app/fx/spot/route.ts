import { proxyFxSpotGet } from '@/lib/api-proxies';

/**
 * App Router GET for `/fx/spot`.
 *
 * @param request - Incoming request.
 * @returns The proxied upstream response.
 */
export const GET = proxyFxSpotGet;
