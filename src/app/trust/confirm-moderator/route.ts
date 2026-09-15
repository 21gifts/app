import { proxyTrustConfirmModeratorPost } from '@/lib/api-proxies';

/**
 * App Router POST for `/trust/confirm-moderator`.
 *
 * @param request - Incoming request.
 * @returns The proxied upstream response.
 */
export const POST = proxyTrustConfirmModeratorPost;
