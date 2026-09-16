/** x.com timeline analog: visible characters before Show more. */
export const FORUM_TEXT_PREVIEW_LIMIT = 280;

/**
 * Collapse a forum note or reply body to a preview (UTF-16 `.length`).
 *
 * @param text - Full note or reply body.
 * @param limit - Visible character count before Show more. Defaults to {@link FORUM_TEXT_PREVIEW_LIMIT}.
 * @returns Preview string (no ellipsis) and whether the body was truncated.
 * @throws Does not throw.
 */
export function forumTextPreview(
  text: string,
  limit: number = FORUM_TEXT_PREVIEW_LIMIT,
): { preview: string; truncated: boolean } {
  if (text.length <= limit) {
    return { preview: text, truncated: false };
  }
  let preview = text.slice(0, limit);
  const lastWs = Math.max(preview.lastIndexOf(' '), preview.lastIndexOf('\n'));
  if (lastWs >= Math.floor(limit * 0.8)) {
    preview = preview.slice(0, lastWs);
  }
  preview = preview.replace(/[ \t]+$/, '');
  return { preview, truncated: true };
}
