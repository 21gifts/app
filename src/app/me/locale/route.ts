import { proxyMeLocalePost } from '@/lib/api-proxies';

/**
 * App Router POST for `/me/locale`.
 *
 * @param request - Incoming request.
 * @returns The proxied upstream response.
 */
export const POST = proxyMeLocalePost;
