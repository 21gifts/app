import { proxyMessagesTextPatch } from '@/lib/api-proxies';

/**
 * PATCH /forum/messages/[id]/text, forwarding the authenticated text update.
 *
 * @param request - Incoming Bearer request with JSON `{ text }`.
 * @param context - Dynamic message id.
 * @returns The upstream public message JSON, or an error envelope.
 */
export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await context.params;
  return proxyMessagesTextPatch(request, id);
}
