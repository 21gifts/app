import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getRequestFiat } from '@/lib/request-fiat';

const cookieGet = vi.fn();

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({ get: cookieGet })),
}));

beforeEach(() => {
  cookieGet.mockReset();
});

describe('getRequestFiat', () => {
  it('returns a valid fiat cookie', async () => {
    cookieGet.mockReturnValue({ value: 'CHF' });
    await expect(getRequestFiat('en')).resolves.toBe('CHF');
  });

  it('ignores an invalid cookie and uses the locale default', async () => {
    cookieGet.mockReturnValue({ value: 'xx' });
    await expect(getRequestFiat('en')).resolves.toBe('USD');
    await expect(getRequestFiat('de')).resolves.toBe('CHF');
  });

  it('uses the locale default when the cookie is absent', async () => {
    cookieGet.mockReturnValue(undefined);
    await expect(getRequestFiat('fil')).resolves.toBe('PHP');
  });
});
