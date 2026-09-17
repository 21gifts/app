import { describe, expect, it } from 'vitest';
import { FORUM_TEXT_PREVIEW_LIMIT, forumTextPreview } from '@/lib/forum-text-preview';

describe('forumTextPreview', () => {
  it('keeps an empty string unchanged', () => {
    expect(forumTextPreview('')).toEqual({ preview: '', truncated: false });
  });

  it('keeps a short string unchanged', () => {
    expect(forumTextPreview('Hello from Ada')).toEqual({
      preview: 'Hello from Ada',
      truncated: false,
    });
  });

  it('keeps text at the default limit unchanged', () => {
    const text = 'a'.repeat(FORUM_TEXT_PREVIEW_LIMIT);
    expect(forumTextPreview(text)).toEqual({ preview: text, truncated: false });
  });

  it('hard-cuts text without whitespace', () => {
    const result = forumTextPreview('a'.repeat(281));
    expect(result).toEqual({ preview: 'a'.repeat(280), truncated: true });
    expect(result.preview).not.toContain('…');
  });

  it('cuts at a space in the last fifth of the preview', () => {
    expect(forumTextPreview(`${'a'.repeat(279)} b`)).toEqual({
      preview: 'a'.repeat(279),
      truncated: true,
    });
  });

  it('keeps the hard cut when the last space is below the boundary', () => {
    expect(forumTextPreview(`${'a'.repeat(200)} ${'b'.repeat(80)}`)).toEqual({
      preview: `${'a'.repeat(200)} ${'b'.repeat(79)}`,
      truncated: true,
    });
  });

  it('cuts at a newline in the last fifth of the preview', () => {
    expect(forumTextPreview(`${'a'.repeat(250)}\n${'b'.repeat(50)}`)).toEqual({
      preview: 'a'.repeat(250),
      truncated: true,
    });
  });

  it('keeps a newline in the middle of a hard cut', () => {
    const result = forumTextPreview(`hello\n${'a'.repeat(300)}`);
    expect(result.preview).toBe(`hello\n${'a'.repeat(274)}`);
    expect(result.truncated).toBe(true);
  });

  it('trims trailing spaces and tabs after cutting', () => {
    expect(forumTextPreview(`${'a'.repeat(270)}${' '.repeat(20)}`)).toEqual({
      preview: 'a'.repeat(270),
      truncated: true,
    });
    expect(forumTextPreview(`${'a'.repeat(280)}\tmore`, 281)).toEqual({
      preview: 'a'.repeat(280),
      truncated: true,
    });
  });

  it('accepts a custom limit', () => {
    expect(forumTextPreview('abcdefghijklmnop', 10)).toEqual({
      preview: 'abcdefghij',
      truncated: true,
    });
  });
});
