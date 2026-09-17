import { proxyModeratorGroupGet } from '@/lib/api-proxies';

/**
 * App Router GET for `/conversations/moderator-group`.
 *
 * Same-origin Bearer proxy of api GET `/conversations/moderator-group`.
 *
 * @param request - Incoming request (Bearer session).
 * @returns The proxied upstream response.
 */
export const GET = proxyModeratorGroupGet;
