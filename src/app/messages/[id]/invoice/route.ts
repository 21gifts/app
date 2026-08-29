import { proxyMessagesInvoicePost } from '@/lib/api-proxies';

/** App Router context for `/messages/[id]/invoice`. */
interface InvoiceRouteContext {
  params: Promise<{ id: string }>;
}

/**
 * App Router POST for `/messages/:id/invoice`.
 *
 * @param request - Incoming request (Bearer session + `{ sats }` JSON).
 * @param context - Dynamic route params (`id` = message UUID).
 * @returns The proxied upstream response.
 */
export async function POST(request: Request, context: InvoiceRouteContext): Promise<Response> {
  const { id } = await context.params;
  return proxyMessagesInvoicePost(request, id);
}
