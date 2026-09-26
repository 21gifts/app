// @vitest-environment node
import { afterEach, describe, expect, it } from 'vitest';
import { getApiUrl, getAppVersion, getE2eNow } from '@/lib/config';

const ORIGINAL = process.env.NEXT_PUBLIC_API_URL;
const ORIGINAL_APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION;
const ORIGINAL_E2E_NOW = process.env.NEXT_PUBLIC_E2E_NOW;

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
  if (ORIGINAL_E2E_NOW === undefined) {
    delete process.env.NEXT_PUBLIC_E2E_NOW;
  } else {
    process.env.NEXT_PUBLIC_E2E_NOW = ORIGINAL_E2E_NOW;
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

describe('getE2eNow', () => {
  it('returns the pinned instant', () => {
    process.env.NEXT_PUBLIC_E2E_NOW = '2026-01-07T12:00:00.000Z';
    expect(getE2eNow()).toBe('2026-01-07T12:00:00.000Z');
  });

  it('returns null when unset', () => {
    delete process.env.NEXT_PUBLIC_E2E_NOW;
    expect(getE2eNow()).toBeNull();
  });

  it('returns null when empty', () => {
    process.env.NEXT_PUBLIC_E2E_NOW = '';
    expect(getE2eNow()).toBeNull();
  });
});
