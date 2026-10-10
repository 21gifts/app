// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { POST } from '@/app/monitoring/route';
import { forwardSentryEnvelope } from '@/lib/sentry';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('POST /monitoring', () => {
  it('exports the tunnel', () => {
    expect(POST).toBe(forwardSentryEnvelope);
  });

  it('answers 404 while error reporting is off', async () => {
    vi.stubEnv('NEXT_PUBLIC_SENTRY_DSN', '');
    const response = await POST(
      new Request('http://localhost/monitoring', { method: 'POST', body: '{}' }),
    );
    expect(response.status).toBe(404);
  });
});
