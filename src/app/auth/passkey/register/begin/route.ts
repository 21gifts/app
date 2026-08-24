import { proxyAuthPasskeyRegisterBeginPost } from '@/lib/api-proxies';

/**
 * App Router POST for `/auth/passkey/register/begin`.
 *
 * @param request - Incoming request.
 * @returns The proxied upstream response.
 */
export const POST = proxyAuthPasskeyRegisterBeginPost;
