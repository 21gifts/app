import { proxyMessagesPlacePatch } from '@/lib/api-proxies';

/**
 * PATCH /forum/messages/[id]/place, forwarding the authenticated pin update.
 *
 * @param request - Incoming Bearer request with JSON `{ place }`.
 * @param context - Dynamic message id.
 * @returns The upstream public message JSON, or an error envelope.
 */
export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await context.params;
  return proxyMessagesPlacePatch(request, id);
}
