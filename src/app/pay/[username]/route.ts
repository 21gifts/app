import { proxyApiRequest } from '@/lib/api-proxy';

/**
 * Encode a single path segment. `.` and `..` would be resolved by `new URL`
 * before they reach the pay route.
 *
 * @param username - Dynamic path parameter.
 * @returns Encoded segment, or `null` when it is not one segment.
 */
function encodedPayUsername(username: string): string | null {
  if (username === '.' || username === '..' || username.includes('/') || username.includes('\\')) {
    return null;
  }
  return encodeURIComponent(username);
}

/**
 * App Router GET for a public payment profile.
 *
 * @param request - Incoming request.
 * @param context - Dynamic `username` param.
 * @returns The proxied payment profile response.
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ username: string }> },
): Promise<Response> {
  const { username } = await context.params;
  const encoded = encodedPayUsername(username);
  if (encoded === null) {
    return Response.json({ error: 'Not found' }, { status: 404 });
  }
  return proxyApiRequest(request, `/pay/${encoded}`);
}
