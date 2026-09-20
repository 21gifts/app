// @vitest-environment node
import { afterEach, describe, expect, it } from 'vitest';
import { getApiUrl, getAppVersion } from '@/lib/config';

const ORIGINAL = process.env.NEXT_PUBLIC_API_URL;
const ORIGINAL_APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION;

afterEach(() => {
  if (ORIGINAL === undefined) {
    delete process.env.NEXT_PUBLIC_API_URL;
  } else {
    process.env.NEXT_PUBLIC_API_URL = ORIGINAL;
  }
  if (ORIGINAL_APP_VERSION === undefined) {
    delete process.env.NEXT_PUBLIC_APP_VERSION;
  } else {
    process.env.NEXT_PUBLIC_APP_VERSION = ORIGINAL_APP_VERSION;
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
    process.env.NEXT_PUBLIC_APP_VERSION = '74';
    expect(getAppVersion()).toBe('74');
  });

  it('throws when the variable is unset', () => {
    delete process.env.NEXT_PUBLIC_APP_VERSION;
    expect(() => getAppVersion()).toThrow('NEXT_PUBLIC_APP_VERSION');
  });

  it('throws when the variable is empty', () => {
    process.env.NEXT_PUBLIC_APP_VERSION = '';
    expect(() => getAppVersion()).toThrow('NEXT_PUBLIC_APP_VERSION');
  });

  it('leaves `dev` uncut', () => {
    process.env.NEXT_PUBLIC_APP_VERSION = 'dev';
    expect(getAppVersion()).toBe('dev');
  });

  it('does not slice a long decimal run number', () => {
    process.env.NEXT_PUBLIC_APP_VERSION = '123456789';
    expect(getAppVersion()).toBe('123456789');
  });
});
