import { proxyAuthPasskeyRegisterFinishPost } from '@/lib/api-proxies';

/**
 * App Router POST for `/auth/passkey/register/finish`.
 *
 * @param request - Incoming request.
 * @returns The proxied upstream response.
 */
export const POST = proxyAuthPasskeyRegisterFinishPost;
