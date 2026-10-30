import { proxyAuthPasskeyRecoveryFinishPost } from '@/lib/api-proxies';

/**
 * App Router POST for `/auth/passkey/recovery/finish`.
 *
 * @param request - Incoming request.
 * @returns The proxied upstream response.
 */
export const POST = proxyAuthPasskeyRecoveryFinishPost;
