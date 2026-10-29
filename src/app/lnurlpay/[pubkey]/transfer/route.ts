import { proxyLnurlpayTransferPost } from '@/lib/api-proxies';

/**
 * App Router POST for `/lnurlpay/:pubkey/transfer`: the new in-app wallet
 * claims the address the old wallet authorized for it.
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
  return proxyLnurlpayTransferPost(request, pubkey);
}
