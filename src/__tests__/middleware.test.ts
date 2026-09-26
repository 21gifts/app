import { afterEach, describe, it, expect, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { middleware } from '../middleware';

afterEach(() => vi.useRealTimers());
describe('Sunday web boundary', () => {
  it('blocks API writes and reads before handlers', async () => {
    vi.useFakeTimers().setSystemTime(new Date('2026-09-26T16:00:00Z'));
    for (const method of ['GET', 'POST', 'DELETE', 'OPTIONS']) {
      const response = middleware(new NextRequest('https://21.gifts/me', { method }));
      expect(response.status).toBe(503);
      expect(response.headers.get('Retry-After')).toBe('86400');
    }
  });
  it('rewrites documents and RSC without executing their original route, including spoofed API Accept', () => {
    vi.useFakeTimers().setSystemTime(new Date('2026-09-27T00:00:00Z'));
    for (const headers of [{ accept: 'text/html' }, { rsc: '1' }]) {
      const response = middleware(new NextRequest('https://21.gifts/me', { headers }));
      expect(response.headers.get('x-middleware-rewrite')).toBe('https://21.gifts/sunday-rest');
    }
    expect(
      middleware(
        new NextRequest('https://21.gifts/sunday-rest', { headers: { accept: 'text/html' } }),
      ).headers.get('x-middleware-next'),
    ).toBe('1');
  });
  it('resumes on Monday and prevents stale cached availability', () => {
    vi.useFakeTimers().setSystemTime(new Date('2026-09-27T16:00:00Z'));
    const response = middleware(new NextRequest('https://21.gifts/me'));
    expect(response.headers.get('x-middleware-next')).toBe('1');
    expect(response.headers.get('Cache-Control')).toBe('no-store');
  });
});
