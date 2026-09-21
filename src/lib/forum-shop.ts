/** Hashtag name without `#`. */
export const SHOP_HASHTAG = '21GiftsShop';

/** `#21GiftsShop` token (case-insensitive; next char not `[A-Za-z0-9_]`). */
const SHOP_HASHTAG_TOKEN = /#21GiftsShop(?![A-Za-z0-9_])/i;

/** Global form of {@link SHOP_HASHTAG_TOKEN} for replacement. */
const SHOP_HASHTAG_TOKEN_GLOBAL = /#21GiftsShop(?![A-Za-z0-9_])/gi;

/**
 * True when `text` contains a `#21GiftsShop` token (case-insensitive; next char not `[A-Za-z0-9_]`).
 *
 * @param text - Stored forum post body.
 * @returns Whether the body is a shop note.
 */
export function isShopNote(text: string): boolean {
  return SHOP_HASHTAG_TOKEN.test(text);
}

/**
 * Removes `#21GiftsShop` tokens from display text (case-insensitive).
 *
 * @param text - Stored forum post body.
 * @returns Text without shop hashtag tokens; leftover blank lines collapsed; trimmed.
 */
export function stripShopHashtag(text: string): string {
  return text
    .replace(SHOP_HASHTAG_TOKEN_GLOBAL, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Appends `#21GiftsShop` when `text` is not already a shop note.
 *
 * @param text - Composer or stored body.
 * @returns `text` unchanged when already a shop note; `#21GiftsShop` when blank; otherwise `text` plus `\n\n#21GiftsShop`.
 */
export function ensureShopHashtag(text: string): string {
  if (isShopNote(text)) {
    return text;
  }
  if (text.trim() === '') {
    return `#${SHOP_HASHTAG}`;
  }
  return `${text}\n\n#${SHOP_HASHTAG}`;
}
