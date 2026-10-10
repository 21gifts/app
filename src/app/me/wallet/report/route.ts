import { proxyMeWalletReportPost } from '@/lib/api-proxies';

/**
 * App Router POST for `/me/wallet/report`.
 *
 * @param request - Incoming request.
 * @returns The proxied upstream response.
 */
export const POST = proxyMeWalletReportPost;
