// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchShortLink } from '@/lib/api';

const NOTE_ID = '77e0510d-03a8-4063-8716-75d61178e7f1';
const MEMBER_ID = 'd70c4763-3033-43da-817a-2c7de9938f27';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** JSON response helper. */
function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('fetchShortLink', () => {
  it('returns null for an invalid code without fetching', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await expect(fetchShortLink('')).resolves.toBeNull();
    await expect(fetchShortLink('zzzzzzzz')).resolves.toBeNull();
    await expect(fetchShortLink('77e0510')).resolves.toBeNull();
    await expect(fetchShortLink('77e0510dd')).resolves.toBeNull();
    await expect(fetchShortLink(NOTE_ID)).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns a lowercased message id', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ kind: 'message', id: NOTE_ID.toUpperCase() }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(fetchShortLink('77E0510D')).resolves.toEqual({ kind: 'message', id: NOTE_ID });
    expect(fetchMock).toHaveBeenCalledWith('/links/77E0510D');
  });

  it('returns a member id', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse({ kind: 'member', id: MEMBER_ID })),
    );
    await expect(fetchShortLink('d70c4763')).resolves.toEqual({ kind: 'member', id: MEMBER_ID });
  });

  it('returns null on non-OK statuses', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    for (const status of [400, 404, 409, 500]) {
      fetchMock.mockResolvedValueOnce(jsonResponse({ error: 'nope' }, status));
      await expect(fetchShortLink('77e0510d')).resolves.toBeNull();
    }
  });

  it('returns null for an unexpected body', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const bodies: unknown[] = [
      null,
      [],
      'message',
      { kind: 'message' },
      { kind: 'message', id: 'not-a-uuid' },
      { error: 'not_found' },
    ];
    for (const body of bodies) {
      fetchMock.mockResolvedValueOnce(jsonResponse(body));
      await expect(fetchShortLink('77e0510d')).resolves.toBeNull();
    }
  });

  it('returns null when fetch or json fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    await expect(fetchShortLink('77e0510d')).resolves.toBeNull();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('not-json', { status: 200 })));
    await expect(fetchShortLink('77e0510d')).resolves.toBeNull();
  });
});
