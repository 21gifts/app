import { proxyFondPayoutInvoicePost } from '@/lib/api-proxies';

/** App Router context for `/fond/payouts/[id]/invoice`. */
interface FondPayoutInvoiceRouteContext {
  params: Promise<{ id: string }>;
}

/**
 * App Router POST for `/fond/payouts/:id/invoice`.
 *
 * @param request - Incoming request (Bearer session).
 * @param context - Dynamic route params (`id`).
 * @returns The proxied upstream response.
 */
export async function POST(
  request: Request,
  context: FondPayoutInvoiceRouteContext,
): Promise<Response> {
  const { id } = await context.params;
  return proxyFondPayoutInvoicePost(request, id);
}
