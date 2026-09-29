import { proxyForumMentionsGet } from '@/lib/api-proxies';

/**
 * App Router GET for `/forum/mentions`.
 *
 * Same-origin Bearer proxy of api GET `/mentions` (username prefix suggestions).
 *
 * @param request - Incoming request (Bearer session, optional `q`).
 * @returns The proxied upstream response.
 */
export const GET = proxyForumMentionsGet;
