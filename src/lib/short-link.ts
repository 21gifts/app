const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Absolute URL handed to a person for a note, reply, or member profile.
 *
 * A UUID uses `/l/` plus the first group, lowercased. Any other id keeps `longPath`.
 *
 * @param origin - Page origin without a trailing slash (`https://21.gifts`).
 * @param id - Resource id. Only a UUID is shortened.
 * @param longPath - App path used when `id` is not a UUID (`/messages/<id>`).
 * @returns Absolute short or long URL.
 */
export function shortResourceUrl(origin: string, id: string, longPath: string): string {
  if (!UUID_RE.test(id)) {
    return `${origin}${longPath}`;
  }
  return `${origin}/l/${id.slice(0, 8).toLowerCase()}`;
}

/**
 * Maps a `GET /links/:code` JSON body to the long app path.
 *
 * @param body - Parsed JSON, or anything else.
 * @returns `/messages/<uuid>` or `/members/<uuid>` with the id lowercased, or `null`.
 */
export function shortLinkPath(body: unknown): string | null {
  if (typeof body !== 'object' || body === null) {
    return null;
  }
  if (!('kind' in body) || !('id' in body)) {
    return null;
  }
  const kind = body.kind;
  const id = body.id;
  if ((kind !== 'message' && kind !== 'member') || typeof id !== 'string') {
    return null;
  }
  if (!UUID_RE.test(id)) {
    return null;
  }
  const lower = id.toLowerCase();
  return kind === 'message' ? `/messages/${lower}` : `/members/${lower}`;
}
