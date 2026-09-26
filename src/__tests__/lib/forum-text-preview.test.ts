import { describe, expect, it } from 'vitest';
import {
  FORUM_TEXT_FULL_LIMIT,
  FORUM_TEXT_PREVIEW_LIMIT,
  forumTextPreview,
} from '@/lib/forum-text-preview';

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

  it('keeps text at the full limit unchanged', () => {
    const text = 'a'.repeat(FORUM_TEXT_FULL_LIMIT);
    expect(forumTextPreview(text)).toEqual({ preview: text, truncated: false });
  });

  it('hard-cuts text without whitespace', () => {
    const result = forumTextPreview('a'.repeat(FORUM_TEXT_FULL_LIMIT + 1));
    expect(result).toEqual({ preview: 'a'.repeat(280), truncated: true });
    expect(result.preview).not.toContain('…');
  });

  it('cuts at a space in the last fifth of the preview', () => {
    expect(forumTextPreview(`${'a'.repeat(279)} ${'b'.repeat(281)}`)).toEqual({
      preview: 'a'.repeat(279),
      truncated: true,
    });
  });

  it('keeps the hard cut when the last space is below the boundary', () => {
    expect(forumTextPreview(`${'a'.repeat(200)} ${'b'.repeat(360)}`)).toEqual({
      preview: `${'a'.repeat(200)} ${'b'.repeat(79)}`,
      truncated: true,
    });
  });

  it('cuts at a newline in the last fifth of the preview', () => {
    expect(forumTextPreview(`${'a'.repeat(250)}\n${'b'.repeat(310)}`)).toEqual({
      preview: 'a'.repeat(250),
      truncated: true,
    });
  });

  it('keeps a newline in the middle of a hard cut', () => {
    const result = forumTextPreview(`hello\n${'a'.repeat(555)}`);
    expect(result.preview).toBe(`hello\n${'a'.repeat(274)}`);
    expect(result.truncated).toBe(true);
  });

  it('trims trailing spaces and tabs after cutting', () => {
    expect(forumTextPreview(`${'a'.repeat(270)}${' '.repeat(20)}${'b'.repeat(271)}`)).toEqual({
      preview: 'a'.repeat(270),
      truncated: true,
    });
    expect(forumTextPreview(`${'a'.repeat(280)}\tmore${'b'.repeat(278)}`, 281)).toEqual({
      preview: 'a'.repeat(280),
      truncated: true,
    });
  });

  it('accepts a custom limit', () => {
    expect(forumTextPreview('abcdefghijklmnop', 10)).toEqual({
      preview: 'abcdefghijklmnop',
      truncated: false,
    });
    expect(forumTextPreview('abcdefghijklmnopqrstu', 10)).toEqual({
      preview: 'abcdefghij',
      truncated: true,
    });
  });

  it('drops a trailing http(s) URL that the hard cut splits', () => {
    const href = `https://example.com/${'a'.repeat(541)}`;
    expect(forumTextPreview(href)).toEqual({ preview: '', truncated: true });
  });

  it('keeps a complete http(s) URL that fits in the preview', () => {
    const text = `see https://example.com/x ${'a'.repeat(535)}`;
    const result = forumTextPreview(text);
    expect(result.truncated).toBe(true);
    expect(result.preview).toContain('https://example.com/x');
  });
});
