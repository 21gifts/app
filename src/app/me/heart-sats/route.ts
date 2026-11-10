import { proxyMeHeartSatsPost } from '@/lib/api-proxies';

/**
 * App Router POST for `/me/heart-sats`.
 *
 * @param request - Incoming request.
 * @returns The proxied upstream response.
 */
export const POST = proxyMeHeartSatsPost;
