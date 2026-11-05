/**
 * A PR changes a committed visual baseline only when the visual test would
 * fail with the base version: the base PNG is compared with the new one by
 * the comparator `toHaveScreenshot` itself uses (Playwright, pixelmatch with
 * its default threshold, `maxDiffPixelRatio: 0` as in `shotScreen`). A
 * baseline whose base version still passes moved only by rendering noise and
 * is reported, so it can be restored. Added and deleted baselines are not
 * judged here (`check-screenshots.mjs` covers which ones must exist).
 *
 * Changed files are compared on up to four workers. A release can change
 * thousands of baselines, and a single thread does not finish inside the job
 * that also runs the coverage gate.
 *
 * The base is `SCREENSHOT_BASE` when set; in a GitHub pull request run it is
 * the base commit the checked-out merge was built on (its first parent,
 * fetched here), so a later push to the base branch changes nothing; locally
 * it is the merge base of `HEAD` with `origin/staging`. Without a base the check is skipped, except in a pull
 * request run, where a missing base fails.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import { createRequire } from 'node:module';
import path from 'node:path';
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { fileURLToPath } from 'node:url';

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
      // The checkout is the merge of the PR into the base: its first parent is that base commit.
      // A shallow checkout still lists the parents, it only lacks their objects.
      const parents = git(root, ['cat-file', '-p', 'HEAD'])
        .split('\n')
        .filter((line) => line.startsWith('parent '))
        .map((line) => line.slice('parent '.length));
      if (parents.length !== 2) {
        return { rev: null, required: true };
      }
      git(root, ['fetch', '--no-tags', '--depth=1', 'origin', parents[0]]);
      return { rev: parents[0], required: true };
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
 * Baselines in `files` whose base bytes still pass the visual comparator.
 *
 * @param {string} root - Repository root.
 * @param {string} rev - Base revision.
 * @param {string[]} files - Repo-relative PNG paths.
 * @returns {string[]} One sentence per needless change.
 */
function compareChanged(root, rev, files) {
  const require = createRequire(path.join(root, 'package.json'));
  const { utils } = require('playwright-core/lib/coreBundle');
  const compare = utils.getComparator('image/png');
  const needless = [];
  for (const file of files) {
    const before = execFileSync('git', ['show', `${rev}:${file}`], {
      cwd: root,
      maxBuffer: 1 << 28,
    });
    const after = fs.readFileSync(path.join(root, file));
    if (compare(after, before, { maxDiffPixelRatio: 0 }) === null) {
      needless.push(
        `Baseline ${path.basename(file)} changed, but the visual test passes with the base version; restore it (git checkout ${rev} -- ${file})`,
      );
    }
  }
  return needless;
}

/**
 * Splits `files` into `count` contiguous slices.
 *
 * @param {string[]} files - Paths, in git order.
 * @param {number} count - Slice count, at least 1.
 * @returns {string[][]} Slices that preserve `files` order when flattened.
 */
function sliceFiles(files, count) {
  const size = Math.ceil(files.length / count);
  const slices = [];
  for (let index = 0; index < files.length; index += size) {
    slices.push(files.slice(index, index + size));
  }
  return slices;
}

/**
 * Compares one slice on a worker thread.
 *
 * @param {string} root - Repository root.
 * @param {string} rev - Base revision.
 * @param {string[]} files - Repo-relative PNG paths.
 * @returns {Promise<string[]>} Needless-change sentences from that slice.
 */
function compareInWorker(root, rev, files) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(fileURLToPath(import.meta.url), {
      workerData: { root, rev, files },
    });
    let settled = false;
    const finish = (error, value) => {
      if (settled) {
        return;
      }
      settled = true;
      if (error) {
        reject(error);
        return;
      }
      resolve(value);
    };
    worker.once('message', (message) => {
      finish(null, message);
    });
    worker.once('error', (error) => {
      finish(error);
    });
    worker.once('exit', (code) => {
      if (!settled) {
        finish(new Error(`snapshot compare worker exited ${code}`));
      }
    });
  });
}

if (!isMainThread) {
  parentPort?.postMessage(compareChanged(workerData.root, workerData.rev, workerData.files));
}

/**
 * Lists every changed baseline whose base version would still pass the visual
 * test, with the reason as a sentence each.
 *
 * @param {string} root - Repository root.
 * @returns {Promise<string[]>} One message per needless baseline change, or why the
 *   comparison could not run when it is required.
 */
export async function needlessBaselineChanges(root) {
  const base = baseRevision(root);
  if (base.rev === null) {
    if (base.required) {
      return ['Cannot read the base branch to compare changed baselines with'];
    }
    console.warn('Baseline changes not compared: no origin/staging to compare with.');
    return [];
  }
  const changed = git(root, ['diff', '--name-status', '--no-renames', base.rev, '--', SNAP_DIR])
    .split('\n')
    .filter((line) => line.startsWith('M\t'))
    .map((line) => line.slice(2))
    .filter((file) => file.endsWith('.png'));
  if (changed.length === 0) {
    return [];
  }
  // The hosted runner has four CPUs. More workers do not shorten that job,
  // and each worker holds two decoded screenshots.
  const workers = Math.min(4, os.availableParallelism(), changed.length);
  if (workers === 1) {
    return compareChanged(root, base.rev, changed);
  }
  const parts = await Promise.all(
    sliceFiles(changed, workers).map((files) => compareInWorker(root, base.rev, files)),
  );
  return parts.flat();
}
