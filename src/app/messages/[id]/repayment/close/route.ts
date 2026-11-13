import { proxyMessagesRepaymentClosePost } from '@/lib/api-proxies';

/** App Router context for `/messages/[id]/repayment/close`. */
interface RepaymentCloseRouteContext {
  params: Promise<{ id: string }>;
}

/**
 * App Router POST for `/messages/:id/repayment/close`.
 *
 * @param request - Incoming request (Bearer session, no body).
 * @param context - Dynamic route params (`id` = credit note).
 * @returns The proxied upstream response.
 */
export async function POST(
  request: Request,
  context: RepaymentCloseRouteContext,
): Promise<Response> {
  const { id } = await context.params;
  return proxyMessagesRepaymentClosePost(request, id);
}
