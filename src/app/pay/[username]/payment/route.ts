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
 * App Router POST that opens a shop payment for an amount the payer entered.
 *
 * @param request - Incoming JSON request with `amountSats`.
 * @param context - Dynamic `username` param.
 * @returns The proxied `{ payment, expiresAt }` or `{ error, code }` response.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ username: string }> },
): Promise<Response> {
  const { username } = await context.params;
  const encoded = encodedPayUsername(username);
  if (encoded === null) {
    return Response.json({ error: 'Not found' }, { status: 404 });
  }
  return proxyApiRequest(request, `/pay/${encoded}/payment`);
}
