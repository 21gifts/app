import type { Metadata } from 'next';
import { forumMessageSchema, type ForumMessage } from '@/lib/api-types';
import { getApiUrl } from '@/lib/config';

/** Same regex as PublicMessageLoader. Not exported (keep Function count down). */
const MESSAGE_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const DEFAULT_OG_ALT = '21.gifts — peer-to-peer Bitcoin gifts';
const EXTERNAL_OG_TITLE = 'External author on 21.gifts';
const EXTERNAL_OG_DESCRIPTION = 'A reply from someone outside 21.gifts who sent bitcoin to a post.';
const DESCRIPTION_MAX = 300;

/**
 * Description for a found note: trimmed text, or a name fallback — never the
 * marketing layout copy. Truncates above 300 UTF-16 code units with `…`.
 *
 * @param note - Loaded public forum note.
 * @returns Open Graph / Twitter description string.
 */
function ogDescription(note: ForumMessage): string {
  const trimmed = note.text.trim();
  const chosen = trimmed === '' ? `${note.name} on 21.gifts` : trimmed;
  if (chosen.length > DESCRIPTION_MAX) {
    return `${chosen.slice(0, DESCRIPTION_MAX - 1)}…`;
  }
  return chosen;
}

/**
 * Loads one public forum note for Open Graph metadata.
 *
 * Invalid UUIDs skip the network. Fetch failures, non-OK responses, and
 * bodies that fail {@link forumMessageSchema} return `null` instead of throwing.
 *
 * @param id - Forum message UUID from the route.
 * @returns The parsed note, or `null` when the id is invalid or the fetch fails.
 */
export async function loadPublicMessageForOg(id: string): Promise<ForumMessage | null> {
  if (!MESSAGE_ID_RE.test(id)) {
    return null;
  }
  try {
    const response = await fetch(`${getApiUrl()}/messages/${encodeURIComponent(id)}`, {
      cache: 'no-store',
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(2500),
    });
    if (!response.ok) {
      return null;
    }
    const parsed = forumMessageSchema.safeParse(await response.json());
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/**
 * Builds per-note Open Graph and Twitter metadata for `/messages/[id]`.
 *
 * A missing note returns `{}` so the root layout preview is inherited. A
 * found note with `via !== undefined` gets fully generic metadata instead.
 * A member note uses the author name and never the marketing description.
 *
 * @param id - Forum message UUID from the route.
 * @param note - Loaded public note, or `null` when missing or unloadable.
 * @returns Next.js `Metadata` for the note, or an empty object.
 */
export function publicMessageOgMetadata(id: string, note: ForumMessage | null): Metadata {
  if (note === null) {
    return {};
  }
  if (note.via !== undefined) {
    const title = EXTERNAL_OG_TITLE;
    const description = EXTERNAL_OG_DESCRIPTION;
    return {
      title,
      description,
      openGraph: {
        type: 'website',
        url: `https://21.gifts/messages/${id}`,
        siteName: '21.gifts',
        title,
        description,
        images: [{ url: '/og.png', width: 1200, height: 630, alt: DEFAULT_OG_ALT }],
      },
      twitter: {
        card: 'summary_large_image',
        title,
        description,
        images: [{ url: '/og.png', alt: DEFAULT_OG_ALT }],
      },
    };
  }
  const title = note.name;
  const description = ogDescription(note);
  const photoAlt = note.text.trim() || note.name;
  const photoImage = { url: `/messages/${id}/photo`, alt: photoAlt };
  return {
    title,
    description,
    openGraph: {
      type: 'website',
      url: `https://21.gifts/messages/${id}`,
      siteName: '21.gifts',
      title,
      description,
      images: note.hasPhoto
        ? [photoImage]
        : [{ url: '/og.png', width: 1200, height: 630, alt: DEFAULT_OG_ALT }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: note.hasPhoto ? [photoImage] : [{ url: '/og.png', alt: DEFAULT_OG_ALT }],
    },
  };
}
