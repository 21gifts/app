import { proxyNotificationsReadVisiblePost } from '@/lib/api-proxies';

/**
 * App Router POST for `/forum/notifications/read-visible`.
 *
 * Same-origin Bearer proxy of api POST `/notifications/read-visible`.
 *
 * @param request - Incoming request (Bearer session).
 * @returns The proxied upstream response.
 */
export const POST = proxyNotificationsReadVisiblePost;
