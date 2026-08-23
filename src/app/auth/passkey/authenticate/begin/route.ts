import { proxyAuthPasskeyAuthenticateBeginPost } from '@/lib/api-proxies';

/**
 * App Router POST for `/auth/passkey/authenticate/begin`.
 *
 * @param request - Incoming request.
 * @returns The proxied upstream response.
 */
export const POST = proxyAuthPasskeyAuthenticateBeginPost;
