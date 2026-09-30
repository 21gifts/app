import { proxyMessagesEditsGet } from '@/lib/api-proxies';

/**
 * GET /forum/messages/[id]/edits, forwarding the authenticated history read.
 *
 * @param request - Incoming Bearer request.
 * @param context - Dynamic message id.
 * @returns The upstream `{ edits }` JSON, or an error envelope.
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await context.params;
  return proxyMessagesEditsGet(request, id);
}
