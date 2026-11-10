import { proxyFondPayoutsGet } from '@/lib/api-proxies';

/**
 * App Router GET for `/fond/payouts`.
 *
 * @param request - Incoming request.
 * @returns The proxied upstream response.
 */
export const GET = proxyFondPayoutsGet;
