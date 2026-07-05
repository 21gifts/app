// @vitest-environment node
import { afterEach, describe, expect, it } from 'vitest';
import { getApiUrl } from '@/lib/config';

const ORIGINAL = process.env.NEXT_PUBLIC_API_URL;

afterEach(() => {
  if (ORIGINAL === undefined) {
    delete process.env.NEXT_PUBLIC_API_URL;
  } else {
    process.env.NEXT_PUBLIC_API_URL = ORIGINAL;
  }
});

describe('getApiUrl', () => {
  it('returns the configured value', () => {
    process.env.NEXT_PUBLIC_API_URL = 'https://api.21.gifts';
    expect(getApiUrl()).toBe('https://api.21.gifts');
  });

  it('throws when the variable is unset', () => {
    delete process.env.NEXT_PUBLIC_API_URL;
    expect(() => getApiUrl()).toThrow('NEXT_PUBLIC_API_URL is not set');
  });

  it('throws when the variable is empty', () => {
    process.env.NEXT_PUBLIC_API_URL = '';
    expect(() => getApiUrl()).toThrow('NEXT_PUBLIC_API_URL is not set');
  });
});
