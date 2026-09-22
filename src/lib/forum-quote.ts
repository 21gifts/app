const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SHORT_CODE_RE = /^[0-9a-f]{8}$/i;
const MESSAGE_PREFIX_RE = /https?:\/\/[^\s/]+\/messages\//gi;
const SHORT_PREFIX_RE = /https?:\/\/[^\s/]+\/l\//gi;
const HORIZONTAL_WS_RE = /[^\S\n\r]+/g;

function isWhitespace(ch: string): boolean {
  return ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r' || ch === '\f' || ch === '\v';
}

function isProsePunctuation(ch: string): boolean {
  return (
    ch === '.' ||
    ch === ',' ||
    ch === '!' ||
    ch === ';' ||
    ch === ':' ||
    ch === ')' ||
    ch === '(' ||
    ch === "'" ||
    ch === '"' ||
    ch === ']' ||
    ch === '[' ||
    ch === '…'
  );
}

type IdMatch = { start: number; end: number; id: string };

function collectIdMatches(
  text: string,
  prefixRe: RegExp,
  idRe: RegExp,
  idLength: number,
): IdMatch[] {
  const matches: IdMatch[] = [];
  const scanner = new RegExp(prefixRe.source, prefixRe.flags);
  let prefixMatch: RegExpExecArray | null;
  while ((prefixMatch = scanner.exec(text)) !== null) {
    const idStart = prefixMatch.index + prefixMatch[0].length;
    const idSlice = text.slice(idStart, idStart + idLength);
    if (!idRe.test(idSlice)) {
      continue;
    }
    let end = idStart + idLength;
    const afterId = text[end];
    if (afterId === '/') {
      const afterSlash = text[end + 1];
      if (
        afterSlash === undefined ||
        isWhitespace(afterSlash) ||
        afterSlash === '?' ||
        afterSlash === '#' ||
        isProsePunctuation(afterSlash)
      ) {
        end += 1;
      } else {
        continue;
      }
    } else if (
      afterId !== undefined &&
      !isWhitespace(afterId) &&
      afterId !== '?' &&
      afterId !== '#' &&
      !isProsePunctuation(afterId)
    ) {
      continue;
    }
    const next = text[end];
    if (next === '?' || next === '#') {
      const queryStart = end;
      end += 1;
      while (end < text.length && !isWhitespace(text[end] as string)) {
        end += 1;
      }
      while (end > queryStart + 1 && isProsePunctuation(text[end - 1] as string)) {
        end -= 1;
      }
    }
    matches.push({ start: prefixMatch.index, end, id: idSlice.toLowerCase() });
  }
  return matches;
}

function uniqueFirstSeenIds(matches: readonly IdMatch[]): string[] {
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const match of matches) {
    if (!seen.has(match.id)) {
      seen.add(match.id);
      ids.push(match.id);
    }
  }
  return ids;
}

function stripMatches(text: string, toStrip: readonly IdMatch[]): string {
  if (toStrip.length === 0) {
    return text;
  }
  const sorted = [...toStrip].sort((a, b) => a.start - b.start);
  const affectedLines = new Set<number>();
  for (const match of sorted) {
    let line = 0;
    for (let i = 0; i < match.start; i += 1) {
      if (text[i] === '\n') {
        line += 1;
      }
    }
    affectedLines.add(line);
  }
  let result = '';
  let cursor = 0;
  for (const match of sorted) {
    result += text.slice(cursor, match.start);
    cursor = match.end;
  }
  result += text.slice(cursor);
  const lines = result.split('\n');
  const nextLines = lines.map((line, index) => {
    if (!affectedLines.has(index)) {
      return line;
    }
    return line.replace(HORIZONTAL_WS_RE, ' ').replace(/[ \t]+$/u, '');
  });
  return nextLines.join('\n').trim();
}

function splitTrackedLinks(
  text: string,
  prefixRe: RegExp,
  idRe: RegExp,
  idLength: number,
  resolvedIds: ReadonlySet<string> | undefined,
): { displayText: string; ids: string[] } {
  const matches = collectIdMatches(text, prefixRe, idRe, idLength);
  const ids = uniqueFirstSeenIds(matches);
  const resolved =
    resolvedIds === undefined ? undefined : new Set([...resolvedIds].map((id) => id.toLowerCase()));
  const toStrip =
    resolved === undefined ? matches : matches.filter((match) => resolved.has(match.id));
  return { displayText: stripMatches(text, toStrip), ids };
}

/**
 * Parse HTTP(S) `/messages/<uuid>` URLs from a forum body.
 *
 * @param text - Raw note or reply body.
 * @param resolvedIds - When set, only those UUIDs (case-insensitive) are stripped
 *   from `displayText`. When omitted, every matched URL is stripped.
 * @returns Lowercased unique first-seen ids and the remaining display text.
 */
export function splitForumMessageQuotes(
  text: string,
  resolvedIds?: ReadonlySet<string>,
): { displayText: string; ids: string[] } {
  return splitTrackedLinks(text, MESSAGE_PREFIX_RE, UUID_RE, 36, resolvedIds);
}

/**
 * Parse HTTP(S) `/l/<8 hex>` URLs from a forum body.
 *
 * Same host and punctuation rules as {@link splitForumMessageQuotes}. Codes are
 * lowercased, unique, and first-seen. When `resolvedCodes` is omitted, every
 * matched short link is stripped. When it is passed, only those codes are
 * stripped (case-insensitive).
 *
 * @param text - Raw note or reply body.
 * @param resolvedCodes - Codes whose short URLs should leave `displayText`.
 * @returns Lowercased unique first-seen codes and the remaining display text.
 */
export function splitShortLinks(
  text: string,
  resolvedCodes?: ReadonlySet<string>,
): { displayText: string; codes: string[] } {
  const split = splitTrackedLinks(text, SHORT_PREFIX_RE, SHORT_CODE_RE, 8, resolvedCodes);
  return { displayText: split.displayText, codes: split.ids };
}
