import { proxyMePasskeyRenewAckPost } from '@/lib/api-proxies';

/**
 * App Router POST for `/me/passkey-renew/ack`.
 *
 * @param request - Incoming request.
 * @returns The proxied upstream response.
 */
export const POST = proxyMePasskeyRenewAckPost;
