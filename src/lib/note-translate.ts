import type { Locale } from '@/lib/locale';

/** UI locale sent as the translation `target`. */
export type NoteTranslateTarget = Locale;

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

/**
 * Translate a conversation message through the same-origin conversation
 * translation route.
 *
 * Session is required. A non-empty string is sent as `Authorization: Bearer …`.
 *
 * @param conversationId - Conversation UUID.
 * @param messageId - Conversation message id.
 * @param target - Active UI locale.
 * @param session - Bearer token. Empty omits Authorization (the api then 401s).
 * @returns The translated body and whether the api served a cache hit.
 * @throws When the route returns a non-2xx response or `translatedText` is
 *   missing, not a string, or empty after trim.
 */
export async function translateConversationMessage(
  conversationId: string,
  messageId: string,
  target: NoteTranslateTarget,
  session: string,
): Promise<{ translatedText: string; cached: boolean }> {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (session !== '') {
    headers['Authorization'] = `Bearer ${session}`;
  }
  const response = await fetch(
    `/conversations/${encodeURIComponent(conversationId)}/messages/${encodeURIComponent(
      messageId,
    )}/translate`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify({ target }),
    },
  );
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
  return {
    translatedText: body.translatedText,
    cached: 'cached' in body && body.cached === true,
  };
}
