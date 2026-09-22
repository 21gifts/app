import { proxyShortLinkGet } from '@/lib/api-proxies';

/** App Router context for `/links/[code]`. */
interface ShortLinkProxyContext {
  params: Promise<{ code: string }>;
}

/**
 * App Router GET for `/links/[code]`.
 *
 * Same-origin public proxy of api GET `/links/:code` (no Bearer). JSON only.
 * The redirect that visitors open is `/l/[code]`.
 *
 * @param request - Incoming request (no auth required).
 * @param context - Dynamic route params (`code`).
 * @returns The proxied upstream response.
 */
export async function GET(request: Request, context: ShortLinkProxyContext): Promise<Response> {
  const { code } = await context.params;
  return proxyShortLinkGet(request, code);
}
