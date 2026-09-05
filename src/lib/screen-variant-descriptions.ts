/**
 * Unwrap markdown bold markers and inline-code backticks to plain text.
 *
 * @param text - Raw paragraph text.
 * @returns Plain text without those markers.
 */
function unwrapInlineMarkup(text: string): string {
  return text.replace(/\*\*([^*]+)\*\*/g, '$1').replace(/`([^`]+)`/g, '$1');
}

/**
 * True when the line is only a markdown image (`![…](…)`), optionally padded.
 *
 * @param line - One markdown body line.
 * @returns Whether the line should be excluded from the description.
 */
function isImageOnlyLine(line: string): boolean {
  return /^!\[[^\]]*\]\([^)]+\)\s*$/.test(line.trim());
}

/**
 * Build a description from collected variant body lines.
 *
 * @param body - Lines between a `### Variant:` heading and the next heading.
 * @returns Joined paragraphs, or an empty string when nothing remains.
 */
function bodyToDescription(body: readonly string[]): string {
  const paragraphs: string[] = [];
  let current: string[] = [];
  const flushPara = (): void => {
    if (current.length === 0) {
      return;
    }
    const text = unwrapInlineMarkup(current.join(' ')).trim();
    if (text !== '') {
      paragraphs.push(text);
    }
    current = [];
  };

  for (const line of body) {
    if (line === '') {
      flushPara();
      continue;
    }
    if (isImageOnlyLine(line)) {
      continue;
    }
    current.push(line);
  }
  flushPara();
  return paragraphs.join('\n\n');
}

/**
 * Parse `docs/handbook/screens.md` into a map of catalog topic id → description.
 *
 * Keys match the screen-variant catalog (`/:default`, `/welcome:pay-qr`, …).
 * Descriptions are the paragraphs under each `### Variant:` heading (English
 * handbook body; catalog exception), excluding image-only lines, with
 * bold and inline-code markers unwrapped. Empty descriptions are omitted.
 *
 * @param markdown - Raw screens handbook markdown.
 * @returns Readonly map of `<path>:<variantId>` → description text.
 */
export function parseScreenVariantDescriptions(markdown: string): ReadonlyMap<string, string> {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const result = new Map<string, string>();
  let path: string | null = null;
  let variant: string | null = null;
  let body: string[] = [];

  const flush = (): void => {
    if (path !== null && variant !== null) {
      const description = bodyToDescription(body);
      if (description !== '') {
        result.set(`${path}:${variant}`, description);
      }
    }
    body = [];
  };

  for (const raw of lines) {
    const line = raw.replace(/\s+$/, '');
    const screen = /^## Screen:\s+(.+)$/.exec(line);
    if (screen !== null) {
      flush();
      /* v8 ignore next — noUncheckedIndexedAccess; group always present when matched */
      path = (screen[1] ?? '').trim();
      variant = null;
      continue;
    }
    const variantHeading = /^### Variant:\s+(.+)$/.exec(line);
    if (variantHeading !== null) {
      flush();
      /* v8 ignore next — noUncheckedIndexedAccess; group always present when matched */
      variant = (variantHeading[1] ?? '').trim();
      continue;
    }
    if (/^#{1,6}\s+/.test(line)) {
      flush();
      variant = null;
      if (/^##\s+/.test(line)) {
        path = null;
      }
      continue;
    }
    if (variant !== null) {
      body.push(line);
    }
  }
  flush();
  return result;
}
