import { proxyMeNamePost } from '@/lib/api-proxies';

/**
 * App Router POST for `/me/name`.
 *
 * @param request - Incoming request.
 * @returns The proxied upstream response.
 */
export const POST = proxyMeNamePost;
