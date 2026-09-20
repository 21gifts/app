import { proxyConversationMessagePhotoGet } from '@/lib/api-proxies';

/**
 * App Router GET for an indexed conversation photo at
 * `/conversations/[id]/messages/[messageId]/photo/[file]`.
 *
 * @param request - Incoming request (Bearer session).
 * @param context - Dynamic route params (`id`, `messageId`, `file`).
 * @returns The proxied image response, or 404 for an unsupported filename.
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string; messageId: string; file: string }> },
): Promise<Response> {
  const { id, messageId, file } = await context.params;
  const match = /^([1-9])\.(jpg|jpeg|png|webp)$/i.exec(file);
  if (match === null) {
    return new Response(null, { status: 404 });
  }
  return proxyConversationMessagePhotoGet(request, id, messageId, `${match[1]}.jpg`);
}
