import { proxyLnurlPayRequestPost } from '@/lib/api-proxies';

/**
 * App Router POST for `/lnurl/pay-request`.
 *
 * Same-origin proxy of api `POST /lnurl/pay-request`.
 *
 * @param request - Incoming request (Bearer session + `{ target }` JSON).
 * @returns The proxied upstream response.
 */
export const POST = proxyLnurlPayRequestPost;
