#!/usr/bin/env node
/**
 * Fail if a UI screen or listed variant lacks a committed Playwright
 * screenshot baseline, or if a variant is not shot in `e2e/visual.spec.ts`.
 * `/setup/rules` must list one variant per `RULES_CHAPTER_IDS` chapter.
 * Run from the repo root. No extra packages.
 *
 * Snapshot files live next to the visual spec (Playwright default layout):
 *   e2e/visual.spec.ts-snapshots/<arg>-<project>-<platform>.png
 * Visual projects are the four {@link BASELINE_COMBOS} ids.
 *
 * Handbook URLs under public/handbook-images/ are filled at build/dev from
 * these baselines (see scripts/sync-handbook-images.mjs); this check does not
 * require committed PNGs there.
 */
import fs from 'node:fs';
import path from 'node:path';
import { extractScreens, sectionBody } from './check-handbook.mjs';
import {
  BASELINE_COMBOS,
  SCREEN_VARIANTS,
  comboSnapshotStem,
  variantComboIds,
} from './screen-variants.mjs';

const ROOT = process.cwd();
const SNAP_DIR = path.join(ROOT, 'e2e', 'visual.spec.ts-snapshots');
const E2E_VISUAL = path.join(ROOT, 'e2e', 'visual.spec.ts');
const SCREENS_MD = path.join(ROOT, 'docs', 'handbook', 'screens.md');

/**
 * Maps an App Router public path to the Playwright screenshot arg.
 *
 * @param route - `/`, `/login`, …
 * @returns `screen-root` or `screen-<path-with-dashes>`.
 */
function screenArg(route) {
  if (route === '/') {
    return 'screen-root';
  }
  return `screen-${route.replace(/^\//, '').replace(/\//g, '-').replace(/\[|\]/g, '')}`;
}

function listPngs(dir) {
  if (!fs.existsSync(dir)) {
    return [];
  }
  return fs.readdirSync(dir).filter((n) => n.endsWith('.png'));
}

function hasSnapshot(files, stem) {
  const file = `${stem.replaceAll('_', '-')}-linux.png`;
  return files.includes(file);
}

/**
 * True when `e2e/visual.spec.ts` actually shoots `arg` (not a bare string).
 *
 * @param src - visual.spec.ts source.
 * @param arg - Playwright screenshot name without `.png`.
 * @returns Whether a `shotScreen` / `toHaveScreenshot` call uses `arg`.
 */
function hasVisualShot(src, arg) {
  const escaped = arg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const shot = new RegExp(`shotScreen\\(\\s*\\w+\\s*,\\s*['"]${escaped}['"]`);
  const raw = new RegExp(`toHaveScreenshot\\(\\s*['"]${escaped}(?:\\.png)?['"]`);
  return shot.test(src) || raw.test(src);
}

/**
 * Chapter ids from `src/lib/rules-chapters.ts` (`lead`, `law1`, …).
 *
 * @returns Ordered ids, or `[]` when the export cannot be parsed.
 */
