import { proxyMeFiatPost } from '@/lib/api-proxies';

/**
 * App Router POST for `/me/fiat`.
 *
 * @param request - Incoming request.
 * @returns The proxied upstream response.
 */
export const POST = proxyMeFiatPost;
