#!/usr/bin/env node
/**
 * Fail if production source adds a second back control or a fixed parent.
 * Run from the repo root. No extra packages.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const SRC = path.join(ROOT, 'src');
const LUCIDE_IMPORT = /import\s+[\s\S]*?from\s+['"]lucide-react['"]/g;

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
    } else if (/\.(tsx|ts)$/.test(ent.name) && !ent.name.endsWith('.d.ts')) {
      acc.push(p);
    }
  }
  return acc;
}

/**
 * @param {string} rel
 * @returns {boolean}
 */
function allowsArrowLeftImport(rel) {
  return rel.endsWith('ProfileChromeLeft.tsx') || rel.endsWith('RulesSetup.tsx');
}

/**
 * @param {string} source
 * @returns {boolean}
 */
function importsLucideArrowLeft(source) {
  LUCIDE_IMPORT.lastIndex = 0;
  let match;
  while ((match = LUCIDE_IMPORT.exec(source))) {
    if (/\bArrowLeft\b/.test(match[0])) {
      return true;
    }
  }
  return false;
}

const files = walk(SRC);
const failures = [];

for (const file of files) {
  const rel = path.relative(ROOT, file).replaceAll('\\', '/');
  const source = fs.readFileSync(file, 'utf8');
  if (importsLucideArrowLeft(source) && !allowsArrowLeftImport(rel)) {
    failures.push(
      `${rel}: lucide-react ArrowLeft is only allowed in ProfileChromeLeft and RulesSetup`,
    );
  }
  if (source.includes('backHref')) {
    failures.push(`${rel}: backHref is forbidden`);
  }
  if (source.includes('rules.forumCta') && rel !== 'src/lib/messages.ts') {
    failures.push(`${rel}: rules.forumCta is only allowed in src/lib/messages.ts`);
  }
  if (source.includes('history.back')) {
    failures.push(`${rel}: history.back is forbidden`);
  }
  if (source.includes('forum.payBack') && rel !== 'src/lib/messages.ts') {
    failures.push(`${rel}: forum.payBack is only allowed in src/lib/messages.ts`);
  }
  if (
    source.includes('forum.askBack') &&
    rel !== 'src/lib/messages.ts' &&
    rel !== 'src/components/ForumAskWizard.tsx' &&
    rel !== 'src/components/ViewHistoryRoot.tsx'
  ) {
    failures.push(
      `${rel}: forum.askBack is only allowed in messages, ForumAskWizard, and ViewHistoryRoot`,
    );
  }
  if (
    source.includes('shops.back') &&
    rel !== 'src/lib/messages.ts' &&
    rel !== 'src/components/ShopAddWizard.tsx' &&
    rel !== 'src/components/ViewHistoryRoot.tsx'
  ) {
    failures.push(
      `${rel}: shops.back is only allowed in messages, ShopAddWizard, and ViewHistoryRoot`,
    );
  }
  if (source.includes('notFound.back') && rel !== 'src/lib/messages.ts') {
    failures.push(`${rel}: notFound.back is only allowed in src/lib/messages.ts`);
  }
  if (source.includes('inbox.back') && rel !== 'src/lib/messages.ts') {
    failures.push(`${rel}: inbox.back is only allowed in src/lib/messages.ts`);
  }
  if (source.includes('funding.apply.back') && rel !== 'src/lib/messages.ts') {
    failures.push(`${rel}: funding.apply.back is only allowed in src/lib/messages.ts`);
  }
  if (/topLeft=\{<(?:Wordmark|HomeWordmark)\b/.test(source)) {
    failures.push(`${rel}: topLeft must be ProfileChromeLeft, not a bare wordmark`);
  }
  if (rel === 'src/components/MarketingHeader.tsx' && !source.includes('<ProfileChromeLeft')) {
    failures.push(`${rel}: the marketing header must use ProfileChromeLeft`);
  }
  if (rel === 'src/app/welcome/page.tsx' && !source.includes('hideHistoryArrow')) {
    failures.push(`${rel}: /welcome must not show the history arrow`);
  }
}

if (failures.length > 0) {
  for (const line of failures) {
    console.error(line);
  }
  process.exit(1);
}
