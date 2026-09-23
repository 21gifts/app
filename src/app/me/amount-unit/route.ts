import { proxyMeAmountUnitPost } from '@/lib/api-proxies';

/**
 * App Router POST for `/me/amount-unit`.
 *
 * @param request - Incoming request.
 * @returns The proxied upstream response.
 */
export const POST = proxyMeAmountUnitPost;
