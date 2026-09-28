/**
 * The `@username` token under the caret in a forum composer.
 *
 * Same character class as stored mention marks: a mark starts at `@` only
 * when the previous character is not a username character.
 */

const USERNAME_CHAR = /[A-Za-z0-9._-]/;
const QUERY = /^[a-z0-9][a-z0-9._-]{0,31}$/;

/** One active `@` token. */
export interface ActiveMention {
  /** Index of `@`. */
  start: number;
  /** Exclusive end of the username-character run. */
  end: number;
  /** Text between `@` and the caret, lowercased. `""` when the caret is just after `@`. */
  query: string;
}

/**
 * Find the mention token that contains `caret`.
 *
 * Active only when the caret is after `@` and not past the username run
 * (`start < caret <= end`). `name@21.gifts` is not a mention. A non-empty
 * query that is not a username prefix (`@.` / `@_` / `@-`, or longer than
 * 32 characters) is not a mention.
 *
 * @param text - Composer value.
 * @param caret - Collapsed caret, clamped to `0..text.length`.
 * @returns The token, or `null` when the caret is not inside a mention.
 */
export function activeMention(text: string, caret: number): ActiveMention | null {
  const at = Math.max(0, Math.min(caret, text.length));
  let index = at;
  while (index > 0 && USERNAME_CHAR.test(text.charAt(index - 1))) {
    index -= 1;
  }
  if (index === 0 || text.charAt(index - 1) !== '@') {
    return null;
  }
  const start = index - 1;
  const previous = start === 0 ? '' : text.charAt(start - 1);
  if (previous !== '' && USERNAME_CHAR.test(previous)) {
    return null;
  }
  let end = start + 1;
  while (end < text.length && USERNAME_CHAR.test(text.charAt(end))) {
    end += 1;
  }
  const query = text.slice(start + 1, at).toLowerCase();
  if (query.length > 32 || (query !== '' && !QUERY.test(query))) {
    return null;
  }
  return { start, end, query };
}
