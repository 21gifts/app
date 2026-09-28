import { proxyMessagesPhotosPatch } from '@/lib/api-proxies';

/**
 * PATCH /forum/messages/[id]/photos, forwarding the authenticated stills update.
 *
 * @param request - Incoming Bearer request with JSON `{ photos }`.
 * @param context - Dynamic message id.
 * @returns The upstream public message JSON, or an error envelope.
 */
export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await context.params;
  return proxyMessagesPhotosPatch(request, id);
}
