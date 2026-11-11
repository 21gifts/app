import { proxyWalletStatsGet } from '@/lib/api-proxies';

/**
 * App Router GET for `/wallets/stats`.
 *
 * @param request - Incoming request.
 * @returns The proxied upstream response.
 */
export const GET = proxyWalletStatsGet;
