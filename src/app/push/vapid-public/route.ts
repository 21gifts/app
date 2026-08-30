import { proxyPushVapidPublicGet } from '@/lib/api-proxies';

/**
 * App Router GET for `/push/vapid-public`.
 *
 * @param request - Incoming request.
 * @returns The proxied upstream response.
 */
export const GET = proxyPushVapidPublicGet;
