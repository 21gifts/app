import { proxyMeHeartNotificationsPost } from '@/lib/api-proxies';

/**
 * App Router POST for `/me/heart-notifications`.
 *
 * @param request - Incoming request.
 * @returns The proxied upstream response.
 */
export const POST = proxyMeHeartNotificationsPost;
