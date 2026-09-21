import { proxyConversationMessagePhotoGet } from '@/lib/api-proxies';

/**
 * App Router GET for `/conversations/[id]/messages/[messageId]/photo`.
 *
 * @param request - Incoming request (Bearer session).
 * @param context - Dynamic route params (`id`, `messageId`).
 * @returns The proxied upstream response (raw image bytes).
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string; messageId: string }> },
): Promise<Response> {
  const { id, messageId } = await context.params;
  return proxyConversationMessagePhotoGet(request, id, messageId);
}
