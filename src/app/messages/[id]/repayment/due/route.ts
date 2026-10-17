import { proxyMessagesRepaymentDuePost } from '@/lib/api-proxies';

/** App Router context for `/messages/[id]/repayment/due`. */
interface RepaymentDueRouteContext {
  params: Promise<{ id: string }>;
}

/**
 * App Router POST for `/messages/:id/repayment/due`.
 *
 * @param request - Incoming request (Bearer session, no body).
 * @param context - Dynamic route params (`id` = credit note).
 * @returns The proxied upstream response.
 */
export async function POST(request: Request, context: RepaymentDueRouteContext): Promise<Response> {
  const { id } = await context.params;
  return proxyMessagesRepaymentDuePost(request, id);
}
