import { afterEach, describe, expect, it, vi } from 'vitest';

const sentry = vi.hoisted(() => ({ init: vi.fn() }));
vi.mock('@sentry/nextjs', () => sentry);

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
  sentry.init.mockReset();
});

describe('instrumentation-client', () => {
  it('does not start error reporting without a DSN', async () => {
    vi.stubEnv('NEXT_PUBLIC_SENTRY_DSN', '');
    await import('@/instrumentation-client');
    expect(sentry.init).not.toHaveBeenCalled();
  });

  it('starts error reporting through the same-origin tunnel with a DSN', async () => {
    vi.stubEnv('NEXT_PUBLIC_SENTRY_DSN', 'https://key@errors.example/1');
    vi.stubEnv('NEXT_PUBLIC_APP_VERSION', '7');
    await import('@/instrumentation-client');
    expect(sentry.init).toHaveBeenCalledTimes(1);
    expect(sentry.init.mock.calls[0]?.[0]).toMatchObject({
      dsn: 'https://key@errors.example/1',
      release: '7',
      tunnel: '/monitoring',
    });
  });
});
