import { proxyMessagesStatsGet } from '@/lib/api-proxies';

/**
 * App Router GET for `/messages/stats`.
 *
 * @param request - Incoming request.
 * @returns The proxied upstream response.
 */
export const GET = proxyMessagesStatsGet;
