// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const sentry = vi.hoisted(() => ({ init: vi.fn(), captureRequestError: vi.fn() }));
vi.mock('@sentry/nextjs', () => sentry);

import { onRequestError, register } from '@/instrumentation';

beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_APP_VERSION', '7');
});

afterEach(() => {
  vi.unstubAllEnvs();
  sentry.init.mockReset();
});

describe('register', () => {
  it('does not start error reporting without a DSN', () => {
    vi.stubEnv('NEXT_PUBLIC_SENTRY_DSN', '');
    register();
    expect(sentry.init).not.toHaveBeenCalled();
  });

  it('starts error reporting on the server without the browser tunnel', () => {
    vi.stubEnv('NEXT_PUBLIC_SENTRY_DSN', 'https://key@errors.example/1');
    register();
    expect(sentry.init).toHaveBeenCalledTimes(1);
    const options: unknown = sentry.init.mock.calls[0]?.[0];
    expect(options).toMatchObject({ dsn: 'https://key@errors.example/1', release: '7' });
    expect(options).not.toHaveProperty('tunnel');
  });
});

describe('onRequestError', () => {
  it('is the SDK request error hook', () => {
    expect(onRequestError).toBe(sentry.captureRequestError);
  });
});
