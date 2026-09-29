import { proxyDiagnosticsPost } from '@/lib/api-proxies';

/**
 * App Router POST for `/diagnostics`.
 *
 * @param request - Incoming request.
 * @returns The proxied upstream response.
 */
export const POST = proxyDiagnosticsPost;
