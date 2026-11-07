import { proxyLnurlpayRegisterPost } from '@/lib/api-proxies';

/**
 * App Router POST for `/lnurlpay/:pubkey`: the in-app wallet registers the
 * member's address on the app's own host.
 *
 * @param request - Incoming request.
 * @param context - Dynamic `pubkey` param.
 * @returns The proxied upstream response.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ pubkey: string }> },
): Promise<Response> {
  const { pubkey } = await context.params;
  return proxyLnurlpayRegisterPost(request, pubkey);
}
