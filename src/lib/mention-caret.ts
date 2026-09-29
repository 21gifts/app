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

/**
 * Move dismissed `@` indexes across one text edit.
 *
 * An index before the edit stays. An index after the edit shifts with the
 * text. An index inside the replaced span is dropped, so a different `@`
 * that lands on the old index opens. `caret` is where the edit ended in
 * `next`; without it, the edit is the first interior span that is not a
 * shared prefix or suffix.
 *
 * @param previous - Composer value before the edit.
 * @param next - Composer value after the edit.
 * @param closed - Indexes of `@` that Escape, Tab, or a click outside dismissed.
 * @param caret - Caret in `next` after the edit, or `null` when unknown.
 * @returns The same set when nothing moved, otherwise the shifted indexes.
 */
export function remapClosedMentionStarts(
  previous: string,
  next: string,
  closed: ReadonlySet<number>,
  caret: number | null,
): ReadonlySet<number> {
  if (previous === next || closed.size === 0) {
    return closed;
  }
  const span = editSpan(previous, next, caret);
  const shift = span.nextEnd - span.prevEnd;
  let changed = false;
  const moved = new Set<number>();
  for (const index of closed) {
    if (index < span.prefix) {
      if (next.charAt(index) === '@') {
        moved.add(index);
      } else {
        changed = true;
      }
      continue;
    }
    if (index >= span.prevEnd) {
      const at = index + shift;
      if (next.charAt(at) === '@') {
        moved.add(at);
        if (at !== index) {
          changed = true;
        }
      } else {
        changed = true;
      }
      continue;
    }
    changed = true;
  }
  return changed ? moved : closed;
}

function editSpan(
  previous: string,
  next: string,
  caret: number | null,
): { prefix: number; prevEnd: number; nextEnd: number } {
  if (caret !== null && caret >= 0 && caret <= next.length) {
    const suffixLength = next.length - caret;
    if (
      previous.length >= suffixLength &&
      previous.slice(previous.length - suffixLength) === next.slice(caret)
    ) {
      const prevEnd = previous.length - suffixLength;
      return { prefix: sharedPrefix(previous, next, prevEnd, caret), prevEnd, nextEnd: caret };
    }
  }
  const prefix = sharedPrefix(previous, next, previous.length, next.length);
  let prevEnd = previous.length;
  let nextEnd = next.length;
  while (
    prevEnd > prefix &&
    nextEnd > prefix &&
    previous.charAt(prevEnd - 1) === next.charAt(nextEnd - 1)
  ) {
    prevEnd -= 1;
    nextEnd -= 1;
  }
  return { prefix, prevEnd, nextEnd };
}

function sharedPrefix(previous: string, next: string, prevEnd: number, nextEnd: number): number {
  let prefix = 0;
  const limit = Math.min(prevEnd, nextEnd);
  while (prefix < limit && previous.charAt(prefix) === next.charAt(prefix)) {
    prefix += 1;
  }
  return prefix;
}
