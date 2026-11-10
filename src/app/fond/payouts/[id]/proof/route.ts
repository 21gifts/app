import { proxyFondPayoutProofPost } from '@/lib/api-proxies';

/** App Router context for `/fond/payouts/[id]/proof`. */
interface FondPayoutProofRouteContext {
  params: Promise<{ id: string }>;
}

/**
 * App Router POST for `/fond/payouts/:id/proof`.
 *
 * @param request - Incoming request (Bearer session + JSON `{ preimage }`).
 * @param context - Dynamic route params (`id`).
 * @returns The proxied upstream response.
 */
export async function POST(
  request: Request,
  context: FondPayoutProofRouteContext,
): Promise<Response> {
  const { id } = await context.params;
  return proxyFondPayoutProofPost(request, id);
}
