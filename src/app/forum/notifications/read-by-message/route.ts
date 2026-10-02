import { proxyNotificationsReadByMessagePost } from '@/lib/api-proxies';

/**
 * App Router POST for `/forum/notifications/read-by-message`.
 *
 * Same-origin Bearer proxy of api POST `/notifications/read-by-message`.
 *
 * @param request - Incoming request (Bearer session).
 * @returns The proxied upstream response.
 */
export const POST = proxyNotificationsReadByMessagePost;
