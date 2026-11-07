import { proxyApiRequest } from '@/lib/api-proxy';

/**
 * Encode a single path segment. `.` and `..` would be resolved by `new URL`
 * before they reach the pay route.
 *
 * @param segment - Dynamic path parameter.
 * @returns Encoded segment, or `null` when it is not one segment.
 */
function encodedPaySegment(segment: string): string | null {
  if (
    segment === '' ||
    segment === '.' ||
    segment === '..' ||
    segment.includes('/') ||
    segment.includes('\\')
  ) {
    return null;
  }
  return encodeURIComponent(segment);
}

/**
 * App Router GET for a public shop-charge receipt on a Lightning address.
 *
 * @param request - Incoming request.
 * @param context - Dynamic `username` and `id` params.
 * @returns The proxied receipt response.
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ username: string; id: string }> },
): Promise<Response> {
  const { username, id } = await context.params;
  const encodedName = encodedPaySegment(username);
  const encodedId = encodedPaySegment(id);
  if (encodedName === null || encodedId === null) {
    return Response.json({ error: 'Not found' }, { status: 404 });
  }
  return proxyApiRequest(request, `/pay/${encodedName}/charges/${encodedId}`);
}
