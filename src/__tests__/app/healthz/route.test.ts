// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { GET } from '@/app/healthz/route';

describe('GET /healthz', () => {
  it('returns 200 with status ok', async () => {
    const res = GET();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: 'ok' });
  });

  it('returns JSON content-type', () => {
    const res = GET();
    expect(res.headers.get('content-type')).toMatch(/application\/json/);
  });
});
