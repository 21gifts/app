import { z } from 'zod';
import { FORUM_MESSAGE_MAX_LENGTH } from '@/lib/api-types';

const translateBodySchema = z.object({
  text: z.string().min(1).max(FORUM_MESSAGE_MAX_LENGTH),
  target: z.enum(['en', 'de', 'es', 'fil']),
});

const translatedBodySchema = z.object({
  translations: z.tuple([z.object({ text: z.string().min(1) })]),
});

/**
 * Read DeepL API v2 config from `TRANSLATE_URL` (used as-is as the POST URL)
 * and required `TRANSLATE_API_KEY`.
 *
 * @returns Parsed upstream URL and API key, or null when the URL is invalid/empty or the key is missing/empty.
 * @throws Does not throw.
 */
export function getTranslateUpstream(): { url: URL; apiKey: string } | null {
  const rawUrl = process.env.TRANSLATE_URL;
  if (rawUrl === undefined || rawUrl.trim() === '') {
    return null;
  }

  try {
    const url = new URL(rawUrl);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return null;
    }
    const rawApiKey = process.env.TRANSLATE_API_KEY;
    if (rawApiKey === undefined || rawApiKey.trim() === '') {
      return null;
    }
    return { url, apiKey: rawApiKey.trim() };
  } catch {
    return null;
  }
}

/**
 * Report whether the translation upstream is configured without contacting it.
 * Available only when `getTranslateUpstream()` is non-null (valid http(s)
 * URL and non-blank key).
 *
 * @returns Always-200 JSON containing the availability flag.
 * @throws Does not throw.
 */
export function proxyTranslateGet(): Response {
  return Response.json({ available: getTranslateUpstream() !== null });
}

/**
 * Validate `{ text, target }` and POST DeepL API v2 with `target_lang` and
 * `DeepL-Auth-Key`. Maps `fil` to `TL`. Does not forward the incoming
 * Authorization header. Does not send `source_lang`.
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
      headers: {
        'content-type': 'application/json',
        authorization: `DeepL-Auth-Key ${upstream.apiKey}`,
      },
      body: JSON.stringify({
        text: [parsed.data.text],
        target_lang: parsed.data.target === 'fil' ? 'TL' : parsed.data.target.toUpperCase(),
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
  return Response.json({ translatedText: translated.data.translations[0].text });
}