function rulesChapterIds() {
  const srcPath = path.join(ROOT, 'src', 'lib', 'rules-chapters.ts');
  if (!fs.existsSync(srcPath)) {
    return [];
  }
  const src = fs.readFileSync(srcPath, 'utf8');
  const block = src.match(/export const RULES_CHAPTER_IDS = \[([\s\S]*?)\]\s+as const/);
  if (block === null || block[1] === undefined) {
    return [];
  }
  return [...block[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
}

const missing = [];
/** @type {Set<string>} */
const expectedSnapFiles = new Set();

/**
 * Expected Playwright Linux baseline filename for a snapshot stem.
 * Same mapping as {@link hasSnapshot}.
 *
 * @param {string} stem - Snapshot stem before `-linux.png`.
 * @returns {string} Baseline file name.
 */
function expectedSnapshotFile(stem) {
  return `${stem.replaceAll('_', '-')}-linux.png`;
}

if (!fs.existsSync(E2E_VISUAL)) {
  console.error('SCREENSHOTS MISSING: e2e/visual.spec.ts does not exist');
  process.exit(1);
}

const snapFiles = listPngs(SNAP_DIR);
if (snapFiles.length === 0) {
  missing.push(`No PNG baselines in ${path.relative(ROOT, SNAP_DIR)}`);
}

const screens = extractScreens();
const screensMd = fs.existsSync(SCREENS_MD) ? fs.readFileSync(SCREENS_MD, 'utf8') : '';
const visualSrc = fs.readFileSync(E2E_VISUAL, 'utf8');

for (const route of [...screens].sort()) {
  const arg = screenArg(route);
  const defaultVariant = SCREEN_VARIANTS.find((v) => v.route === route);
  const comboIds =
    defaultVariant === undefined
      ? BASELINE_COMBOS.map((combo) => combo.id)
      : variantComboIds(defaultVariant);
  for (const comboId of comboIds) {
    const stem = comboSnapshotStem(arg, comboId);
    expectedSnapFiles.add(expectedSnapshotFile(stem));
    if (!hasSnapshot(snapFiles, stem)) {
      missing.push(`Screen ${route} has no Playwright Linux baseline ${stem}-linux.png`);
    }
  }
  if (!hasVisualShot(visualSrc, arg)) {
    missing.push(
      `Screen ${route} has no shotScreen/toHaveScreenshot('${arg}') in e2e/visual.spec.ts`,
    );
  }
  const mdName = defaultVariant?.image ?? `${arg.replace(/^screen-/, '')}.png`;
  const imageRef = new RegExp(
    `!\\[[^\\]]*\\]\\(images/${mdName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\)`,
  );
  const body = sectionBody(screensMd, 'Screen', route);
  if (!imageRef.test(body)) {
    missing.push(`Screen ${route} handbook section has no ![…](images/${mdName})`);
  }
}

for (const variant of SCREEN_VARIANTS) {
  for (const comboId of variantComboIds(variant)) {
    const stem = comboSnapshotStem(variant.visual, comboId);
    expectedSnapFiles.add(expectedSnapshotFile(stem));
    if (!hasSnapshot(snapFiles, stem)) {
      missing.push(
        `Variant ${variant.route} ${variant.id} ${comboId} has no Playwright Linux baseline ${stem}-linux.png`,
      );
    }
  }
  if (!hasVisualShot(visualSrc, variant.visual)) {
    missing.push(
      `Variant ${variant.route} ${variant.id} has no shotScreen/toHaveScreenshot('${variant.visual}') in e2e/visual.spec.ts`,
    );
  }
}

for (const file of snapFiles) {
  if (!expectedSnapFiles.has(file)) {
    missing.push(
      `Unexpected Playwright Linux baseline ${file} (not a screen or SCREEN_VARIANTS combo)`,
    );
  }
}

const chapterIds = rulesChapterIds();
if (chapterIds.length === 0) {
  missing.push(
    'src/lib/rules-chapters.ts has no RULES_CHAPTER_IDS to require /setup/rules variants',
  );
} else {
  for (const chapter of chapterIds) {
    const id = chapter === 'lead' ? 'default' : chapter;
    if (!SCREEN_VARIANTS.some((variant) => variant.route === '/setup/rules' && variant.id === id)) {
      missing.push(
        `Screen /setup/rules chapter ${chapter} has no screen-variants.mjs entry id=${id}`,
      );
    }
  }
}

if (screens.size === 0) {
  console.error('SCREENSHOTS: no screens discovered — refusing to pass');
  process.exit(1);
}

if (missing.length) {
  console.error('SCREENSHOTS INCOMPLETE:');
  for (const line of missing) {
    console.error(`  - ${line}`);
  }
  process.exit(1);
}

console.log(
  `Screenshots complete: ${screens.size} screens, ${SCREEN_VARIANTS.length} variants × 4 combos (restricted where listed), ${snapFiles.length} PNG baselines.`,
);
