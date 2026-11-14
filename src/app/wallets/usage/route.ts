import { proxyWalletUsageGet } from '@/lib/api-proxies';

/**
 * App Router GET for `/wallets/usage`.
 *
 * @param request - Incoming request.
 * @returns The proxied upstream response.
 */
export const GET = proxyWalletUsageGet;
