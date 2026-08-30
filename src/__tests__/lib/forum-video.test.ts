import { describe, expect, it } from 'vitest';
import { forumVideoSrc, isForumVideoFile, prepareForumVideo } from '@/lib/forum-video';

describe('forum-video', () => {
  it('accepts mp4 webm mov by type or name', () => {
    expect(isForumVideoFile(new File([], 'a.mp4', { type: 'video/mp4' }))).toBe(true);
    expect(isForumVideoFile(new File([], 'a.webm', { type: 'video/webm' }))).toBe(true);
    expect(isForumVideoFile(new File([], 'a.mov', { type: 'video/quicktime' }))).toBe(true);
    expect(isForumVideoFile(new File([], 'clip.MP4', { type: '' }))).toBe(true);
    expect(isForumVideoFile(new File([], 'a.jpg', { type: 'image/jpeg' }))).toBe(false);
  });

  it('rejects oversized files', async () => {
    const big = new File([new Uint8Array(32 * 1024 * 1024 + 1)], 'a.mp4', { type: 'video/mp4' });
    expect(await prepareForumVideo(big)).toEqual({ ok: false, error: 'tooLarge' });
  });

  it('reaches poster capture for a small mp4', async () => {
    const file = new File([new Uint8Array([1, 2, 3])], 'a.mp4', { type: 'video/mp4' });
    const result = await prepareForumVideo(file);
    expect(result.ok).toBe(false);
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
