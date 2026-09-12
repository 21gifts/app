import { proxyTrustAppointModeratorPost } from '@/lib/api-proxies';

/**
 * App Router POST for `/trust/appoint-moderator`.
 *
 * @param request - Incoming request.
 * @returns The proxied upstream response.
 */
export const POST = proxyTrustAppointModeratorPost;
