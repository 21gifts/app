// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GET } from '@/app/team/audit/route';
import { proxyTeamAuditGet } from '@/lib/api-proxies';

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.NEXT_PUBLIC_API_URL;
});

describe('GET /team/audit', () => {
  it('re-exports proxyTeamAuditGet', async () => {
    expect(GET).toBe(proxyTeamAuditGet);
    process.env.NEXT_PUBLIC_API_URL = 'https://api.test';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 200 })));
    expect((await GET(new Request('http://localhost/team/audit'))).status).toBe(200);
  });
});
