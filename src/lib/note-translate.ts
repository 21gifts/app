import type { Locale } from '@/lib/locale';

let availablePromise: Promise<boolean> | null = null;

/**
 * Query the same-origin translation route, sharing and caching the request.
 *
 * @returns Whether translation is configured; request and parsing failures resolve to false.
 * @throws Does not throw; failures resolve to false.
 */
export function fetchTranslateAvailable(): Promise<boolean> {
  if (availablePromise === null) {
    availablePromise = fetch('/translate')
      .then(async (response) => {
        if (!response.ok) {
          return false;
        }
        const body: unknown = await response.json();
        return (
          typeof body === 'object' &&
          body !== null &&
          'available' in body &&
          body.available === true
        );
      })
      .catch(() => false);
  }
  return availablePromise;
}

/**
 * Translate a forum note through the same-origin translation route.
 *
 * The API looks up `message_translation` before DeepL.
 *
 * @param messageId - Forum message UUID.
 * @param target - Active UI locale.
 * @param session - Optional bearer token. A non-empty string is sent as
 *   `Authorization: Bearer …` (hidden staff permalink). Omitted, null, or
 *   empty leaves the request unsigned so public notes still work.
 * @returns The translated note body.
 * @throws When the route returns a non-2xx response or `translatedText` is
 *   missing, not a string, or empty after trim.
 */
export async function translateNote(
  messageId: string,
  target: Locale,
  session?: string | null,
): Promise<string> {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (typeof session === 'string' && session !== '') {
    headers['Authorization'] = `Bearer ${session}`;
  }
  const response = await fetch('/translate', {
    method: 'POST',
    headers,
    body: JSON.stringify({ messageId, target }),
  });
  if (!response.ok) {
    throw new Error('Translation request failed');
  }

  const body: unknown = await response.json();
  if (
    typeof body !== 'object' ||
    body === null ||
    !('translatedText' in body) ||
    typeof body.translatedText !== 'string' ||
    body.translatedText.trim() === ''
  ) {
    throw new Error('Translation response is invalid');
  }
  return body.translatedText;
}
