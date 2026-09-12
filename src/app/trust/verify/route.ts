import { proxyTrustVerifyPost } from '@/lib/api-proxies';

/**
 * App Router POST for `/trust/verify`.
 *
 * @param request - Incoming request.
 * @returns The proxied upstream response.
 */
export const POST = proxyTrustVerifyPost;
