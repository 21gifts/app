import { proxyMePushSubscriptionsDelete, proxyMePushSubscriptionsPost } from '@/lib/api-proxies';

/**
 * App Router POST for `/me/push-subscriptions`.
 *
 * @param request - Incoming request.
 * @returns The proxied upstream response.
 */
export const POST = proxyMePushSubscriptionsPost;

/**
 * App Router DELETE for `/me/push-subscriptions`.
 *
 * @param request - Incoming request.
 * @returns The proxied upstream response.
 */
export const DELETE = proxyMePushSubscriptionsDelete;
