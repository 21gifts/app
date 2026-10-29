import { proxyMePreviousWalletsGet } from '@/lib/api-proxies';

/**
 * App Router GET for `/me/previous-wallets`.
 *
 * @param request - Incoming request.
 * @returns The proxied upstream response.
 */
export const GET = proxyMePreviousWalletsGet;
