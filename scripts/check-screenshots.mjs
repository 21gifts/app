#!/usr/bin/env node
/**
 * Fail if a UI screen or exported function lacks a committed Playwright
 * screenshot baseline. Run from the repo root. No extra packages.
 *
 * Snapshot files live next to the visual spec (Playwright default layout):
 *   e2e/visual.spec.ts-snapshots/<arg>-<project>-<platform>.png
 */
import fs from 'node:fs';
import path from 'node:path';
import { extractFunctions, extractScreens, sectionBody } from './check-handbook.mjs';
import { SCREEN_VARIANTS } from './screen-variants.mjs';

const ROOT = process.cwd();
const SNAP_DIR = path.join(ROOT, 'e2e', 'visual.spec.ts-snapshots');
const E2E_VISUAL = path.join(ROOT, 'e2e', 'visual.spec.ts');
const HANDBOOK_IMAGES = path.join(ROOT, 'docs', 'handbook', 'images');
const PUBLIC_IMAGES = path.join(ROOT, 'public', 'handbook-images');
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

function hasSnapshot(files, prefix) {
  return files.some((n) => n.startsWith(`${prefix}-`) && n.endsWith('-linux.png'));
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
const handbookPngs = listPngs(HANDBOOK_IMAGES);
const publicPngs = listPngs(PUBLIC_IMAGES);

for (const route of [...screens].sort()) {
  const arg = screenArg(route);
  if (!hasSnapshot(snapFiles, arg)) {
    missing.push(`Screen ${route} has no Playwright Linux baseline ${arg}-*-linux.png`);
  }
  if (!visualSrc.includes(`'${arg}'`) && !visualSrc.includes(`"${arg}"`)) {
    missing.push(
      `Screen ${route} has no shotScreen/toHaveScreenshot('${arg}') in e2e/visual.spec.ts`,
    );
  }
  const defaultVariant = SCREEN_VARIANTS.find((v) => v.route === route);
  const mdName = defaultVariant?.image ?? `${arg.replace(/^screen-/, '')}.png`;
  const imageRef = new RegExp(
    `!\\[[^\\]]*\\]\\(images/${mdName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\)`,
  );
  const body = sectionBody(screensMd, 'Screen', route);
  if (!imageRef.test(body)) {
    missing.push(`Screen ${route} handbook section has no ![…](images/${mdName})`);
  }
  const docsFile = path.join(HANDBOOK_IMAGES, mdName);
  const publicFile = path.join(PUBLIC_IMAGES, mdName);
  if (!handbookPngs.includes(mdName)) {
    missing.push(`docs/handbook/images/${mdName} is missing`);
  }
  if (!publicPngs.includes(mdName)) {
    missing.push(`public/handbook-images/${mdName} is missing`);
  }
  if (fs.existsSync(docsFile) && fs.existsSync(publicFile)) {
    const docsBuf = fs.readFileSync(docsFile);
    const publicBuf = fs.readFileSync(publicFile);
    if (!docsBuf.equals(publicBuf)) {
      missing.push(`${mdName} differs between docs/handbook/images and public/handbook-images`);
    }
  }
}

for (const variant of SCREEN_VARIANTS) {
  if (!handbookPngs.includes(variant.image)) {
    missing.push(
      `docs/handbook/images/${variant.image} is missing (variant ${variant.route} ${variant.id})`,
    );
  }
  if (!publicPngs.includes(variant.image)) {
    missing.push(
      `public/handbook-images/${variant.image} is missing (variant ${variant.route} ${variant.id})`,
    );
  }
  const docsFile = path.join(HANDBOOK_IMAGES, variant.image);
  const publicFile = path.join(PUBLIC_IMAGES, variant.image);
  if (fs.existsSync(docsFile) && fs.existsSync(publicFile)) {
    const docsBuf = fs.readFileSync(docsFile);
    const publicBuf = fs.readFileSync(publicFile);
    if (!docsBuf.equals(publicBuf)) {
      missing.push(
        `${variant.image} differs between docs/handbook/images and public/handbook-images`,
      );
    }
  }
}

const fns = extractFunctions(path.join(ROOT, 'src'));
for (const name of [...fns].sort()) {
  const arg = `function-${name}`;
  if (!hasSnapshot(snapFiles, arg)) {
    missing.push(`Function ${name} has no Playwright Linux baseline ${arg}-*-linux.png`);
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
  `Screenshots complete: ${screens.size} screens, ${SCREEN_VARIANTS.length} variants, ${fns.size} functions, ${snapFiles.length} PNG baselines.`,
);
