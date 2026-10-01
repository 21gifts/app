import { proxyLnurlpayMetadataGet } from '@/lib/api-proxies';

/**
 * App Router GET for `/lnurlpay/:pubkey/metadata`: the in-app wallet reads
 * the notes payers left on received payments.
 *
 * @param request - Incoming request.
 * @param context - Dynamic `pubkey` param.
 * @returns The proxied upstream response.
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ pubkey: string }> },
): Promise<Response> {
  const { pubkey } = await context.params;
  return proxyLnurlpayMetadataGet(request, pubkey);
}
