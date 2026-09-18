import { proxyConversationReadPost } from '@/lib/api-proxies';

/** App Router context for `/conversations/[id]/read`. */
interface ConversationReadRouteContext {
  params: Promise<{ id: string }>;
}

/**
 * App Router POST for `/conversations/[id]/read`.
 *
 * Same-origin Bearer proxy of api POST `/conversations/:id/read`.
 *
 * @param request - Incoming request (Bearer session).
 * @param context - Dynamic route params (`id`).
 * @returns The proxied upstream response.
 */
export async function POST(
  request: Request,
  context: ConversationReadRouteContext,
): Promise<Response> {
  const { id } = await context.params;
  return proxyConversationReadPost(request, id);
}
