import { proxyVerifyGet } from '@/lib/api-proxies';

/**
 * App Router GET for `/verify/:paymentHash`: a payer's wallet checks whether
 * a payment to a member's in-app wallet settled.
 *
 * @param request - Incoming request.
 * @param context - Dynamic `paymentHash` param.
 * @returns The proxied upstream response with CORS `*`.
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ paymentHash: string }> },
): Promise<Response> {
  const { paymentHash } = await context.params;
  return proxyVerifyGet(request, paymentHash);
}
