import { proxyApiRequest } from '@/lib/api-proxy';

/**
 * App Router POST for a public exact-amount payment invoice.
 *
 * @param request - Incoming JSON request with `amountSats`.
 * @param context - Dynamic `username` param.
 * @returns The proxied invoice response.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ username: string }> },
): Promise<Response> {
  const { username } = await context.params;
  return proxyApiRequest(request, `/pay/${encodeURIComponent(username)}/invoice`);
}
