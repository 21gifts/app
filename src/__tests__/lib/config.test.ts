// @vitest-environment node
import { afterEach, describe, expect, it } from 'vitest';
import { getApiUrl, getAppVersion } from '@/lib/config';

const ORIGINAL = process.env.NEXT_PUBLIC_API_URL;
const ORIGINAL_GIT_SHA = process.env.NEXT_PUBLIC_GIT_SHA;

afterEach(() => {
  if (ORIGINAL === undefined) {
    delete process.env.NEXT_PUBLIC_API_URL;
  } else {
    process.env.NEXT_PUBLIC_API_URL = ORIGINAL;
  }
  if (ORIGINAL_GIT_SHA === undefined) {
    delete process.env.NEXT_PUBLIC_GIT_SHA;
  } else {
    process.env.NEXT_PUBLIC_GIT_SHA = ORIGINAL_GIT_SHA;
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

describe('getAppVersion', () => {
  it('returns the configured value', () => {
    process.env.NEXT_PUBLIC_GIT_SHA = 'abc1234';
    expect(getAppVersion()).toBe('abc1234');
  });

  it('throws when the variable is unset', () => {
    delete process.env.NEXT_PUBLIC_GIT_SHA;
    expect(() => getAppVersion()).toThrow('NEXT_PUBLIC_GIT_SHA');
  });

  it('throws when the variable is empty', () => {
    process.env.NEXT_PUBLIC_GIT_SHA = '';
    expect(() => getAppVersion()).toThrow('NEXT_PUBLIC_GIT_SHA');
  });

  it('slices a 40-char SHA to 7', () => {
    process.env.NEXT_PUBLIC_GIT_SHA = 'abcdef0123456789abcdef0123456789abcdef01';
    expect(getAppVersion()).toBe('abcdef0');
  });

  it('leaves `dev` uncut', () => {
    process.env.NEXT_PUBLIC_GIT_SHA = 'dev';
    expect(getAppVersion()).toBe('dev');
  });
});
