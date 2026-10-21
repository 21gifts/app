/**
 * Load the browser Google Maps key from same-origin `GET /maps/key`.
 *
 * A non-string, missing, or blank `key` and any fetch or JSON failure return
 * `null`; the promise never rejects. A usable key is returned trimmed.
 *
 * @returns Trimmed browser key, or `null` when no map should be drawn.
 */
export async function fetchMapsKey(): Promise<string | null> {
  try {
    const response = await fetch('/maps/key');
    const body: unknown = await response.json();
    if (
      typeof body === 'object' &&
      body !== null &&
      'key' in body &&
      typeof body.key === 'string'
    ) {
      const trimmed = body.key.trim();
      return trimmed === '' ? null : trimmed;
    }
    return null;
  } catch {
    return null;
  }
}
