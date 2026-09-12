import { proxyNotificationsReadAllPost } from '@/lib/api-proxies';

/**
 * App Router POST for `/forum/notifications/read-all`.
 *
 * Same-origin Bearer proxy of api POST `/notifications/read-all`.
 *
 * @param request - Incoming request (Bearer session).
 * @returns The proxied upstream response.
 */
export const POST = proxyNotificationsReadAllPost;
