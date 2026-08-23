import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getRequestLocale } from '@/lib/request-locale';

const cookieGet = vi.fn();
const headerGet = vi.fn();

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({ get: cookieGet })),
  headers: vi.fn(async () => ({ get: headerGet })),
}));

beforeEach(() => {
  cookieGet.mockReset();
  headerGet.mockReset();
});

describe('getRequestLocale', () => {
  it('prefers a valid locale cookie over Accept-Language', async () => {
    cookieGet.mockReturnValue({ value: 'es' });
    headerGet.mockReturnValue('de');
    await expect(getRequestLocale()).resolves.toBe('es');
  });

  it('ignores an invalid cookie and uses Accept-Language', async () => {
    cookieGet.mockReturnValue({ value: 'xx' });
    headerGet.mockReturnValue('de-DE,de;q=0.9');
    await expect(getRequestLocale()).resolves.toBe('de');
  });

  it('defaults to en when cookie and header are absent', async () => {
    cookieGet.mockReturnValue(undefined);
    headerGet.mockReturnValue(null);
    await expect(getRequestLocale()).resolves.toBe('en');
  });
});
