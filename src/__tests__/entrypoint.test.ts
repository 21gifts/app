// @vitest-environment node
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

/**
 * Runs the real `entrypoint.sh` against a fake build output. The only change
 * to the script is its `/app` prefix, which points at a temp directory. Linux
 * only: the script uses GNU/BusyBox `sed -i`, as in the image (CI is Linux).
 */
const SCRIPT = readFileSync(resolve(__dirname, '../../entrypoint.sh'), 'utf8');

let root = '';

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'entrypoint-'));
  mkdirSync(join(root, '.next', 'static'), { recursive: true });
  writeFileSync(join(root, 'entrypoint.sh'), SCRIPT.replaceAll('/app/', `${root}/`));
  writeFileSync(
    join(root, '.next', 'static', 'chunk.js'),
    'a="__NEXT_PUBLIC_API_URL__";b="__NEXT_PUBLIC_SENTRY_DSN__";c="__NEXT_PUBLIC_SENTRY_ENVIRONMENT__";d="__NEXT_PUBLIC_PLATFORM_USERNAME__";',
  );
  writeFileSync(join(root, 'server.js'), 'u="__NEXT_PUBLIC_PLATFORM_USERNAME__";');
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

/**
 * Run the entrypoint with the given environment and `true` as the command.
 *
 * @param env - Container environment.
 * @returns Exit status and stderr.
 */
function run(env: Record<string, string>): { status: number; stderr: string } {
  try {
    execFileSync('sh', [join(root, 'entrypoint.sh'), 'true'], {
      env: { NODE_ENV: 'production', PATH: process.env['PATH'] ?? '', ...env },
      stdio: 'pipe',
    });
    return { status: 0, stderr: '' };
  } catch (error) {
    const failed = error as { status: number; stderr: Buffer };
    return { status: failed.status, stderr: failed.stderr.toString() };
  }
}

/** @returns The rewritten chunk and server file. */
function output(): string {
  return (
    readFileSync(join(root, '.next', 'static', 'chunk.js'), 'utf8') +
    readFileSync(join(root, 'server.js'), 'utf8')
  );
}

describe.skipIf(process.platform !== 'linux')('entrypoint.sh', () => {
  it('starts with the optional values unset and substitutes empty strings', () => {
    expect(run({ NEXT_PUBLIC_API_URL: 'https://api.example' }).status).toBe(0);
    expect(output()).toBe('a="https://api.example";b="";c="";d="";u="";');
  });

  it('substitutes the optional values when set', () => {
    expect(
      run({
        NEXT_PUBLIC_API_URL: 'https://api.example',
        NEXT_PUBLIC_SENTRY_DSN: 'https://key@errors.example/1',
        NEXT_PUBLIC_SENTRY_ENVIRONMENT: 'staging',
        NEXT_PUBLIC_PLATFORM_USERNAME: '21gifts',
      }).status,
    ).toBe(0);
    expect(output()).toBe(
      'a="https://api.example";b="https://key@errors.example/1";c="staging";d="21gifts";u="21gifts";',
    );
  });

  it('still refuses to start when a required value is unset', () => {
    const result = run({ NEXT_PUBLIC_SENTRY_DSN: 'https://key@errors.example/1' });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('NEXT_PUBLIC_API_URL is unset or empty');
  });

  it('still refuses to start when a required value is empty', () => {
    expect(run({ NEXT_PUBLIC_API_URL: '' }).status).toBe(1);
  });
});
