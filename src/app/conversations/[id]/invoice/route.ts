import { proxyConversationInvoicePost } from '@/lib/api-proxies';

/** App Router context for `/conversations/[id]/invoice`. */
interface InvoiceRouteContext {
  params: Promise<{ id: string }>;
}

/**
 * App Router POST for `/conversations/:id/invoice`.
 *
 * @param request - Incoming request (Bearer session + `{ sats }` or `{ sats, text }` JSON).
 * @param context - Dynamic route params (`id` = conversation UUID).
 * @returns The proxied upstream response.
 */
export async function POST(request: Request, context: InvoiceRouteContext): Promise<Response> {
  const { id } = await context.params;
  return proxyConversationInvoicePost(request, id);
}
