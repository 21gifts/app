import { proxyMePasskeyRenewReportPost } from '@/lib/api-proxies';

/**
 * App Router POST for `/me/passkey-renew/report`.
 *
 * @param request - Incoming request.
 * @returns The proxied upstream response.
 */
export const POST = proxyMePasskeyRenewReportPost;
