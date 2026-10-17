// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  getApiUrl,
  getAppVersion,
  getBreezApiKey,
  getE2eNow,
  getPlatformUsername,
  getSentryDsn,
  getSentryEnvironment,
  getSentryTracesSampleRate,
} from '@/lib/config';

const ORIGINAL = process.env.NEXT_PUBLIC_API_URL;
const ORIGINAL_APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION;
const ORIGINAL_E2E_NOW = process.env.NEXT_PUBLIC_E2E_NOW;
const ORIGINAL_BREEZ = process.env.NEXT_PUBLIC_BREEZ_API_KEY;
const ORIGINAL_PLATFORM_USERNAME = process.env.NEXT_PUBLIC_PLATFORM_USERNAME;

afterEach(() => {
  vi.unstubAllEnvs();
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
  if (ORIGINAL_BREEZ === undefined) {
    delete process.env.NEXT_PUBLIC_BREEZ_API_KEY;
  } else {
    process.env.NEXT_PUBLIC_BREEZ_API_KEY = ORIGINAL_BREEZ;
  }
  if (ORIGINAL_PLATFORM_USERNAME === undefined) {
    delete process.env.NEXT_PUBLIC_PLATFORM_USERNAME;
  } else {
    process.env.NEXT_PUBLIC_PLATFORM_USERNAME = ORIGINAL_PLATFORM_USERNAME;
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

describe('getBreezApiKey', () => {
  it('returns the configured value', () => {
    process.env.NEXT_PUBLIC_BREEZ_API_KEY = 'test-breez-api-key';
    expect(getBreezApiKey()).toBe('test-breez-api-key');
  });

  it('returns null when unset', () => {
    delete process.env.NEXT_PUBLIC_BREEZ_API_KEY;
    expect(getBreezApiKey()).toBeNull();
  });

  it('returns null when empty', () => {
    process.env.NEXT_PUBLIC_BREEZ_API_KEY = '';
    expect(getBreezApiKey()).toBeNull();
  });
});

describe('getPlatformUsername', () => {
  it('returns the configured value', () => {
    process.env.NEXT_PUBLIC_PLATFORM_USERNAME = '21gifts';
    expect(getPlatformUsername()).toBe('21gifts');
  });

  it('trims surrounding whitespace', () => {
    process.env.NEXT_PUBLIC_PLATFORM_USERNAME = '  21gifts  ';
    expect(getPlatformUsername()).toBe('21gifts');
  });

  it('returns null when unset', () => {
    delete process.env.NEXT_PUBLIC_PLATFORM_USERNAME;
    expect(getPlatformUsername()).toBeNull();
  });

  it('returns null when empty', () => {
    process.env.NEXT_PUBLIC_PLATFORM_USERNAME = '';
    expect(getPlatformUsername()).toBeNull();
  });

  it('returns null when blank', () => {
    process.env.NEXT_PUBLIC_PLATFORM_USERNAME = '   ';
    expect(getPlatformUsername()).toBeNull();
  });
});

describe.each([
  ['getSentryDsn', getSentryDsn, 'NEXT_PUBLIC_SENTRY_DSN', 'https://key@errors.example/7'],
  ['getSentryEnvironment', getSentryEnvironment, 'NEXT_PUBLIC_SENTRY_ENVIRONMENT', 'staging'],
] as const)('%s', (_name, read, variable, value) => {
  it('returns the configured value, trimmed', () => {
    vi.stubEnv(variable, `  ${value}  `);
    expect(read()).toBe(value);
  });

  it('returns null when unset', () => {
    vi.stubEnv(variable, undefined);
    expect(read()).toBeNull();
  });

  it('returns null for the empty string entrypoint.sh substitutes', () => {
    vi.stubEnv(variable, '');
    expect(read()).toBeNull();
  });

  it('returns null when blank', () => {
    vi.stubEnv(variable, '   ');
    expect(read()).toBeNull();
  });
});

describe('getSentryTracesSampleRate', () => {
  it.each([
    ['0', 0],
    ['1', 1],
    ['0.25', 0.25],
    ['.5', 0.5],
    ['1.000', 1],
    ['  0.1  ', 0.1],
  ])('reads %j as %d', (value, rate) => {
    vi.stubEnv('NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE', value);
    expect(getSentryTracesSampleRate()).toBe(rate);
  });

  it('returns null when unset', () => {
    vi.stubEnv('NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE', undefined);
    expect(getSentryTracesSampleRate()).toBeNull();
  });

  it.each([
    ['the empty string entrypoint.sh substitutes', ''],
    ['a blank value', '   '],
    ['a rate above 1', '1.5'],
    ['a negative rate', '-0.1'],
    ['an exponent', '1e-2'],
    ['a percentage', '10%'],
    ['text', 'abc'],
    ['an unsubstituted placeholder', '__NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE__'],
  ])('returns null for %s', (_label, value) => {
    vi.stubEnv('NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE', value);
    expect(getSentryTracesSampleRate()).toBeNull();
  });
});
