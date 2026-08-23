import type { ReactElement, ReactNode } from 'react';

/** Inline node produced by `parseHandbookMarkdown`. */
export type HandbookInline =
  | { type: 'text'; value: string }
  | { type: 'code'; value: string }
  | { type: 'strong'; value: string }
  | { type: 'link'; href: string; children: string }
  | { type: 'img'; src: string; alt: string };

/** Block node produced by `parseHandbookMarkdown`. */
export type HandbookBlock =
  | { type: 'heading'; level: 1 | 2 | 3 | 4; id: string; inlines: HandbookInline[] }
  | { type: 'paragraph'; inlines: HandbookInline[] }
  | { type: 'list'; items: HandbookInline[][] };

const HEADING_CLASS: Record<1 | 2 | 3 | 4, string> = {
  1: 'mt-10 mb-3 text-3xl font-semibold first:mt-0',
  2: 'mt-8 mb-2 text-xl font-semibold text-[#f7931a]',
  3: 'mt-6 mb-2 text-lg font-semibold',
  4: 'mt-4 mb-2 text-base font-semibold',
};

/**
 * Slug a heading or fragment for in-page ids.
 *
 * @param text - Raw heading or fragment text.
 * @returns Lowercase hyphenated id, or an empty string when nothing remains.
 */
function slug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Resolve a markdown href into a safe in-page, absolute, or image URL.
 *
 * @param rawHref - Raw `(…)` target.
 * @param idPrefix - Prefix for in-page hashes (`readme`, `screens`, …).
 * @returns A usable href, or `null` when the target must be dropped.
 */
