#!/usr/bin/env node
/**
 * Fail if a UI screen or exported function lacks a committed Playwright
 * screenshot baseline. Run from the repo root. No extra packages.
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
import { extractFunctions, extractScreens, sectionBody } from './check-handbook.mjs';
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

const missing = [];

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
    if (!hasSnapshot(snapFiles, stem)) {
      missing.push(`Screen ${route} has no Playwright Linux baseline ${stem}-linux.png`);
    }
  }
  if (!visualSrc.includes(`'${arg}'`) && !visualSrc.includes(`"${arg}"`)) {
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
    if (!hasSnapshot(snapFiles, stem)) {
      missing.push(
        `Variant ${variant.route} ${variant.id} ${comboId} has no Playwright Linux baseline ${stem}-linux.png`,
      );
    }
  }
}

const fns = extractFunctions(path.join(ROOT, 'src'));
for (const name of [...fns].sort()) {
  const arg = `function-${name}`;
  for (const comboId of variantComboIds({})) {
    const stem = comboSnapshotStem(arg, comboId);
    if (!hasSnapshot(snapFiles, stem)) {
      missing.push(
        `Function ${name} ${comboId} has no Playwright Linux baseline ${stem}-linux.png`,
      );
    }
  }
}

if (screens.size === 0 && fns.size === 0) {
  console.error('SCREENSHOTS: no screens or functions discovered — refusing to pass');
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
  `Screenshots complete: ${screens.size} screens, ${SCREEN_VARIANTS.length} variants × 4 combos (restricted where listed), ${fns.size} functions × 4 combos, ${snapFiles.length} PNG baselines.`,
);
