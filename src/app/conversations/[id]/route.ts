import { proxyConversationGet, proxyConversationPost } from '@/lib/api-proxies';

/** App Router context for `/conversations/[id]`. */
interface ConversationRouteContext {
  params: Promise<{ id: string }>;
}

/**
 * App Router GET for `/conversations/[id]`.
 *
 * Same-origin Bearer proxy of api GET `/conversations/:id`.
 *
 * @param request - Incoming request (Bearer session).
 * @param context - Dynamic route params (`id`).
 * @returns The proxied upstream response.
 */
export async function GET(request: Request, context: ConversationRouteContext): Promise<Response> {
  const { id } = await context.params;
  return proxyConversationGet(request, id);
}

/**
 * App Router POST for `/conversations/[id]`.
 *
 * Same-origin Bearer proxy of api POST `/conversations/:id`.
 *
 * @param request - Incoming request (Bearer session + JSON body).
 * @param context - Dynamic route params (`id`).
 * @returns The proxied upstream response.
 */
export async function POST(request: Request, context: ConversationRouteContext): Promise<Response> {
  const { id } = await context.params;
  return proxyConversationPost(request, id);
}
