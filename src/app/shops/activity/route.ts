import { proxyShopActivityGet } from '@/lib/api-proxies';

/**
 * App Router GET for `/shops/activity`.
 *
 * @param request - Incoming request.
 * @returns The proxied upstream response.
 */
export const GET = proxyShopActivityGet;
