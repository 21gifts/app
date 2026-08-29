import { proxyMeForumLawsDismissedPost } from '@/lib/api-proxies';

/**
 * App Router POST for `/me/forum-laws-dismissed`.
 *
 * @param request - Incoming request.
 * @returns The proxied upstream response.
 */
export const POST = proxyMeForumLawsDismissedPost;
