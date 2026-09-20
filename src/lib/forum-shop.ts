/** Hashtag name without `#`. */
export const SHOP_HASHTAG = '21GiftsShop';

/** `#21GiftsShop` token (case-insensitive; next char not `[A-Za-z0-9_]`). */
const SHOP_HASHTAG_TOKEN = /#21GiftsShop(?![A-Za-z0-9_])/i;

/** Global form of {@link SHOP_HASHTAG_TOKEN} for replacement. */
const SHOP_HASHTAG_TOKEN_GLOBAL = /#21GiftsShop(?![A-Za-z0-9_])/gi;

/** True when `text` contains a `#21GiftsShop` token (case-insensitive; next char not `[A-Za-z0-9_]`). */
export function isShopNote(text: string): boolean {
  return SHOP_HASHTAG_TOKEN.test(text);
}

/**
 * Remove `#21GiftsShop` tokens from display text (case-insensitive), collapse leftover
 * blank lines / extra spaces, trim. Empty string if only the hashtag was present.
 */
export function stripShopHashtag(text: string): string {
  return text
    .replace(SHOP_HASHTAG_TOKEN_GLOBAL, '')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/ {2,}/g, ' ')
    .trim();
}

/**
 * If `isShopNote(text)` already, return `text` unchanged (do not trim inner content).
 * If `text.trim() === ''`, return `#21GiftsShop`.
 * Otherwise append `\n\n#21GiftsShop`.
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
