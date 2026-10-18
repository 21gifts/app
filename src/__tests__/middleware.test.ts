import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { config, middleware } from '@/middleware';

afterEach(() => {
  vi.unstubAllEnvs();
});

/**
 * Nonce named in a policy.
 *
 * @param policy - Policy text.
 * @returns The nonce, or `undefined`.
 */
function nonceOf(policy: string | null): string | undefined {
  return policy?.match(/'nonce-([^']+)'/)?.[1];
}

describe('middleware', () => {
  it('sends /map to the shops map', () => {
    const response = middleware(new NextRequest('https://21.gifts/map'));
    expect(response.headers.get('location')).toBe('https://21.gifts/shops#map');
    expect(response.headers.get('content-security-policy-report-only')).toBeNull();
  });

  it('keeps a pin query on the shops map', () => {
    const response = middleware(new NextRequest('https://21.gifts/map?pin=m-pin'));
    expect(response.headers.get('location')).toBe('https://21.gifts/shops?pin=m-pin#map');
  });

  it('sends the policy report-only by default, with the reporting endpoint', () => {
    const response = middleware(new NextRequest('https://21.gifts/welcome'));
    const policy = response.headers.get('content-security-policy-report-only');
    expect(policy).toContain("default-src 'self'");
    expect(policy).toContain('report-uri /monitoring/csp');
    expect(response.headers.get('content-security-policy')).toBeNull();
    expect(response.headers.get('reporting-endpoints')).toBe('csp="/monitoring/csp"');
  });

  it('enforces the policy when CSP_MODE is enforce', () => {
    vi.stubEnv('CSP_MODE', 'enforce');
    const response = middleware(new NextRequest('https://21.gifts/welcome'));
    expect(response.headers.get('content-security-policy')).toContain("default-src 'self'");
    expect(response.headers.get('content-security-policy-report-only')).toBeNull();
  });

  it('passes the same nonce and policy on to the page', () => {
    const response = middleware(new NextRequest('https://21.gifts/welcome'));
    const policy = response.headers.get('content-security-policy-report-only');
    const nonce = nonceOf(policy);
    expect(nonce).toBeDefined();
    expect(response.headers.get('x-middleware-request-x-nonce')).toBe(nonce);
    expect(response.headers.get('x-middleware-request-content-security-policy-report-only')).toBe(
      policy,
    );
  });

  it('uses a new nonce per request', () => {
    const first = middleware(new NextRequest('https://21.gifts/welcome'));
    const second = middleware(new NextRequest('https://21.gifts/welcome'));
    expect(nonceOf(first.headers.get('content-security-policy-report-only'))).not.toBe(
      nonceOf(second.headers.get('content-security-policy-report-only')),
    );
  });

  it('matches /map and pages, not build assets or public files', () => {
    const [map, pages] = config.matcher as [string, string];
    expect(map).toBe('/map');
    const pattern = new RegExp(`^${pages}$`);
    for (const path of ['/', '/welcome', '/members/acc_1', '/monitoring/csp', '/_next/data/x']) {
      expect(pattern.test(path)).toBe(true);
    }
    for (const path of [
      '/_next/static/chunks/a.js',
      '/_next/image',
      '/sw.js',
      '/favicon.ico',
      '/favicon.svg',
      '/apple-touch-icon.png',
      '/icon-192.png',
      '/icon-512.png',
      '/og.png',
      '/robots.txt',
      '/sitemap.xml',
      '/handbook-images/a.png',
      '/happyland/a.jpg',
    ]) {
      expect(pattern.test(path)).toBe(false);
    }
  });
});
