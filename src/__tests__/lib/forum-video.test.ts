import { afterEach, describe, expect, it, vi } from 'vitest';
import { forumVideoSrc, isForumVideoFile, prepareForumVideo } from '@/lib/forum-video';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** jsdom's URL may omit createObjectURL / revokeObjectURL. */
function stubUrlObjectMethods(): void {
  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    writable: true,
    value: () => 'blob:preview',
  });
  Object.defineProperty(URL, 'revokeObjectURL', {
    configurable: true,
    writable: true,
    value: () => undefined,
  });
}

describe('forum-video', () => {
  it('accepts mp4 webm mov m4v by type or name', () => {
    expect(isForumVideoFile(new File([], 'a.mp4', { type: 'video/mp4' }))).toBe(true);
    expect(isForumVideoFile(new File([], 'a.webm', { type: 'video/webm' }))).toBe(true);
    expect(isForumVideoFile(new File([], 'a.mov', { type: 'video/quicktime' }))).toBe(true);
    expect(isForumVideoFile(new File([], 'a.m4v', { type: 'video/x-m4v' }))).toBe(true);
    expect(isForumVideoFile(new File([], 'clip.MP4', { type: '' }))).toBe(true);
    expect(isForumVideoFile(new File([], 'clip.M4V', { type: '' }))).toBe(true);
    expect(isForumVideoFile(new File([], 'a.jpg', { type: 'image/jpeg' }))).toBe(false);
  });

  it('rejects oversized files', async () => {
    const big = new File([new Uint8Array(32 * 1024 * 1024 + 1)], 'a.mp4', { type: 'video/mp4' });
    expect(await prepareForumVideo(big)).toEqual({ ok: false, error: 'tooLarge' });
  });

  it('returns a fallback jpeg poster when the browser cannot decode a small mp4', async () => {
    stubUrlObjectMethods();
    const file = new File([new Uint8Array([1, 2, 3])], 'a.mp4', { type: 'video/mp4' });
    const result = await prepareForumVideo(file);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.video.file).toBe(file);
    expect(result.video.poster.type).toBe('image/jpeg');
    expect(result.video.poster.size).toBeGreaterThan(0);
    expect(result.video.previewUrl).toBe('blob:preview');
    const bytes = new Uint8Array(await result.video.poster.arrayBuffer());
    expect([...bytes.slice(0, 3)]).toEqual([0xff, 0xd8, 0xff]);
  });

  it('returns a fallback jpeg poster for a small quicktime mov', async () => {
    stubUrlObjectMethods();
    const file = new File([new Uint8Array([1, 2, 3])], 'clip.mov', { type: 'video/quicktime' });
    const result = await prepareForumVideo(file);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.video.poster.type).toBe('image/jpeg');
    expect(result.video.poster.size).toBeGreaterThan(0);
    expect(result.video.previewUrl).toBe('blob:preview');
  });

  it('rejects unsupported types', async () => {
    const file = new File([new Uint8Array([1])], 'a.gif', { type: 'image/gif' });
    expect(await prepareForumVideo(file)).toEqual({ ok: false, error: 'unsupported' });
  });

  it('maps videoContentType to the matching same-origin extension', () => {
    expect(forumVideoSrc('m1', 'video/mp4')).toBe('/messages/m1/video.mp4');
    expect(forumVideoSrc('m1', 'video/webm')).toBe('/messages/m1/video.webm');
    expect(forumVideoSrc('m1', 'video/quicktime')).toBe('/messages/m1/video.mov');
    expect(forumVideoSrc('m1', null)).toBe('/messages/m1/video.mp4');
    expect(forumVideoSrc('m1', undefined)).toBe('/messages/m1/video.mp4');
    expect(forumVideoSrc('m1', 'video/ogg')).toBe('/messages/m1/video.mp4');
  });
});
