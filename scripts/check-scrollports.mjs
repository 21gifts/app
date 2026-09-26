#!/usr/bin/env node
/**
 * Fail if production source adds a second layout scrollport.
 * Overflow auto/scroll is allowed only on `[data-scrollport]` in globals.css.
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
    const auto = text.match(/overflow:\s*auto/g) ?? [];
    if (auto.length !== 1 || !text.includes('[data-scrollport]')) {
      failures.push(`${rel}: expected exactly one overflow:auto rule on [data-scrollport]`);
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
      if (/overflow:\s*(?:scroll|overlay)\b/.test(line)) {
        failures.push(`${rel}:${index + 1}: only one overflow:auto scrollport is allowed`);
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
