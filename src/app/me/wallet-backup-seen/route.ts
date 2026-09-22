import { proxyMeWalletBackupSeenPost } from '@/lib/api-proxies';

/**
 * App Router POST for `/me/wallet-backup-seen`.
 *
 * @param request - Incoming request.
 * @returns The proxied upstream response.
 */
export const POST = proxyMeWalletBackupSeenPost;
