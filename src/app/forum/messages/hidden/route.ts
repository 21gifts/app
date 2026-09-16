import { proxyMessagesHiddenGet } from '@/lib/api-proxies';

/**
 * App Router GET for `/forum/messages/hidden`.
 *
 * Same-origin Bearer proxy of api GET `/messages/hidden`.
 *
 * @param request - Incoming request (Bearer session).
 * @returns The proxied upstream response.
 */
export const GET = proxyMessagesHiddenGet;
