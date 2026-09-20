import { proxyMeUsernamePost } from '@/lib/api-proxies';

/**
 * App Router POST for `/me/username`.
 *
 * @param request - Incoming request.
 * @returns The proxied upstream response.
 */
export const POST = proxyMeUsernamePost;
