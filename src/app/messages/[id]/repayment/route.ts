import { proxyMessagesRepaymentGet, proxyMessagesRepaymentPost } from '@/lib/api-proxies';

/** App Router context for `/messages/[id]/repayment`. */
interface RepaymentRouteContext {
  params: Promise<{ id: string }>;
}

/**
 * App Router GET for `/messages/:id/repayment`.
 *
 * @param request - Incoming request. No session is required.
 * @param context - Dynamic route params (`id` = credit note).
 * @returns The proxied upstream response.
 */
export async function GET(request: Request, context: RepaymentRouteContext): Promise<Response> {
  const { id } = await context.params;
  return proxyMessagesRepaymentGet(request, id);
}

/**
 * App Router POST for `/messages/:id/repayment`.
 *
 * @param request - Incoming request (Bearer session, no body).
 * @param context - Dynamic route params (`id` = credit note).
 * @returns The proxied upstream response.
 */
export async function POST(request: Request, context: RepaymentRouteContext): Promise<Response> {
  const { id } = await context.params;
  return proxyMessagesRepaymentPost(request, id);
}
