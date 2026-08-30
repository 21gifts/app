#!/usr/bin/env node
/**
 * Copy Playwright Linux visual baselines into public/handbook-images/ for
 * handbook Markdown URLs. Run from the repo root (also via prebuild/predev).
 *
 * Handbook Markdown shows one image per variant (desktop-light, or the first
 * listed combo). The other three combo PNGs stay as visual-test baselines only.
 */
import fs from 'node:fs';
import path from 'node:path';
import {
  HANDBOOK_COMBO_ID,
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
}

if (missing.length > 0) {
  console.error('Handbook image sync failed — missing visual baselines:');
  for (const line of missing) {
    console.error(`  - ${line}`);
  }
  process.exit(1);
}

console.log(`Handbook images synced: ${copied} files from visual baselines.`);
