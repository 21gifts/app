import { proxyMePreviousWalletDelete } from '@/lib/api-proxies';

/**
 * App Router DELETE for `/me/previous-wallets/:sparkPubkey`.
 *
 * @param request - Incoming request.
 * @param context - Dynamic `sparkPubkey` param.
 * @returns The proxied upstream response.
 */
export async function DELETE(
  request: Request,
  context: { params: Promise<{ sparkPubkey: string }> },
): Promise<Response> {
  const { sparkPubkey } = await context.params;
  return proxyMePreviousWalletDelete(request, sparkPubkey);
}
