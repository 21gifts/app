import { proxyAuthPasskeySeedFinishPost } from '@/lib/api-proxies';

/**
 * App Router POST for `/auth/passkey/seed/finish`.
 *
 * @param request - Incoming request.
 * @returns The proxied upstream response.
 */
export const POST = proxyAuthPasskeySeedFinishPost;
