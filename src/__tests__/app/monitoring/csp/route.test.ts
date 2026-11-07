// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { POST } from '@/app/monitoring/csp/route';
import { forwardCspReport } from '@/lib/sentry';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('POST /monitoring/csp', () => {
  it('exports the report forwarder', () => {
    expect(POST).toBe(forwardCspReport);
  });

  it('answers 404 while error reporting is off', async () => {
    vi.stubEnv('NEXT_PUBLIC_SENTRY_DSN', '');
    const response = await POST(
      new Request('http://localhost/monitoring/csp', { method: 'POST', body: '{}' }),
    );
    expect(response.status).toBe(404);
  });
});
