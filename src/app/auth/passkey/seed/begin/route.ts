import { proxyAuthPasskeySeedBeginPost } from '@/lib/api-proxies';

/**
 * App Router POST for `/auth/passkey/seed/begin`.
 *
 * @param request - Incoming request.
 * @returns The proxied upstream response.
 */
export const POST = proxyAuthPasskeySeedBeginPost;
