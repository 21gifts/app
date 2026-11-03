// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { POST } from '@/app/messages/[id]/repayment/due/route';

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.NEXT_PUBLIC_API_URL;
});

describe('POST /messages/[id]/repayment/due', () => {
  it('is the due repayment proxy', async () => {
    process.env.NEXT_PUBLIC_API_URL = 'https://api.test';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 200 })));
    const response = await POST(
      new Request('http://localhost/messages/m1/repayment/due', { method: 'POST' }),
      { params: Promise.resolve({ id: 'm1' }) },
    );
    expect(response.status).toBe(200);
  });
});
