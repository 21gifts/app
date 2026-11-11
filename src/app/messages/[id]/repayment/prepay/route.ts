import { proxyMessagesRepaymentPrepayPost } from '@/lib/api-proxies';

/** App Router context for `/messages/[id]/repayment/prepay`. */
interface RepaymentPrepayRouteContext {
  params: Promise<{ id: string }>;
}

/**
 * App Router POST for `/messages/:id/repayment/prepay`.
 *
 * @param request - Incoming request (Bearer session + JSON `{ amount }`).
 * @param context - Dynamic route params (`id` = credit note).
 * @returns The proxied upstream response.
 */
export async function POST(
  request: Request,
  context: RepaymentPrepayRouteContext,
): Promise<Response> {
  const { id } = await context.params;
  return proxyMessagesRepaymentPrepayPost(request, id);
}
