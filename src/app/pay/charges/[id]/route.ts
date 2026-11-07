import { proxyApiRequest } from '@/lib/api-proxy';

/**
 * Encode one charge id. `.` and `..` would be resolved by `new URL`
 * before they reach the pay route.
 *
 * @param id - Dynamic path parameter.
 * @returns Encoded segment, or `null` when it is not one segment.
 */
function encodedChargeId(id: string): string | null {
  if (id === '' || id === '.' || id === '..' || id.includes('/') || id.includes('\\')) {
    return null;
  }
  return encodeURIComponent(id);
}

/**
 * App Router GET for a public shop-charge receipt with no Lightning address.
 *
 * @param request - Incoming request.
 * @param context - Dynamic `id` param.
 * @returns The proxied receipt response.
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await context.params;
  const encoded = encodedChargeId(id);
  if (encoded === null) {
    return Response.json({ error: 'Not found' }, { status: 404 });
  }
  return proxyApiRequest(request, `/pay/charges/${encoded}`);
}
