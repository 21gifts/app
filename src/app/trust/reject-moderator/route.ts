import { proxyTrustRejectModeratorPost } from '@/lib/api-proxies';

/**
 * App Router POST for `/trust/reject-moderator`.
 *
 * @param request - Incoming request.
 * @returns The proxied upstream response.
 */
export const POST = proxyTrustRejectModeratorPost;
