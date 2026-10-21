/**
 * A PR changes a committed visual baseline only when the visual test would
 * fail with the base version: the base PNG is compared with the new one by
 * the comparator `toHaveScreenshot` itself uses (Playwright, pixelmatch with
 * its default threshold, `maxDiffPixelRatio: 0` as in `shotScreen`). A
 * baseline whose base version still passes moved only by rendering noise and
 * is reported, so it can be restored. Added and deleted baselines are not
 * judged here (`check-screenshots.mjs` covers which ones must exist).
 *
 * The base is `SCREENSHOT_BASE` when set; in a GitHub pull request run it is
 * the tip of `GITHUB_BASE_REF`, fetched here, as the checkout is the merge of
 * the PR into that tip; locally it is the merge base of `HEAD` with
 * `origin/staging`. Without a base the check is skipped, except in a pull
 * request run, where a missing base fails.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

const SNAP_DIR = path.join('e2e', 'visual.spec.ts-snapshots');

/**
 * Runs git in `root` and returns its trimmed output.
 *
 * @param {string} root - Repository root.
 * @param {string[]} args - Git arguments.
 * @returns {string} Standard output without trailing whitespace.
 */
function git(root, args) {
  return execFileSync('git', args, {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

/**
 * The revision whose baselines a change is measured against.
 *
 * @param {string} root - Repository root.
 * @returns {{ rev: string | null; required: boolean }} The base revision, or
 *   `null` when none is known, and whether a missing base must fail.
 */
function baseRevision(root) {
  const explicit = process.env.SCREENSHOT_BASE;
  if (explicit !== undefined && explicit !== '') {
    return { rev: explicit, required: true };
  }
  const prBase = process.env.GITHUB_BASE_REF;
  if (prBase !== undefined && prBase !== '') {
    try {
      git(root, [
        'fetch',
        '--no-tags',
        '--depth=1',
        'origin',
        `+refs/heads/${prBase}:refs/remotes/origin/${prBase}`,
      ]);
      return { rev: `origin/${prBase}`, required: true };
    } catch {
      return { rev: null, required: true };
    }
  }
  try {
    return { rev: git(root, ['merge-base', 'HEAD', 'origin/staging']), required: false };
  } catch {
    return { rev: null, required: false };
  }
}

/**
 * Lists every changed baseline whose base version would still pass the visual
 * test, with the reason as a sentence each.
 *
 * @param {string} root - Repository root.
 * @returns {string[]} One message per needless baseline change, or why the
 *   comparison could not run when it is required.
 */
export function needlessBaselineChanges(root) {
  const base = baseRevision(root);
  if (base.rev === null) {
    if (base.required) {
      return ['Cannot read the base branch to compare changed baselines with'];
    }
    console.log('Baseline changes not compared: no origin/staging to compare with.');
    return [];
  }
  const require = createRequire(path.join(root, 'package.json'));
  const { utils } = require('playwright-core/lib/coreBundle');
  const compare = utils.getComparator('image/png');
  const changed = git(root, ['diff', '--name-status', '--no-renames', base.rev, '--', SNAP_DIR])
    .split('\n')
    .filter((line) => line.startsWith('M\t'))
    .map((line) => line.slice(2))
    .filter((file) => file.endsWith('.png'));
  const needless = [];
  for (const file of changed) {
    const before = execFileSync('git', ['show', `${base.rev}:${file}`], {
      cwd: root,
      maxBuffer: 1 << 28,
    });
    const after = fs.readFileSync(path.join(root, file));
    if (compare(after, before, { maxDiffPixelRatio: 0 }) === null) {
      needless.push(
        `Baseline ${path.basename(file)} changed, but the visual test passes with the base version; restore it (git checkout ${base.rev} -- ${file})`,
      );
    }
  }
  return needless;
}
