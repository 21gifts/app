#!/usr/bin/env node
/**
 * Copy Playwright Linux visual baselines into public/handbook-images/ for
 * handbook Markdown URLs and the per-topic baseline viewer. Run from the repo
 * root (also via prebuild/predev).
 *
 * Markdown still uses one image per variant (desktop-light, or the first
 * listed combo). The viewer also copies `${visual}-${comboId}.png` for every
 * combo that exists, plus function clips.
 */
import fs from 'node:fs';
import path from 'node:path';
import {
  HANDBOOK_COMBO_ID,
  BASELINE_COMBOS,
  SCREEN_VARIANTS,
  comboSnapshotStem,
  variantComboIds,
} from './screen-variants.mjs';

const ROOT = process.cwd();
const SNAP_DIR = path.join(ROOT, 'e2e', 'visual.spec.ts-snapshots');
const DEST_DIR = path.join(ROOT, 'public', 'handbook-images');

fs.mkdirSync(DEST_DIR, { recursive: true });

for (const name of fs.readdirSync(DEST_DIR)) {
  if (name.endsWith('.png')) {
    fs.unlinkSync(path.join(DEST_DIR, name));
  }
}

const missing = [];
let copied = 0;

for (const variant of SCREEN_VARIANTS) {
  const comboIds = variantComboIds(variant);
  const comboId = comboIds.includes(HANDBOOK_COMBO_ID) ? HANDBOOK_COMBO_ID : comboIds[0];
  const stem = comboSnapshotStem(variant.visual, comboId);
  const source = path.join(SNAP_DIR, `${stem}-linux.png`);
  const dest = path.join(DEST_DIR, variant.image);
  if (!fs.existsSync(source)) {
    missing.push(`${stem}-linux.png → ${variant.image}`);
    continue;
  }
  fs.copyFileSync(source, dest);
  copied += 1;
  for (const id of comboIds) {
    const comboStem = comboSnapshotStem(variant.visual, id);
    const comboSource = path.join(SNAP_DIR, `${comboStem}-linux.png`);
    const comboDest = path.join(DEST_DIR, `${variant.visual}-${id}.png`);
    if (!fs.existsSync(comboSource)) {
      missing.push(`${comboStem}-linux.png → ${variant.visual}-${id}.png`);
      continue;
    }
    fs.copyFileSync(comboSource, comboDest);
    copied += 1;
  }
}

const functionsMd = path.join(ROOT, 'docs', 'handbook', 'functions.md');
if (fs.existsSync(functionsMd)) {
  const names = [...fs.readFileSync(functionsMd, 'utf8').matchAll(/^## Function: (.+)$/gm)].map(
    (match) => match[1],
  );
  for (const name of names) {
    for (const combo of BASELINE_COMBOS) {
      const stem = comboSnapshotStem(`function-${name}`, combo.id);
      const source = path.join(SNAP_DIR, `${stem}-linux.png`);
      const destName = `function-${name}-${combo.id}.png`;
      const destPath = path.join(DEST_DIR, destName);
      if (!fs.existsSync(source)) {
        missing.push(`${stem}-linux.png → ${destName}`);
        continue;
      }
      fs.copyFileSync(source, destPath);
      copied += 1;
    }
  }
}

if (missing.length > 0) {
  console.error('Handbook image sync failed — missing visual baselines:');
  for (const line of missing) {
    console.error(`  - ${line}`);
  }
  process.exit(1);
}

console.log(`Handbook images synced: ${copied} files from visual baselines.`);
