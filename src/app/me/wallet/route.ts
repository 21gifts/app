import { proxyMeWalletPut } from '@/lib/api-proxies';

/**
 * App Router PUT for `/me/wallet`.
 *
 * @param request - Incoming request.
 * @returns The proxied upstream response.
 */
export const PUT = proxyMeWalletPut;
