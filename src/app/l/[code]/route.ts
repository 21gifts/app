import { notFound, redirect } from 'next/navigation';
import { getApiUrl } from '@/lib/config';
import { shortLinkPath } from '@/lib/short-link';

/** Eight hex characters, any case. Anything else is not a short code. */
const SHORT_CODE_RE = /^[0-9a-f]{8}$/i;

/** App Router context for `/l/[code]`. */
interface ShortLinkRouteContext {
  params: Promise<{ code: string }>;
}

/**
 * App Router GET for `/l/[code]`.
 *
 * Resolves an 8-hex code and redirects to the long message or member page.
 * Invalid codes and failed lookups render the existing not-found page.
 *
 * @param _request - Incoming request (unused; lookup is by `code` only).
 * @param context - Dynamic route params (`code`).
 * @returns Does not return; `redirect` or `notFound` throws.
 * @throws Next.js `notFound` when the code is not eight hex digits, the
 * lookup fails, or the body is not one message or member.
 * @throws Next.js `redirect` when the code resolves to a message or member page.
 */
export async function GET(_request: Request, context: ShortLinkRouteContext): Promise<never> {
  const { code } = await context.params;
  if (!SHORT_CODE_RE.test(code)) {
    notFound();
  }
  let response: Response;
  try {
    response = await fetch(`${getApiUrl()}/links/${encodeURIComponent(code.toLowerCase())}`, {
      cache: 'no-store',
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(2500),
    });
  } catch {
    notFound();
  }
  if (!response.ok) {
    notFound();
  }
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    notFound();
  }
  const path = shortLinkPath(body);
  if (path === null) {
    notFound();
  }
  redirect(path);
}
