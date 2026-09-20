import { proxyForumMessageGet, proxyMessagesDelete } from '@/lib/api-proxies';

/**
 * GET /forum/messages/[id], forwarding the authenticated single-note request.
 *
 * Staff sessions receive soft-hidden rows; public HTML stays on `/messages/[id]`.
 *
 * @param request - Incoming Bearer request.
 * @param context - Dynamic message id.
 * @returns The upstream note JSON.
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await context.params;
  return proxyForumMessageGet(request, id);
}

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
