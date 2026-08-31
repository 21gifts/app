import { proxyMessagesRepliesGet } from '@/lib/api-proxies';

/** App Router context for `/forum/messages/[id]/replies`. */
interface RepliesRouteContext {
  params: Promise<{ id: string }>;
}

/**
 * App Router GET for `/forum/messages/[id]/replies`.
 *
 * Same-origin Bearer proxy of api GET `/messages/:id/replies`.
 *
 * @param request - Incoming request (Bearer session).
 * @param context - Dynamic route params (`id`).
 * @returns The proxied upstream response.
 */
export async function GET(request: Request, context: RepliesRouteContext): Promise<Response> {
  const { id } = await context.params;
  return proxyMessagesRepliesGet(request, id);
}
