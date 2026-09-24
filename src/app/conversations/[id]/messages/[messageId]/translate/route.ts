import { proxyTranslateConversationMessagePost } from '@/lib/api-proxies';

/**
 * POST `/conversations/[id]/messages/[messageId]/translate` proxy handler.
 *
 * @param request - Incoming request containing `{ target }`.
 * @param context - Dynamic route params (`id`, `messageId`).
 * @returns `{ translatedText, cached }` or 400/401/404/503/502.
 * @throws Does not throw.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string; messageId: string }> },
): Promise<Response> {
  const { id, messageId } = await context.params;
  return proxyTranslateConversationMessagePost(request, id, messageId);
}
