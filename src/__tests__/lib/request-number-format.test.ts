import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getRequestNumberFormat } from '@/lib/request-number-format';

const cookieGet = vi.fn();

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({ get: cookieGet })),
}));

beforeEach(() => {
  cookieGet.mockReset();
});

describe('getRequestNumberFormat', () => {
  it('returns a valid numberFormat cookie', async () => {
    cookieGet.mockReturnValue({ value: 'us' });
    await expect(getRequestNumberFormat()).resolves.toBe('us');
  });

  it('returns de when the cookie is de', async () => {
    cookieGet.mockReturnValue({ value: 'de' });
    await expect(getRequestNumberFormat()).resolves.toBe('de');
  });

  it('ignores an invalid cookie and defaults to ch', async () => {
    cookieGet.mockReturnValue({ value: 'xx' });
    await expect(getRequestNumberFormat()).resolves.toBe('ch');
  });

  it('defaults to ch when the cookie is absent', async () => {
    cookieGet.mockReturnValue(undefined);
    await expect(getRequestNumberFormat()).resolves.toBe('ch');
  });
});
