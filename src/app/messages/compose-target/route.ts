import { proxyMessagesComposeTargetGet } from '@/lib/api-proxies';

/**
 * App Router GET for `/messages/compose-target`.
 *
 * @param request - Incoming request (Bearer session).
 * @returns The proxied upstream response.
 */
export async function GET(request: Request): Promise<Response> {
  return proxyMessagesComposeTargetGet(request);
}
