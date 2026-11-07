// @vitest-environment node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildCsp,
  createCspNonce,
  CSP_NONCE_HEADER,
  CSP_REPORT_GROUP,
  CSP_REPORT_PATH,
  CSP_SOURCES,
  cspHeaderName,
  getCspMode,
} from '@/lib/csp';

afterEach(() => {
  vi.unstubAllEnvs();
});

/**
 * Directives of a policy by name.
 *
 * @param policy - Policy text.
 * @returns Source lists keyed by directive.
 */
function directives(policy: string): Map<string, string[]> {
  return new Map(
    policy.split('; ').map((part) => {
      const [name, ...sources] = part.split(' ');
      return [name as string, sources];
    }),
  );
}

describe('getCspMode', () => {
  it('is report-only when CSP_MODE is unset', () => {
    vi.stubEnv('CSP_MODE', undefined);
    expect(getCspMode()).toBe('report-only');
  });

  it('is report-only for any value but enforce', () => {
    for (const value of ['', 'report-only', 'ENFORCE', ' enforce', 'true', '1']) {
      vi.stubEnv('CSP_MODE', value);
      expect(getCspMode()).toBe('report-only');
    }
  });

  it('enforces when CSP_MODE is enforce', () => {
    vi.stubEnv('CSP_MODE', 'enforce');
    expect(getCspMode()).toBe('enforce');
  });
});

describe('cspHeaderName', () => {
  it('names the report-only and the enforcing header', () => {
    expect(cspHeaderName('report-only')).toBe('Content-Security-Policy-Report-Only');
    expect(cspHeaderName('enforce')).toBe('Content-Security-Policy');
  });
});

describe('createCspNonce', () => {
  it('returns 16 random bytes in base64', () => {
    const nonce = createCspNonce();
    expect(nonce).toMatch(/^[A-Za-z0-9+/]{22}==$/);
    expect(atob(nonce)).toHaveLength(16);
  });

  it('returns a new nonce each call', () => {
    const seen = new Set(Array.from({ length: 50 }, () => createCspNonce()));
    expect(seen.size).toBe(50);
  });
});

describe('buildCsp', () => {
  it('puts the nonce first on script-src and nowhere else', () => {
    const policy = buildCsp('abc123==');
    const parsed = directives(policy);
    expect(parsed.get('script-src')?.[0]).toBe("'nonce-abc123=='");
    expect(policy.match(/nonce-/g)).toHaveLength(1);
  });

  it('lists every directive of CSP_SOURCES in order, then the report directives', () => {
    const parsed = directives(buildCsp('n'));
    expect([...parsed.keys()]).toEqual([...Object.keys(CSP_SOURCES), 'report-uri', 'report-to']);
    for (const [name, sources] of Object.entries(CSP_SOURCES)) {
      const expected = name === 'script-src' ? ["'nonce-n'", ...sources] : sources;
      expect(parsed.get(name)).toEqual(expected);
    }
    expect(parsed.get('report-uri')).toEqual([CSP_REPORT_PATH]);
    expect(parsed.get('report-to')).toEqual([CSP_REPORT_GROUP]);
  });

  it('allows wasm compile, not eval or inline scripts', () => {
    const script = directives(buildCsp('n')).get('script-src');
    expect(script).toContain("'wasm-unsafe-eval'");
    expect(script).toContain("'strict-dynamic'");
    expect(script).not.toContain("'unsafe-eval'");
    expect(script).not.toContain("'unsafe-inline'");
  });

  it('blocks plugins, base rewrites, and framing', () => {
    const parsed = directives(buildCsp('n'));
    expect(parsed.get('object-src')).toEqual(["'none'"]);
    expect(parsed.get('base-uri')).toEqual(["'none'"]);
    expect(parsed.get('frame-ancestors')).toEqual(["'none'"]);
    expect(parsed.get('default-src')).toEqual(["'self'"]);
  });

  it('reports to the same-origin report route', () => {
    expect(CSP_REPORT_PATH).toBe('/monitoring/csp');
    expect(CSP_NONCE_HEADER).toBe('x-nonce');
  });
});

describe('docs/csp.md', () => {
  it('has one row for every source of the policy, and none for a source it lacks', () => {
    const doc = readFileSync(resolve(__dirname, '../../../docs/csp.md'), 'utf8');
    const sources = doc.slice(doc.indexOf('\n## Sources\n'), doc.indexOf('\n### Hosts behind'));
    const rows = [...sources.matchAll(/^\| `([a-z-]+)` +\| `([^`]+)` +\|/gm)].map(
      ([, name, source]) => `${name} ${source}`,
    );
    const policy = Object.entries(CSP_SOURCES).flatMap(([name, sources]) =>
      sources.map((source) => `${name} ${source}`),
    );
    expect(rows).toEqual(policy);
  });
});
