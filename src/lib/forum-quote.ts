const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PREFIX_RE = /https?:\/\/[^\s/]+\/messages\//gi;
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

type QuoteMatch = { start: number; end: number; id: string };

function collectQuoteMatches(text: string): QuoteMatch[] {
  const matches: QuoteMatch[] = [];
  const prefixRe = new RegExp(PREFIX_RE.source, PREFIX_RE.flags);
  let prefixMatch: RegExpExecArray | null;
  while ((prefixMatch = prefixRe.exec(text)) !== null) {
    const idStart = prefixMatch.index + prefixMatch[0].length;
    const idSlice = text.slice(idStart, idStart + 36);
    if (!UUID_RE.test(idSlice)) {
      continue;
    }
    let end = idStart + 36;
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
      end += 1;
      while (end < text.length && !isWhitespace(text[end] as string)) {
        end += 1;
      }
    }
    matches.push({ start: prefixMatch.index, end, id: idSlice.toLowerCase() });
  }
  return matches;
}

function uniqueFirstSeenIds(matches: readonly QuoteMatch[]): string[] {
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

function stripMatches(text: string, toStrip: readonly QuoteMatch[]): string {
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
  const matches = collectQuoteMatches(text);
  const ids = uniqueFirstSeenIds(matches);
  const resolved =
    resolvedIds === undefined ? undefined : new Set([...resolvedIds].map((id) => id.toLowerCase()));
  const toStrip =
    resolved === undefined ? matches : matches.filter((match) => resolved.has(match.id));
  return { displayText: stripMatches(text, toStrip), ids };
}
