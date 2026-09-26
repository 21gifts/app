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
const CLASS_BANNED = /overflow-(?:x|y)-auto|overflow-(?:x|y)-scroll|overflow-auto|overflow-scroll/;
const STYLE_BANNED = /overflow(?:X|Y)?\s*:\s*['"]?(?:auto|scroll)\b/;

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
      !/html,\s*\nbody\s*\{[^}]*overflow:\s*hidden/s.test(text) &&
      !/html,\s*body\s*\{[^}]*overflow:\s*hidden/s.test(text)
    ) {
      failures.push(`${rel}: html and body must be overflow:hidden`);
    }
    lines.forEach((line, index) => {
      if (CLASS_BANNED.test(line)) {
        failures.push(`${rel}:${index + 1}: banned overflow utility`);
      }
    });
    continue;
  }
  lines.forEach((line, index) => {
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
