import { afterEach, describe, expect, it, vi } from 'vitest';

const sentry = vi.hoisted(() => ({
  init: vi.fn(),
  captureRouterTransitionStart: vi.fn(),
  webVitalsIntegration: vi.fn((options: unknown) => ({ name: 'WebVitals', options })),
}));
vi.mock('@sentry/nextjs', () => sentry);

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
  sentry.init.mockReset();
});

/**
 * Options of the one `init` call.
 *
 * @returns The options `init` received.
 */
function initOptions(): {
  integrations: (defaults: Array<{ name: string }>) => Array<{ name: string; options?: unknown }>;
} {
  expect(sentry.init).toHaveBeenCalledTimes(1);
  return sentry.init.mock.calls[0]?.[0];
}

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

  it('starts browser tracing at the configured rate without trace headers', async () => {
    vi.stubEnv('NEXT_PUBLIC_SENTRY_DSN', 'https://key@errors.example/1');
    vi.stubEnv('NEXT_PUBLIC_APP_VERSION', '7');
    vi.stubEnv('NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE', '0.3');
    await import('@/instrumentation-client');
    expect(sentry.init.mock.calls[0]?.[0]).toMatchObject({
      tracesSampleRate: 0.3,
      traceLifecycle: 'static',
      tracePropagationTargets: [],
    });
  });

  it('keeps browser tracing, drops sessions and console capture, and leaves INP out', async () => {
    vi.stubEnv('NEXT_PUBLIC_SENTRY_DSN', 'https://key@errors.example/1');
    vi.stubEnv('NEXT_PUBLIC_APP_VERSION', '7');
    await import('@/instrumentation-client');
    const kept = initOptions().integrations([
      { name: 'BrowserTracing' },
      { name: 'BrowserSession' },
      { name: 'Console' },
      { name: 'GlobalHandlers' },
    ]);
    expect(kept).toEqual([
      { name: 'BrowserTracing' },
      { name: 'GlobalHandlers' },
      { name: 'WebVitals', options: { ignore: ['inp'] } },
    ]);
  });

  it.each([
    ['removes', 'https://key@errors.example/1', 0],
    ['keeps', '', 2],
  ])('%s the server trace meta tags with DSN %j', async (_verb, dsn, left) => {
    vi.stubEnv('NEXT_PUBLIC_SENTRY_DSN', dsn);
    vi.stubEnv('NEXT_PUBLIC_APP_VERSION', '7');
    document.head.innerHTML =
      '<meta name="sentry-trace" content="a-b-0"><meta name="baggage" content="sentry-sampled=false"><meta name="description" content="x">';
    await import('@/instrumentation-client');
    expect(
      document.querySelectorAll('meta[name="sentry-trace"], meta[name="baggage"]'),
    ).toHaveLength(left);
    expect(document.querySelector('meta[name="description"]')).not.toBeNull();
    document.head.innerHTML = '';
  });

  it('hands App Router navigations to the SDK', async () => {
    vi.stubEnv('NEXT_PUBLIC_SENTRY_DSN', '');
    const { onRouterTransitionStart } = await import('@/instrumentation-client');
    expect(onRouterTransitionStart).toBe(sentry.captureRouterTransitionStart);
  });
});
