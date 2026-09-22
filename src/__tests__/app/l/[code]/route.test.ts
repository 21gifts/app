// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GET } from '@/app/l/[code]/route';

const redirect = vi.fn((path: string) => {
  throw new Error(`REDIRECT:${path}`);
});
const notFound = vi.fn(() => {
  throw new Error('NOT_FOUND');
});

vi.mock('next/navigation', () => ({
  redirect: (path: string) => redirect(path),
  notFound: () => notFound(),
}));

const NOTE_ID = '77e0510d-03a8-4063-8716-75d61178e7f1';
const MEMBER_ID = 'd70c4763-3033-43da-817a-2c7de9938f27';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  redirect.mockClear();
  notFound.mockClear();
  delete process.env.NEXT_PUBLIC_API_URL;
});

/** Calls the short-link redirect route. */
function load(code: string): Promise<never> {
  return GET(new Request(`http://localhost/l/${code}`), {
    params: Promise.resolve({ code }),
  });
}

describe('/l/[code]', () => {
  it('calls notFound for a code that is not 8 hex and does not fetch', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await expect(load('[code]')).rejects.toThrow('NOT_FOUND');
    await expect(load('77e0510')).rejects.toThrow('NOT_FOUND');
    await expect(load('zzzzzzzz')).rejects.toThrow('NOT_FOUND');
    expect(fetchMock).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
  });

  it('redirects a message body and lowercases the code', async () => {
    process.env.NEXT_PUBLIC_API_URL = 'https://api.test';
    const timeoutSpy = vi.spyOn(AbortSignal, 'timeout');
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ kind: 'message', id: NOTE_ID.toUpperCase() }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);
    await expect(load('77E0510D')).rejects.toThrow(`REDIRECT:/messages/${NOTE_ID}`);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.test/links/77e0510d');
    expect(init.cache).toBe('no-store');
    expect(init.headers).toEqual({ Accept: 'application/json' });
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(timeoutSpy).toHaveBeenCalledWith(2500);
    expect(notFound).not.toHaveBeenCalled();
  });

  it('redirects a member body', async () => {
    process.env.NEXT_PUBLIC_API_URL = 'https://api.test';
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ kind: 'member', id: MEMBER_ID }), { status: 200 }),
        ),
    );
    await expect(load('d70c4763')).rejects.toThrow(`REDIRECT:/members/${MEMBER_ID}`);
  });

  it('calls notFound when the lookup is not OK', async () => {
    process.env.NEXT_PUBLIC_API_URL = 'https://api.test';
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    for (const status of [400, 404, 409, 500]) {
      fetchMock.mockResolvedValueOnce(new Response('nope', { status }));
      await expect(load('77e0510d')).rejects.toThrow('NOT_FOUND');
    }
    expect(redirect).not.toHaveBeenCalled();
  });

  it('calls notFound when fetch throws', async () => {
    process.env.NEXT_PUBLIC_API_URL = 'https://api.test';
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    await expect(load('77e0510d')).rejects.toThrow('NOT_FOUND');
  });

  it('calls notFound when the api url is missing', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await expect(load('77e0510d')).rejects.toThrow('NOT_FOUND');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('calls notFound when the body is not JSON', async () => {
    process.env.NEXT_PUBLIC_API_URL = 'https://api.test';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('not-json', { status: 200 })));
    await expect(load('77e0510d')).rejects.toThrow('NOT_FOUND');
  });

  it('calls notFound when the body is not a message or member uuid', async () => {
    process.env.NEXT_PUBLIC_API_URL = 'https://api.test';
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(new Response(JSON.stringify({ error: 'ambiguous' }), { status: 200 })),
    );
    await expect(load('77e0510d')).rejects.toThrow('NOT_FOUND');
    expect(redirect).not.toHaveBeenCalled();
  });
});
