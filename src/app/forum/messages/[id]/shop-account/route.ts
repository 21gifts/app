import { proxyMessagesShopAccountPatch } from '@/lib/api-proxies';

/**
 * PATCH /forum/messages/[id]/shop-account, forwarding the authenticated account update.
 *
 * @param request - Incoming Bearer request with JSON `{ username }`.
 * @param context - Dynamic message id.
 * @returns The upstream public message JSON, or an error envelope.
 */
export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await context.params;
  return proxyMessagesShopAccountPatch(request, id);
}
