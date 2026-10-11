import { proxyMeWalletIntroSeenPost } from '@/lib/api-proxies';

/**
 * App Router POST for `/me/wallet-intro-seen`.
 *
 * @param request - Incoming request.
 * @returns The proxied upstream response.
 */
export const POST = proxyMeWalletIntroSeenPost;
