// @vitest-environment node
import { afterEach, describe, expect, it } from 'vitest';
import { GET } from '@/app/maps/key/route';

const KEY = 'GOOGLE_MAPS_API_KEY';

afterEach(() => {
  delete process.env[KEY];
});

describe('GET /maps/key', () => {
  it('returns null when the key is unset', async () => {
    delete process.env[KEY];
    const response = GET();
    await expect(response.json()).resolves.toEqual({ key: null });
  });

  it('returns null when the key is empty', async () => {
    process.env[KEY] = '   ';
    const response = GET();
    await expect(response.json()).resolves.toEqual({ key: null });
  });

  it('returns the trimmed key when set', async () => {
    process.env[KEY] = '  test-key  ';
    const response = GET();
    await expect(response.json()).resolves.toEqual({ key: 'test-key' });
  });
});
