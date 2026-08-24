import { proxyAuthPasskeyAuthenticateFinishPost } from '@/lib/api-proxies';

/**
 * App Router POST for `/auth/passkey/authenticate/finish`.
 *
 * @param request - Incoming request.
 * @returns The proxied upstream response.
 */
export const POST = proxyAuthPasskeyAuthenticateFinishPost;
