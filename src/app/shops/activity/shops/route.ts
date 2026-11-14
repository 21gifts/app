import { proxyShopActivityShopsGet } from '@/lib/api-proxies';

/**
 * App Router GET for `/shops/activity/shops`.
 *
 * Same-origin Bearer proxy of api GET `/shops/activity/shops`. The HTML table
 * lives at `/moderate/shops`.
 *
 * @param request - Incoming request (Bearer session).
 * @returns The proxied upstream response.
 */
export const GET = proxyShopActivityShopsGet;
