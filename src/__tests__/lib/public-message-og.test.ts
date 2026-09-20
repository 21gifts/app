// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import type { ForumMessage } from '@/lib/api-types';
import { loadPublicMessageForOg, publicMessageOgMetadata } from '@/lib/public-message-og';

const API = 'https://api.test';
const MESSAGE_ID = '11111111-1111-4111-8111-111111111111';
const DEFAULT_OG_ALT = '21.gifts — peer-to-peer Bitcoin gifts';

const sample: ForumMessage = {
  id: MESSAGE_ID,
  name: 'Ada',
  text: 'Hello from Ada',
  createdAt: '2026-08-28T12:00:00.000Z',
  sats: 21,
  payable: false,
  hasPhoto: false,
  photoCount: 0,
  hasVideo: false,
  videoContentType: null,
  role: 'basis',
  replyCount: 0,
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  delete process.env.NEXT_PUBLIC_API_URL;
});

beforeEach(() => {
  process.env.NEXT_PUBLIC_API_URL = API;
});

/** Installs a `fetch` mock that resolves with the given Response. */
function stubFetch(response: Response): Mock {
  const fetchMock = vi.fn().mockResolvedValue(response);
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('loadPublicMessageForOg', () => {
  it('returns null without fetching when the id is not a UUID', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(loadPublicMessageForOg('not-a-uuid')).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns null when getApiUrl throws', async () => {
    delete process.env.NEXT_PUBLIC_API_URL;
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(loadPublicMessageForOg(MESSAGE_ID)).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns null when fetch throws', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')));

    await expect(loadPublicMessageForOg(MESSAGE_ID)).resolves.toBeNull();
  });

  it('returns null when fetch is aborted', async () => {
    const timeoutSpy = vi.spyOn(AbortSignal, 'timeout');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new DOMException('The operation was aborted.', 'AbortError')),
    );

    await expect(loadPublicMessageForOg(MESSAGE_ID)).resolves.toBeNull();
    expect(timeoutSpy).toHaveBeenCalledWith(2500);
    timeoutSpy.mockRestore();
  });

  it('returns null on 404', async () => {
    stubFetch(new Response('not found', { status: 404 }));

    await expect(loadPublicMessageForOg(MESSAGE_ID)).resolves.toBeNull();
  });

  it('returns null on 500', async () => {
    stubFetch(new Response('error', { status: 500 }));

    await expect(loadPublicMessageForOg(MESSAGE_ID)).resolves.toBeNull();
  });

  it('returns null when the body is not JSON', async () => {
    stubFetch(new Response('not-json', { status: 200 }));

    await expect(loadPublicMessageForOg(MESSAGE_ID)).resolves.toBeNull();
  });

  it('returns null when the body fails forumMessageSchema', async () => {
    stubFetch(
      new Response(JSON.stringify({ id: 'x' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    await expect(loadPublicMessageForOg(MESSAGE_ID)).resolves.toBeNull();
  });

  it('returns the parsed note and fetches with no-store', async () => {
    const fetchMock = stubFetch(
      new Response(JSON.stringify(sample), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    await expect(loadPublicMessageForOg(MESSAGE_ID)).resolves.toEqual(sample);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${API}/messages/${MESSAGE_ID}`);
    expect(init.cache).toBe('no-store');
    expect(init.headers).toEqual({ Accept: 'application/json' });
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });
});

describe('publicMessageOgMetadata', () => {
  it('returns empty metadata when the note is missing', () => {
    expect(publicMessageOgMetadata(MESSAGE_ID, null)).toEqual({});
  });

  it('uses the author name and note text without the marketing description', () => {
    const meta = publicMessageOgMetadata(MESSAGE_ID, sample);
    expect(meta.title).toBe('Ada');
    expect(meta.description).toBe('Hello from Ada');
    expect(meta.openGraph).toEqual({
      type: 'website',
      url: `https://21.gifts/messages/${MESSAGE_ID}`,
      siteName: '21.gifts',
      title: 'Ada',
      description: 'Hello from Ada',
      images: [{ url: '/og.png', width: 1200, height: 630, alt: DEFAULT_OG_ALT }],
    });
    expect(meta.twitter).toEqual({
      card: 'summary_large_image',
      title: 'Ada',
      description: 'Hello from Ada',
      images: [{ url: '/og.png', alt: DEFAULT_OG_ALT }],
    });
  });

  it('falls back to the name when text is empty', () => {
    const note: ForumMessage = { ...sample, text: '' };
    const meta = publicMessageOgMetadata(MESSAGE_ID, note);
    expect(meta.description).toBe('Ada on 21.gifts');
    expect(meta.openGraph).toMatchObject({ description: 'Ada on 21.gifts' });
    expect(meta.twitter).toMatchObject({ description: 'Ada on 21.gifts' });
  });

  it('falls back to the name when text is whitespace-only', () => {
    const note: ForumMessage = { ...sample, text: '   \n' };
    expect(publicMessageOgMetadata(MESSAGE_ID, note).description).toBe('Ada on 21.gifts');
  });

  it('truncates a description longer than 300 code units with an ellipsis', () => {
    const note: ForumMessage = { ...sample, text: 'x'.repeat(301) };
    const description = publicMessageOgMetadata(MESSAGE_ID, note).description;
    expect(description).toBe(`${'x'.repeat(299)}…`);
    expect(description).toHaveLength(300);
  });

  it('uses the default og.png image when hasPhoto is false', () => {
    const meta = publicMessageOgMetadata(MESSAGE_ID, sample);
    expect(meta.openGraph).toMatchObject({
      images: [{ url: '/og.png', width: 1200, height: 630, alt: DEFAULT_OG_ALT }],
    });
    expect(meta.twitter).toMatchObject({
      images: [{ url: '/og.png', alt: DEFAULT_OG_ALT }],
    });
  });

  it('uses the note photo URL when hasPhoto is true', () => {
    const note: ForumMessage = { ...sample, hasPhoto: true, photoCount: 1 };
    const meta = publicMessageOgMetadata(MESSAGE_ID, note);
    const photo = { url: `/messages/${MESSAGE_ID}/photo`, alt: 'Hello from Ada' };
    expect(meta.openGraph).toEqual({
      type: 'website',
      url: `https://21.gifts/messages/${MESSAGE_ID}`,
      siteName: '21.gifts',
      title: 'Ada',
      description: 'Hello from Ada',
      images: [photo],
    });
    expect(meta.twitter).toEqual({
      card: 'summary_large_image',
      title: 'Ada',
      description: 'Hello from Ada',
      images: [photo],
    });
  });

  it('uses the author name as photo alt when hasPhoto is true and text is empty', () => {
    const note: ForumMessage = { ...sample, text: '', hasPhoto: true, photoCount: 1 };
    const meta = publicMessageOgMetadata(MESSAGE_ID, note);
    const photo = { url: `/messages/${MESSAGE_ID}/photo`, alt: 'Ada' };
    expect(meta.openGraph).toEqual({
      type: 'website',
      url: `https://21.gifts/messages/${MESSAGE_ID}`,
      siteName: '21.gifts',
      title: 'Ada',
      description: 'Ada on 21.gifts',
      images: [photo],
    });
    expect(meta.twitter).toEqual({
      card: 'summary_large_image',
      title: 'Ada',
      description: 'Ada on 21.gifts',
      images: [photo],
    });
  });

  it('uses fully generic metadata with no visitor-chosen string', () => {
    const note: ForumMessage = {
      ...sample,
      via: 'nostr',
      name: '21.gifts Support',
      text: 'Official announcement https://example.com',
      hasPhoto: true,
      photoCount: 1,
    };
    const meta = publicMessageOgMetadata(MESSAGE_ID, note);
    expect(meta.title).toBe('Visitor on 21.gifts');
    expect(meta.description).toBe('A reply from a visitor who sent bitcoin to a post on 21.gifts.');
    expect(meta.openGraph).toEqual({
      type: 'website',
      url: `https://21.gifts/messages/${MESSAGE_ID}`,
      siteName: '21.gifts',
      title: 'Visitor on 21.gifts',
      description: 'A reply from a visitor who sent bitcoin to a post on 21.gifts.',
      images: [{ url: '/og.png', width: 1200, height: 630, alt: DEFAULT_OG_ALT }],
    });
    expect(meta.twitter).toEqual({
      card: 'summary_large_image',
      title: 'Visitor on 21.gifts',
      description: 'A reply from a visitor who sent bitcoin to a post on 21.gifts.',
      images: [{ url: '/og.png', alt: DEFAULT_OG_ALT }],
    });
    const visitorName = '21.gifts Support';
    const noteText = 'Official announcement https://example.com';
    const photoRoute = `/messages/${MESSAGE_ID}/photo`;
    expect(meta.title).not.toContain(visitorName);
    expect(meta.title).not.toContain(noteText);
    expect(meta.title).not.toContain(photoRoute);
    expect(meta.description).not.toContain(visitorName);
    expect(meta.description).not.toContain(noteText);
    expect(meta.description).not.toContain(photoRoute);
    expect(meta.openGraph!.title).not.toContain(visitorName);
    expect(meta.openGraph!.title).not.toContain(noteText);
    expect(meta.openGraph!.title).not.toContain(photoRoute);
    expect(meta.openGraph!.description).not.toContain(visitorName);
    expect(meta.openGraph!.description).not.toContain(noteText);
    expect(meta.openGraph!.description).not.toContain(photoRoute);
    expect(meta.twitter!.title).not.toContain(visitorName);
    expect(meta.twitter!.title).not.toContain(noteText);
    expect(meta.twitter!.title).not.toContain(photoRoute);
    expect(meta.twitter!.description).not.toContain(visitorName);
    expect(meta.twitter!.description).not.toContain(noteText);
    expect(meta.twitter!.description).not.toContain(photoRoute);
  });
});