function resolveHref(rawHref: string, idPrefix: string): string | null {
  const href = rawHref.trim();
  if (href.includes('..')) {
    return null;
  }
  const md = /^\.?\/?([^#/]+)\.md(?:#(.+))?$/i.exec(href);
  if (md !== null && md[1] !== undefined) {
    const target = slug(md[1]);
    if (md[2] !== undefined) {
      const frag = slug(md[2]);
      return frag === '' ? `#${target}` : `#${target}-${frag}`;
    }
    return `#${target}`;
  }
  if (href.startsWith('#')) {
    const frag = slug(href.slice(1));
    return frag === '' ? `#${idPrefix}` : `#${idPrefix}-${frag}`;
  }
  const lower = href.toLowerCase();
  if (lower.startsWith('https:') || lower.startsWith('http:') || href.startsWith('/')) {
    return href;
  }
  if (/\.(png|jpe?g|gif|svg|webp)$/i.test(href)) {
    const rel = href.replace(/^\.\//, '');
    if (rel.startsWith('images/')) {
      const nested = rel.slice('images/'.length);
      const slash = nested.lastIndexOf('/');
      const basename = slash < 0 ? nested : nested.slice(slash + 1);
      return `/handbook-images/${basename}`;
    }
    if (rel.startsWith('assets/')) {
      return `/${rel}`;
    }
  }
  return null;
}

/**
 * Split remaining text into text, code, and strong inlines.
 *
 * @param s - Text that may contain backtick code spans and `**strong**`.
 * @returns Inline nodes (empty when `s` is empty).
 */
function formatText(s: string): HandbookInline[] {
  const out: HandbookInline[] = [];
  const codeRe = /`([^`]+)`/g;
  let last = 0;
  let m: RegExpExecArray | null = codeRe.exec(s);
  while (m !== null) {
    if (m.index > last) {
      out.push(...parseStrong(s.slice(last, m.index)));
    }
    /* v8 ignore next — noUncheckedIndexedAccess; group always present when matched */
    const value = m[1] ?? '';
    out.push({ type: 'code', value });
    last = m.index + m[0].length;
    m = codeRe.exec(s);
  }
  if (last < s.length) {
    out.push(...parseStrong(s.slice(last)));
  }
  return out;
}

/**
 * Split text on `**strong**` spans.
 *
 * @param s - Text that may contain bold markers.
 * @returns Inline nodes.
 */
function parseStrong(s: string): HandbookInline[] {
  const out: HandbookInline[] = [];
  const re = /\*\*([^*]+)\*\*/g;
  let last = 0;
  let m: RegExpExecArray | null = re.exec(s);
  while (m !== null) {
    if (m.index > last) {
      out.push({ type: 'text', value: s.slice(last, m.index) });
    }
    /* v8 ignore next — noUncheckedIndexedAccess; group always present when matched */
    const value = m[1] ?? '';
    out.push({ type: 'strong', value });
    last = m.index + m[0].length;
    m = re.exec(s);
  }
  if (last < s.length) {
    out.push({ type: 'text', value: s.slice(last) });
  }
  return out;
}

/**
 * Parse a line of markdown into inlines, including links and images.
 *
 * @param s - One paragraph, heading, or list-item string.
 * @param idPrefix - Prefix for in-page hashes.
 * @returns Inline nodes.
 */
function parseInlines(s: string, idPrefix: string): HandbookInline[] {
  const re = /(!?)\[([^\]]*)\]\(([^)]+)\)/g;
  const out: HandbookInline[] = [];
  let last = 0;
  let m: RegExpExecArray | null = re.exec(s);
  while (m !== null) {
    if (m.index > last) {
      out.push(...formatText(s.slice(last, m.index)));
    }
    // Capture groups 2 (`[alt]`) and 3 (`(href)`) are required by the regex.
    /* v8 ignore next 2 — noUncheckedIndexedAccess; groups are always present */
    const alt = m[2] ?? '';
    const target = m[3] ?? '';
    const safe = resolveHref(target, idPrefix);
    if (m[1] === '!') {
      if (safe === null) {
        out.push(...formatText(alt));
      } else {
        out.push({ type: 'img', src: safe, alt });
      }
    } else if (safe === null) {
      out.push(...formatText(alt));
    } else {
      out.push({ type: 'link', href: safe, children: alt });
    }
    last = m.index + m[0].length;
    m = re.exec(s);
  }
  if (last < s.length) {
    out.push(...formatText(s.slice(last)));
  }
  return out;
}

/**
 * Parse handbook markdown into a small block list (headings, paragraphs, lists).
 *
 * @param markdown - Raw markdown from `docs/handbook/`.
 * @param idPrefix - Prefix for heading ids (`readme`, `screens`, …).
 * @returns Block list, empty when `markdown` is blank.
 */
export function parseHandbookMarkdown(markdown: string, idPrefix: string): HandbookBlock[] {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const blocks: HandbookBlock[] = [];
  let inList = false;
  let para: string[] = [];
  let listItems: HandbookInline[][] = [];

  const flushPara = (): void => {
    if (para.length > 0) {
      blocks.push({ type: 'paragraph', inlines: parseInlines(para.join(' '), idPrefix) });
      para = [];
    }
  };

  const closeList = (): void => {
    flushPara();
    if (inList) {
      blocks.push({ type: 'list', items: listItems });
      listItems = [];
      inList = false;
    }
  };

  for (const raw of lines) {
    const line = raw.replace(/\s+$/, '');
    if (line === '') {
      closeList();
      continue;
    }
    const heading = /^(#{1,4})\s+(.*)$/.exec(line);
    if (heading !== null && heading[1] !== undefined && heading[2] !== undefined) {
      closeList();
      const level = heading[1].length as 1 | 2 | 3 | 4;
      const text = heading[2];
      blocks.push({
        type: 'heading',
        level,
        id: `${idPrefix}-${slug(text)}`,
        inlines: parseInlines(text, idPrefix),
      });
      continue;
    }
    if (line.startsWith('- ')) {
      flushPara();
      if (!inList) {
        inList = true;
        listItems = [];
      }
      listItems.push(parseInlines(line.slice(2), idPrefix));
      continue;
    }
    if (inList) {
      blocks.push({ type: 'list', items: listItems });
      listItems = [];
      inList = false;
    }
    para.push(line);
  }
  closeList();
  return blocks;
}

/**
 * Render one inline node.
 *
 * @param inline - Parsed inline.
 * @param key - React key.
 * @returns Text or an element.
 */
function renderInline(inline: HandbookInline, key: number): ReactNode {
  if (inline.type === 'text') {
    return inline.value;
  }
  if (inline.type === 'code') {
    return (
      <code key={key} className="rounded bg-white/10 px-1 py-0.5 text-[0.9em] text-white">
        {inline.value}
      </code>
    );
  }
  if (inline.type === 'strong') {
    return <strong key={key}>{inline.value}</strong>;
  }
  if (inline.type === 'link') {
    return (
      <a key={key} href={inline.href} className="text-[#f7931a] underline underline-offset-2">
        {inline.children}
      </a>
    );
  }
  return (
    <img
      key={key}
      src={inline.src}
      alt={inline.alt}
      className="my-3 max-w-xl rounded-lg border border-white/10"
    />
  );
}

/**
 * Render parsed handbook markdown as Tailwind-styled elements.
 *
 * @param markdown - Raw markdown.
 * @param idPrefix - Prefix for heading ids.
 * @returns A fragment of headings, paragraphs, and lists.
 */
export function HandbookMarkdown({
  markdown,
  idPrefix,
}: {
  markdown: string;
  idPrefix: string;
}): ReactElement {
  const blocks = parseHandbookMarkdown(markdown, idPrefix);
  return (
    <>
      {blocks.map((block, index) => {
        if (block.type === 'heading') {
          const className = HEADING_CLASS[block.level];
          if (block.level === 1) {
            return (
              <h1 key={index} id={block.id} className={className}>
                {block.inlines.map((inline, i) => renderInline(inline, i))}
              </h1>
            );
          }
          if (block.level === 2) {
            return (
              <h2 key={index} id={block.id} className={className}>
                {block.inlines.map((inline, i) => renderInline(inline, i))}
              </h2>
            );
          }
          if (block.level === 3) {
            return (
              <h3 key={index} id={block.id} className={className}>
                {block.inlines.map((inline, i) => renderInline(inline, i))}
              </h3>
            );
          }
          return (
            <h4 key={index} id={block.id} className={className}>
              {block.inlines.map((inline, i) => renderInline(inline, i))}
            </h4>
          );
        }
        if (block.type === 'paragraph') {
          return (
            <p key={index} className="mt-2 mb-4 text-white/60">
              {block.inlines.map((inline, i) => renderInline(inline, i))}
            </p>
          );
        }
        return (
          <ul key={index} className="mb-4 ml-5 list-disc text-white/60">
            {block.items.map((item, itemIndex) => (
              <li key={itemIndex} className="mt-1">
                {item.map((inline, i) => renderInline(inline, i))}
              </li>
            ))}
          </ul>
        );
      })}
    </>
  );
}
