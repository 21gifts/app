/** Collapsed preview length; Show more starts only above twice this. */
export const FORUM_TEXT_PREVIEW_LIMIT = 280;
/** Longest body that stays whole: twice the collapsed preview. */
export const FORUM_TEXT_FULL_LIMIT = FORUM_TEXT_PREVIEW_LIMIT * 2;

/**
 * Collapse a forum note or reply body to a preview (UTF-16 `.length`).
 *
 * @param text - Full note or reply body.
 * @param limit - Collapsed preview length; the body stays whole through `limit * 2`. Defaults to {@link FORUM_TEXT_PREVIEW_LIMIT}.
 * @returns Preview string (no ellipsis) and whether the body was truncated.
 * @throws Does not throw.
 */
export function forumTextPreview(
  text: string,
  limit: number = FORUM_TEXT_PREVIEW_LIMIT,
): { preview: string; truncated: boolean } {
  if (text.length <= limit * 2) {
    return { preview: text, truncated: false };
  }
  let preview = text.slice(0, limit);
  const lastWs = Math.max(preview.lastIndexOf(' '), preview.lastIndexOf('\n'));
  if (lastWs >= Math.floor(limit * 0.8)) {
    preview = preview.slice(0, lastWs);
  }
  preview = preview.replace(/[ \t]+$/, '');
  preview = dropIncompleteTrailingUrl(preview, text);
  return { preview, truncated: true };
}

function dropIncompleteTrailingUrl(preview: string, text: string): string {
  const next = text[preview.length];
  if (next === ' ' || next === '\t' || next === '\n' || next === '\r') {
    return preview;
  }
  const match = /https?:\/\/\S*$/iu.exec(preview);
  if (match === null) {
    return preview;
  }
  return preview.slice(0, match.index).replace(/[ \t]+$/u, '');
}
