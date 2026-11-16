import { proxyMeWalletCounterpartiesPost } from '@/lib/api-proxies';

/**
 * App Router POST for `/me/wallet/counterparties`.
 *
 * @param request - Incoming request.
 * @returns The proxied upstream response.
 */
export const POST = proxyMeWalletCounterpartiesPost;
