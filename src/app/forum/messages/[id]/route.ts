import { proxyMessagesDelete } from '@/lib/api-proxies';

/**
 * DELETE /forum/messages/[id], forwarding the authenticated moderation request.
 *
 * @param request - Incoming Bearer request.
 * @param context - Dynamic message id.
 * @returns The upstream deletion result.
 */
export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await context.params;
  return proxyMessagesDelete(request, id);
}
