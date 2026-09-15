import { proxyTrustProposeModeratorPost } from '@/lib/api-proxies';

/**
 * App Router POST for `/trust/propose-moderator`.
 *
 * @param request - Incoming request.
 * @returns The proxied upstream response.
 */
export const POST = proxyTrustProposeModeratorPost;
