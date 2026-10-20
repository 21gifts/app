import { proxyMeWalletHeartsPost } from '@/lib/api-proxies';

/**
 * App Router POST for `/me/wallet/hearts`.
 *
 * @param request - Incoming request.
 * @returns The proxied upstream response.
 */
export const POST = proxyMeWalletHeartsPost;
