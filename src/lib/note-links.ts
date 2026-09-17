/** Canonical 21.gifts app hosts that skip the external-link warning. */
const INTERNAL_HOSTS = new Set(['21.gifts', 'www.21.gifts']);

const PREFIX_RE = /https?:\/\//gi;

/** One run of a note body: plain text or a parsed http(s) URL. */
export type NoteLinkSegment =
  | { kind: 'text'; value: string }
  | { kind: 'url'; href: string; value: string; internal: boolean; path: string };

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

function normalizeHostname(hostname: string): string {
  return hostname.replace(/\.$/u, '').toLowerCase();
}

function navigationPath(url: URL): string {
  const pathname = url.pathname.replace(/^\/+/u, '/');
  return `${pathname}${url.search}${url.hash}`;
}

/**
 * True when `href` is an in-app 21.gifts URL.
 *
 * @param href - Absolute http(s) URL.
 * @param currentOrigin - Optional page origin (`window.location.origin`).
 * @returns Whether in-app navigation should skip the warning.
 */
export function isInternalAppUrl(href: string, currentOrigin?: string): boolean {
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return false;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return false;
  }
  const host = normalizeHostname(url.hostname);
  if (INTERNAL_HOSTS.has(host)) {
    return true;
  }
  if (currentOrigin === undefined || currentOrigin === '') {
    return false;
  }
  try {
    const origin = new URL(currentOrigin);
    return host === normalizeHostname(origin.hostname);
  } catch {
    return false;
  }
}

/**
 * Split `text` into plain runs and http(s) URLs.
 *
 * @param text - Raw display body.
 * @param currentOrigin - Optional page origin (`window.location.origin`). Host
 *   of this origin is also treated as internal (e2e localhost).
 * @returns Segments covering `text` in order.
 */
export function splitNoteLinks(text: string, currentOrigin?: string): NoteLinkSegment[] {
  const segments: NoteLinkSegment[] = [];
  const prefixRe = new RegExp(PREFIX_RE.source, PREFIX_RE.flags);
  let cursor = 0;
  let prefixMatch: RegExpExecArray | null;
  while ((prefixMatch = prefixRe.exec(text)) !== null) {
    const start = prefixMatch.index;
    let end = start;
    while (end < text.length && !isWhitespace(text[end] as string)) {
      end += 1;
    }
    while (end > start && isProsePunctuation(text[end - 1] as string)) {
      end -= 1;
    }
    const candidate = text.slice(start, end);
    if (candidate.length <= prefixMatch[0].length) {
      prefixRe.lastIndex = start + 1;
      continue;
    }
    let parsed: URL;
    try {
      parsed = new URL(candidate);
    } catch {
      prefixRe.lastIndex = start + 1;
      continue;
    }
    /* v8 ignore next 4 -- PREFIX_RE only matches http(s), kept as a protocol guard */
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      prefixRe.lastIndex = start + 1;
      continue;
    }
    if (start > cursor) {
      segments.push({ kind: 'text', value: text.slice(cursor, start) });
    }
    const href = parsed.href;
    const internal =
      currentOrigin === undefined ? isInternalAppUrl(href) : isInternalAppUrl(href, currentOrigin);
    segments.push({
      kind: 'url',
      href,
      value: candidate,
      internal,
      path: navigationPath(parsed),
    });
    cursor = end;
    prefixRe.lastIndex = end;
  }
  if (cursor < text.length) {
    segments.push({ kind: 'text', value: text.slice(cursor) });
  }
  return segments;
}
