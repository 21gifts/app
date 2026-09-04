import type { ReactElement, ReactNode } from 'react';
import { HandbookCopyLink } from '@/components/HandbookCopyLink';
import { HandbookFigure } from '@/components/HandbookFigure';

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
  1: 'scroll-mt-24 mt-10 mb-3 text-3xl font-semibold first:mt-0',
  2: 'scroll-mt-24 mt-8 mb-2 text-xl font-semibold text-accent',
  3: 'scroll-mt-24 mt-6 mb-2 text-lg font-semibold',
  4: 'scroll-mt-24 mt-4 mb-2 text-base font-semibold',
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
    if (target === 'screens' || target === 'functions' || target === 'endpoints') {
      const page = `/handbook/${target}`;
      if (md[2] !== undefined) {
        const frag = slug(md[2]);
        return frag === '' ? page : `${page}#${target}-${frag}`;
      }
      return page;
    }
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
  const usedIds = new Set<string>();
  let inList = false;
  let para: string[] = [];
  let listItems: HandbookInline[][] = [];

  const uniqueHeadingId = (text: string): string => {
    const base = `${idPrefix}-${slug(text)}`;
    let id = base;
    let n = 2;
    while (usedIds.has(id)) {
      id = `${base}-${n}`;
      n += 1;
    }
    usedIds.add(id);
    return id;
  };

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
        id: uniqueHeadingId(text),
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
      <code key={key} className="rounded bg-paper/10 px-1 py-0.5 text-[0.9em] text-paper">
        {inline.value}
      </code>
    );
  }
  if (inline.type === 'strong') {
    return <strong key={key}>{inline.value}</strong>;
  }
  if (inline.type === 'link') {
    return (
      <a key={key} href={inline.href} className="text-accent underline underline-offset-2">
        {inline.children}
      </a>
    );
  }
  return (
    <img
      key={key}
      src={inline.src}
      alt={inline.alt}
      className="my-3 max-w-xl rounded-lg border border-paper/10"
    />
  );
}

/**
 * Flatten heading inlines to a label for the copy-link aria name.
 *
 * @param inlines - Parsed heading inlines.
 * @returns Concatenated plain text.
 */
function headingPlainText(inlines: HandbookInline[]): string {
  return inlines
    .map((inline) => {
      if (inline.type === 'link') {
        return inline.children;
      }
      if (inline.type === 'img') {
        return inline.alt;
      }
      return inline.value;
    })
    .join('');
}

/**
 * Heading plus sibling copy-link button (button stays outside the heading).
 *
 * @param props - Level, id, class, and inlines.
 * @returns A flex row.
 */
function HeadingWithCopy({
  level,
  id,
  className,
  inlines,
}: {
  level: 1 | 2 | 3 | 4;
  id: string;
  className: string;
  inlines: HandbookInline[];
}): ReactElement {
  const label = headingPlainText(inlines);
  const children = inlines.map((inline, i) => renderInline(inline, i));
  let heading: ReactElement;
  if (level === 1) {
    heading = (
      <h1 id={id} className={className}>
        {children}
      </h1>
    );
  } else if (level === 2) {
    heading = (
      <h2 id={id} className={className}>
        {children}
      </h2>
    );
  } else if (level === 3) {
    heading = (
      <h3 id={id} className={className}>
        {children}
      </h3>
    );
  } else {
    heading = (
      <h4 id={id} className={className}>
        {children}
      </h4>
    );
  }
  return (
    <div className="flex flex-wrap items-baseline gap-2">
      {heading}
      <HandbookCopyLink targetId={id} label={label} />
    </div>
  );
}

/**
 * Render parsed handbook markdown as Tailwind-styled elements. Every heading
 * has a sibling copy-link button that copies the absolute `#id` URL. A
 * paragraph whose only inline is an image becomes a {@link HandbookFigure}
 * (thumbnail, lightbox, deep link) instead of `<p><img>`.
 *
 * @param markdown - Raw markdown.
 * @param idPrefix - Prefix for heading ids.
 * @returns A fragment of headings, paragraphs, figures, and lists.
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
          return (
            <HeadingWithCopy
              key={index}
              level={block.level}
              id={block.id}
              className={HEADING_CLASS[block.level]}
              inlines={block.inlines}
            />
          );
        }
        if (block.type === 'paragraph') {
          const only = block.inlines[0];
          if (block.inlines.length === 1 && only !== undefined && only.type === 'img') {
            const figureId = `${idPrefix}-image-${slug(only.alt)}`;
            return (
              <HandbookFigure
                key={index}
                id={figureId}
                label={only.alt}
                description={only.alt}
                src={only.src}
                alt={only.alt}
              />
            );
          }
          return (
            <p key={index} className="mt-2 mb-4 text-paper/60">
              {block.inlines.map((inline, i) => renderInline(inline, i))}
            </p>
          );
        }
        return (
          <ul key={index} className="mb-4 ml-5 list-disc text-paper/60">
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
