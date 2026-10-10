import { proxyLnurlInvoicePost } from '@/lib/api-proxies';

/**
 * App Router POST for `/lnurl/invoice`.
 *
 * Same-origin proxy of api `POST /lnurl/invoice`.
 *
 * @param request - Incoming request (Bearer session + `{ target, amountMsat, comment? }` JSON).
 * @returns The proxied upstream response.
 */
export const POST = proxyLnurlInvoicePost;
