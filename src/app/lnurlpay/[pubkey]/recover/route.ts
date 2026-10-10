import { proxyLnurlpayRecoverPost } from '@/lib/api-proxies';

/**
 * App Router POST for `/lnurlpay/:pubkey/recover`: the in-app wallet looks up
 * the address it registered.
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
  return proxyLnurlpayRecoverPost(request, pubkey);
}
