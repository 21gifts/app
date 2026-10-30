import { proxyAuthPasskeyRecoveryBeginPost } from '@/lib/api-proxies';

/**
 * App Router POST for `/auth/passkey/recovery/begin`.
 *
 * @param request - Incoming request.
 * @returns The proxied upstream response.
 */
export const POST = proxyAuthPasskeyRecoveryBeginPost;
