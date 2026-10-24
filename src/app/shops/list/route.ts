import { proxyShopListGet } from '@/lib/api-proxies';

/**
 * App Router GET for `/shops/list`.
 *
 * @param request - Incoming request.
 * @returns The proxied upstream response.
 */
export const GET = proxyShopListGet;
