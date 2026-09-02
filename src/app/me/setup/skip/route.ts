import { proxyMeSetupSkipPost } from '@/lib/api-proxies';

/**
 * App Router POST for `/me/setup/skip`.
 *
 * @param request - Incoming request.
 * @returns The proxied upstream response.
 */
export const POST = proxyMeSetupSkipPost;
