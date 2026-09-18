import { proxyMeNotificationLevelPost } from '@/lib/api-proxies';

/**
 * App Router POST for `/me/notification-level`.
 *
 * @param request - Incoming request.
 * @returns The proxied upstream response.
 */
export const POST = proxyMeNotificationLevelPost;
