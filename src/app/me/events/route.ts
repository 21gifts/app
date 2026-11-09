import { proxyMeEventsPost } from '@/lib/api-proxies';

/**
 * App Router POST for `/me/events`.
 *
 * @param request - Incoming request.
 * @returns The proxied upstream response.
 */
export const POST = proxyMeEventsPost;
