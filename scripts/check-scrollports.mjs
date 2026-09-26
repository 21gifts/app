#!/usr/bin/env node
/**
 * Fail if production source adds a second layout scrollport.
 * The only scrolling declaration in globals.css is `overflow: auto` on
 * `[data-scrollport][data-scroll-active]`. Any other auto, scroll, or
 * overlay overflow there is a second scrollport.
 * Run from the repo root. No extra packages.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const SRC = path.join(ROOT, 'src');
const CLASS_BANNED =
  /overflow-(?:x-|y-)?(?:auto|scroll)\b|overflow-\[(?:auto|scroll)\]|overflow-(?:x|y)-\[(?:auto|scroll)\]/;
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

/**
 * @param {string} css
 * @returns {string}
 */
function stripCssComments(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
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
  const re = /(overflow(?:-x|-y)?)\s*:\s*([^;]+)/g;
  let match = re.exec(body);
  while (match) {
    const tokens = match[2]
      .trim()
      .split(/\s+/)
      .filter((token) => token !== '!important');
    if (tokens.some((token) => SCROLL_TOKEN.has(token))) {
      found.push({ prop: match[1], tokens });
    }
    match = re.exec(body);
  }
  return found;
}

/**
 * The one allowed scrolling declaration is `overflow: auto` on exactly
 * `[data-scrollport][data-scroll-active]`. A second value (`clip auto`),
 * another axis, or the same declaration on a grouped selector is a second
 * scrollport.
 *
 * @param {string} css
 * @returns {string | null}
 */
function globalsScrollProblem(css) {
  const hits = [];
  for (const rule of leafRules(stripCssComments(css))) {
    for (const decl of scrollingDecls(rule.body)) {
      hits.push({ selector: rule.selector, prop: decl.prop, tokens: decl.tokens });
    }
  }
  const only = hits[0];
  if (
    hits.length === 1 &&
    only &&
    only.selector === ACTIVE_SELECTOR &&
    only.prop === 'overflow' &&
    only.tokens.length === 1 &&
    only.tokens[0] === 'auto'
  ) {
    return null;
  }
  return 'expected exactly one overflow:auto on [data-scrollport][data-scroll-active]';
}

function selfTest() {
  const caught = [
    'className="overflow-y-auto"',
    'className="overflow-x-scroll"',
    'className="overflow-auto"',
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
    [data-scrollport][data-scroll-active] { overflow: auto !important; }
    * { scroll-behavior: auto !important; }
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
  ];
  if (globalsScrollProblem(passSheet) !== null) {
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
