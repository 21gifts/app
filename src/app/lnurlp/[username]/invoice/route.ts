import { proxyLnurlpInvoiceGet } from '@/lib/api-proxies';

/**
 * App Router GET for `/lnurlp/:username/invoice`: a payer's wallet asks for a
 * payment request to a member's in-app wallet.
 *
 * @param request - Incoming request.
 * @param context - Dynamic `username` param.
 * @returns The proxied upstream response with CORS `*`.
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ username: string }> },
): Promise<Response> {
  const { username } = await context.params;
  return proxyLnurlpInvoiceGet(request, username);
}
