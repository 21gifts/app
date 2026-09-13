import { proxyMeLocationPost } from '@/lib/api-proxies';

/**
 * App Router POST for `/me/location`.
 *
 * @param request - Incoming request.
 * @returns The proxied upstream response.
 */
export const POST = proxyMeLocationPost;
