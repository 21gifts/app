#!/usr/bin/env node
/**
 * Fail if production source adds a second layout scrollport.
 * globals.css may scroll in two places only: `overflow-x: clip` and
 * `overflow-y: auto` on `[data-scrollport][data-scroll-active]` (not the
 * shorthand `overflow: auto`), and `overflow-x: auto` with
 * `overflow-y: clip` on `[data-scroll-x]`. Anything else is a second
 * page scroll.
 * Run from the repo root. No extra packages.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const SRC = path.join(ROOT, 'src');
const CLASS_BANNED =
  /overflow-(?:x-|y-)?(?:auto|scroll|overlay)\b|overflow-\[(?:auto|scroll|overlay)\]|overflow-(?:x|y)-\[(?:auto|scroll|overlay)\]/;
const STYLE_BANNED =
  /overflow(?:-x|-y|X|Y)?\s*:\s*['"]?(?:auto|scroll|overlay)\b|overflow(?:X|Y)?\s*=\s*['"](?:auto|scroll|overlay)['"]|setProperty\(\s*['"]overflow(?:-x|-y)?['"]\s*,\s*['"](?:auto|scroll|overlay)['"]/;

/**
 * @param {string} dir
 * @param {string[]} acc
 * @returns {string[]}
 */
function walk(dir, acc = []) {
  if (!fs.existsSync(dir)) {
    return acc;
  }
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (ent.name === 'node_modules' || ent.name === '__tests__' || ent.name === '.next') {
        continue;
      }
      walk(p, acc);
    } else if (
      /\.(tsx|ts|css)$/.test(ent.name) &&
      !ent.name.endsWith('.test.ts') &&
      !ent.name.endsWith('.test.tsx')
    ) {
      acc.push(p);
    }
  }
  return acc;
}

/**
 * @param {string} line
 * @returns {boolean}
 */
function bannedLine(line) {
  return CLASS_BANNED.test(line) || STYLE_BANNED.test(line);
}

const SCROLL_TOKEN = new Set(['auto', 'scroll', 'overlay']);
const ACTIVE_SELECTOR = '[data-scrollport][data-scroll-active]';
const ROW_SELECTOR = '[data-scroll-x]';

/**
 * @param {string} css
 * @returns {string}
 */
