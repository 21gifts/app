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
 * @param text - Raw forum note body.
 * @param target - Active UI locale.
 * @returns The translated note body.
 * @throws When the route returns a non-2xx response or omits `translatedText`.
 */
export async function translateNote(text: string, target: Locale): Promise<string> {
  const response = await fetch('/translate', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ text, target }),
  });
  if (!response.ok) {
    throw new Error('Translation request failed');
  }

  const body: unknown = await response.json();
  if (
    typeof body !== 'object' ||
    body === null ||
    !('translatedText' in body) ||
    typeof body.translatedText !== 'string'
  ) {
    throw new Error('Translation response is invalid');
  }
  return body.translatedText;
}
