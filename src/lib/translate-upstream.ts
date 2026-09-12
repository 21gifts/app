import { z } from 'zod';
import { FORUM_MESSAGE_MAX_LENGTH } from '@/lib/api-types';

const translateBodySchema = z.object({
  text: z.string().min(1).max(FORUM_MESSAGE_MAX_LENGTH),
  target: z.enum(['en', 'de', 'es', 'fil']),
});

const translatedBodySchema = z.object({
  translatedText: z.string().min(1),
});

/**
 * Read and validate the optional LibreTranslate-compatible upstream configuration.
 *
 * @returns Parsed upstream endpoint and optional API key, or null when disabled or invalid.
 * @throws Does not throw.
 */
export function getTranslateUpstream(): { url: URL; apiKey: string | null } | null {
  const rawUrl = process.env.TRANSLATE_URL;
  if (rawUrl === undefined || rawUrl.trim() === '') {
    return null;
  }

  try {
    const base = new URL(rawUrl);
    if (base.protocol !== 'http:' && base.protocol !== 'https:') {
      return null;
    }
    if (!base.pathname.endsWith('/')) {
      base.pathname += '/';
    }
    const rawApiKey = process.env.TRANSLATE_API_KEY;
    return {
      url: new URL('translate', base),
      apiKey: rawApiKey === undefined || rawApiKey === '' ? null : rawApiKey,
    };
  } catch {
    return null;
  }
}

/**
 * Report whether the translation upstream is configured without contacting it.
 *
 * @returns Always-200 JSON containing the availability flag.
 * @throws Does not throw.
 */
export function proxyTranslateGet(): Response {
  return Response.json({ available: getTranslateUpstream() !== null });
}

/**
 * Validate and forward one translation request to the configured upstream.
 *
 * @param request - Incoming same-origin request containing `{ text, target }` JSON.
 * @returns JSON translation or a catalog-safe 400, 502, or 503 error response.
 * @throws Does not throw; request and upstream failures are returned as JSON responses.
 */
export async function proxyTranslatePost(request: Request): Promise<Response> {
  const upstream = getTranslateUpstream();
  if (upstream === null) {
    return Response.json({ error: 'Translate is not configured' }, { status: 503 });
  }

  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return Response.json({ error: 'Invalid body' }, { status: 400 });
  }
  const parsed = translateBodySchema.safeParse(input);
  if (!parsed.success) {
    return Response.json({ error: 'Invalid body' }, { status: 400 });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort();
  }, 15_000);

  let response: Response;
  try {
    response = await fetch(upstream.url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        q: parsed.data.text,
        source: 'auto',
        target: parsed.data.target === 'fil' ? 'tl' : parsed.data.target,
        format: 'text',
        ...(upstream.apiKey === null ? {} : { api_key: upstream.apiKey }),
      }),
      signal: controller.signal,
    });
  } catch {
    return Response.json({ error: 'Translate upstream unreachable' }, { status: 502 });
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    return Response.json({ error: 'Translate upstream failed' }, { status: 502 });
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return Response.json({ error: 'Translate upstream failed' }, { status: 502 });
  }
  const translated = translatedBodySchema.safeParse(body);
  if (!translated.success) {
    return Response.json({ error: 'Translate upstream failed' }, { status: 502 });
  }
  return Response.json({ translatedText: translated.data.translatedText });
}