function stripCssComments(css) {
  // A space, not empty: `clip/**/auto` must stay two tokens.
  return css.replace(/\/\*[\s\S]*?\*\//g, ' ');
}

/**
 * Leaf style rules. A grouped selector stays one string, so a comma before
 * the active port is not the active port.
 *
 * @param {string} css
 * @returns {{ selector: string, body: string }[]}
 */
function leafRules(css) {
  /** @type {{ selector: string, bodyStart: number }[]} */
  const stack = [];
  /** @type {{ selector: string, body: string }[]} */
  const rules = [];
  let last = 0;
  for (let i = 0; i < css.length; i += 1) {
    const ch = css[i];
    if (ch === '{') {
      stack.push({ selector: css.slice(last, i), bodyStart: i + 1 });
      last = i + 1;
    } else if (ch === '}' && stack.length > 0) {
      const frame = stack.pop();
      if (frame) {
        const body = css.slice(frame.bodyStart, i);
        if (!body.includes('{')) {
          rules.push({ selector: frame.selector.trim(), body });
        }
      }
      last = i + 1;
    }
  }
  return rules;
}

/**
 * @param {string} body
 * @returns {{ prop: string, tokens: string[] }[]}
 */
function scrollingDecls(body) {
  /** @type {{ prop: string, tokens: string[] }[]} */
  const found = [];
  // Not `--overflow`: the name must not continue an identifier.
  const re = /(?:^|[^-\w])(overflow(?:-x|-y)?)\s*:\s*([^;]+)/gi;
  let match = re.exec(body);
  while (match) {
    const tokens = valueTokens(match[2]);
    if (tokens.some((token) => SCROLL_TOKEN.has(token))) {
      found.push({ prop: match[1].toLowerCase(), tokens });
    }
    match = re.exec(body);
  }
  return found;
}

/**
 * @param {string} raw
 * @returns {string[]}
 */
function valueTokens(raw) {
  return raw
    .replace(/\s*!important\b/gi, '')
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter((token) => token !== '');
}

/**
 * Every overflow declaration, including clip, hidden, and visible.
 *
 * @param {string} body
 * @returns {{ prop: string, tokens: string[] }[]}
 */
function allOverflowDecls(body) {
  /** @type {{ prop: string, tokens: string[] }[]} */
  const found = [];
  const re = /(?:^|[^-\w])(overflow(?:-x|-y)?)\s*:\s*([^;]+)/gi;
  let match = re.exec(body);
  while (match) {
    found.push({ prop: match[1].toLowerCase(), tokens: valueTokens(match[2]) });
    match = re.exec(body);
  }
  return found;
}

/**
 * @param {{ prop: string, tokens: string[] }[]} actual
 * @param {{ prop: string, tokens: string[] }[]} expected
 * @returns {boolean}
 */
function sameDecls(actual, expected) {
  const key = (decl) => `${decl.prop}:${decl.tokens.join(' ')}`;
  const left = actual.map(key).sort();
  const right = expected.map(key).sort();
  return left.length === right.length && left.every((item, index) => item === right[index]);
}

/**
 * One page rule and one sideways rule, each with exactly its allowed values.
 * A later rule with the same selector is rejected, even when it only sets
 * hidden or visible. Any other rule may not scroll.
 *
 * @param {string} css
 * @returns {string | null}
 */
function globalsScrollProblem(css) {
  const rules = leafRules(stripCssComments(css));
  const pages = rules.filter((rule) => rule.selector === ACTIVE_SELECTOR);
  const rows = rules.filter((rule) => rule.selector === ROW_SELECTOR);
  const page = pages[0];
  const row = rows[0];
  const pageOk =
    pages.length === 1 &&
    page !== undefined &&
    sameDecls(allOverflowDecls(page.body), [
      { prop: 'overflow-x', tokens: ['clip'] },
      { prop: 'overflow-y', tokens: ['auto'] },
    ]);
  const rowOk =
    rows.length === 1 &&
    row !== undefined &&
    sameDecls(allOverflowDecls(row.body), [
      { prop: 'overflow-x', tokens: ['auto'] },
      { prop: 'overflow-y', tokens: ['clip'] },
    ]);
  const stray = rules.some(
    (rule) =>
      rule.selector !== ACTIVE_SELECTOR &&
      rule.selector !== ROW_SELECTOR &&
      scrollingDecls(rule.body).length > 0,
  );
  if (pageOk && rowOk && !stray) {
    return null;
  }
  return 'expected one overflow-x:clip and overflow-y:auto on [data-scrollport][data-scroll-active] and one overflow-x:auto with overflow-y:clip on [data-scroll-x]';
}

function selfTest() {
  const caught = [
    'className="overflow-y-auto"',
    'className="overflow-x-scroll"',
    'className="overflow-overlay"',
    'className="overflow-x-overlay"',
    'className="overflow-auto"',
    'className="overflow-[overlay]"',
    'className="overflow-y-[overlay]"',
    'className="overflow-[auto]"',
    'className="overflow-y-[scroll]"',
    'style={{ overflow: "scroll" }}',
    "el.style.overflow = 'auto'",
    "el.style.overflowY = 'overlay'",
    'el.style.setProperty("overflow", "auto")',
  ];
  const allowed = [
    'className="overflow-hidden"',
    'className="overflow-clip"',
    'overflow-anchor: none',
    'el.style.setProperty("overflow", "hidden", "important")',
  ];
  const problems = [];
  for (const line of caught) {
    CLASS_BANNED.lastIndex = 0;
    STYLE_BANNED.lastIndex = 0;
    if (!bannedLine(line)) {
      problems.push(`self-test missed: ${line}`);
    }
  }
  for (const line of allowed) {
    CLASS_BANNED.lastIndex = 0;
    STYLE_BANNED.lastIndex = 0;
    if (bannedLine(line)) {
      problems.push(`self-test false positive: ${line}`);
    }
  }
  const passSheet = `
    html, body { overflow: clip !important; }
    [data-scrollport] { overflow: clip !important; }
    [data-scrollport][data-scroll-active] { overflow-x: clip !important; overflow-y: auto !important; }
    [data-scroll-x] { overflow-x: auto !important; overflow-y: clip !important; }
    * { scroll-behavior: auto !important; }
    :root { --overflow: auto; }
    /* overflow: auto must not count inside a comment */
  `;
  const failSheets = [
    'body { overflow: auto } [data-scrollport] {}',
    '[data-scrollport][data-scroll-active] { overflow: auto } .x { overflow: scroll }',
    '[data-scrollport][data-scroll-active] { overflow-x: auto }',
    '[data-scrollport] { overflow: auto }',
    '[data-scrollport][data-scroll-active] { overflow: auto; overflow-y: scroll }',
    'html, body { overflow: clip }',
    '[data-scrollport][data-scroll-active] { overflow: auto } .x { overflow: clip auto }',
    '[data-scrollport][data-scroll-active] { overflow: auto } .x { overflow: hidden scroll }',
    '[data-scrollport][data-scroll-active] { overflow: auto } .x { overflow: visible overlay }',
    '.other, [data-scrollport][data-scroll-active] { overflow: auto }',
    '[data-scrollport][data-scroll-active] { overflow: auto clip }',
    '[data-scrollport][data-scroll-active] { overflow: auto } .x { overflow: clip/**/auto }',
    '[data-scrollport][data-scroll-active] { overflow: auto } .x { overflow: scroll!important }',
    '[data-scrollport][data-scroll-active] { overflow: scroll!important }',
    '[data-scrollport][data-scroll-active] { overflow: auto } [data-scroll-x] { overflow-x: auto }',
    '[data-scrollport][data-scroll-active] { overflow: auto } .x, [data-scroll-x] { overflow-x: auto; overflow-y: clip }',
    '[data-scrollport][data-scroll-active] { overflow: auto } [data-scroll-x] { overflow-x: auto; overflow-y: auto }',
    '[data-scrollport][data-scroll-active] { overflow: auto } [data-scroll-x] { overflow-x: auto; overflow-y: clip } [data-scroll-x] { overflow-y: visible !important }',
    '[data-scrollport][data-scroll-active] { overflow: auto } [data-scrollport][data-scroll-active] { overflow: hidden } [data-scroll-x] { overflow-x: auto; overflow-y: clip }',
    '[data-scrollport][data-scroll-active] { overflow: auto; overflow: hidden } [data-scroll-x] { overflow-x: auto; overflow-y: clip }',
    '[data-scrollport][data-scroll-active] { overflow: auto } [data-scroll-x] { overflow-x: auto; overflow-y: clip; overflow-y: visible }',
    '[data-scrollport][data-scroll-active] { overflow: auto } [data-scroll-x] { overflow-x: auto; overflow-y: clip } .x { overflow: AUTO }',
    '[data-scrollport][data-scroll-active] { overflow: auto } [data-scroll-x] { overflow-x: auto; overflow-y: clip } .x { OVERFLOW: auto }',
    '[data-scrollport][data-scroll-active] { overflow: auto } [data-scroll-x] { overflow-x: auto; overflow-y: clip }',
  ];
  const gluedImportant = `
    [data-scrollport][data-scroll-active] { overflow-x:clip!important; overflow-y:auto!important; }
    [data-scroll-x] { overflow-x:auto!important; overflow-y:clip!important; }
    :root { --overflow: auto; }
  `;
  if (globalsScrollProblem(passSheet) !== null || globalsScrollProblem(gluedImportant) !== null) {
    problems.push('self-test globals false positive');
  }
  for (const sheet of failSheets) {
    if (globalsScrollProblem(sheet) === null) {
      problems.push(`self-test globals missed: ${sheet}`);
    }
  }
  if (problems.length > 0) {
    console.error('SCROLLPORT: detector self-test failed');
    for (const line of problems) {
      console.error(line);
    }
    process.exit(1);
  }
}

selfTest();

const failures = [];

for (const file of walk(SRC)) {
  const rel = path.relative(ROOT, file);
  const text = fs.readFileSync(file, 'utf8');
  const lines = text.split('\n');
  if (rel === 'src/app/globals.css') {
    const sheet = globalsScrollProblem(text);
    if (sheet !== null) {
      failures.push(`${rel}: ${sheet}`);
    }
    if (
      !/html,\s*\nbody\s*\{[^}]*overflow:\s*clip/s.test(text) &&
      !/html,\s*body\s*\{[^}]*overflow:\s*clip/s.test(text)
    ) {
      failures.push(`${rel}: html and body must be overflow:clip`);
    }
    lines.forEach((line, index) => {
      CLASS_BANNED.lastIndex = 0;
      STYLE_BANNED.lastIndex = 0;
      if (CLASS_BANNED.test(line)) {
        failures.push(`${rel}:${index + 1}: banned overflow utility`);
      }
    });
    continue;
  }
  lines.forEach((line, index) => {
    CLASS_BANNED.lastIndex = 0;
    STYLE_BANNED.lastIndex = 0;
    if (CLASS_BANNED.test(line) || STYLE_BANNED.test(line)) {
      failures.push(`${rel}:${index + 1}: ${line.trim()}`);
    }
  });
}

if (failures.length > 0) {
  console.error('SCROLLPORT: more than one scroll surface is forbidden');
  for (const line of failures) {
    console.error(line);
  }
  process.exit(1);
}
