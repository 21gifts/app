import { describe, expect, it } from 'vitest';
import { activeMention, remapClosedMentionStarts } from '@/lib/mention-caret';

describe('activeMention', () => {
  it('is active on a bare @ and lowercases the prefix before the caret', () => {
    expect(activeMention('@', 1)).toEqual({ start: 0, end: 1, query: '' });
    expect(activeMention('hi @Ada', 7)).toEqual({ start: 3, end: 7, query: 'ada' });
    expect(activeMention('@adam', 3)).toEqual({ start: 0, end: 5, query: 'ad' });
  });

  it('ignores an address, a caret outside the token, and a bad prefix', () => {
    expect(activeMention('name@21.gifts', 13)).toBeNull();
    expect(activeMention('@ada bye', 6)).toBeNull();
    expect(activeMention('@.', 2)).toBeNull();
    expect(activeMention('@_', 2)).toBeNull();
    expect(activeMention('@-', 2)).toBeNull();
    expect(activeMention(`@${'a'.repeat(33)}`, 34)).toBeNull();
    expect(activeMention('@ada', 0)).toBeNull();
    expect(activeMention('', 4)).toBeNull();
  });

  it('accepts a dotted handle and a mark after punctuation', () => {
    expect(activeMention('(@ada.b', 7)).toEqual({ start: 1, end: 7, query: 'ada.b' });
  });
});

describe('remapClosedMentionStarts', () => {
  it('returns the same set when the text or the set did not change', () => {
    const closed = new Set([0]);
    expect(remapClosedMentionStarts('hi @', 'hi @', closed, 4)).toBe(closed);
    expect(remapClosedMentionStarts('@a', '@b', new Set(), 2)).toEqual(new Set());
  });

  it('shifts a dismissed @ with text inserted before it', () => {
    expect(remapClosedMentionStarts('hi @a', 'xhi @a', new Set([3]), 1)).toEqual(new Set([4]));
  });

  it('drops a dismissed @ that was deleted so a later @ can open', () => {
    expect(remapClosedMentionStarts('@a @b', '@b', new Set([0]), 0)).toEqual(new Set());
  });

  it('drops a dismissed @ when the caret is unknown and the character is gone', () => {
    expect(remapClosedMentionStarts('hi @a', 'hi a', new Set([3]), null)).toEqual(new Set());
  });

  it('keeps an unchanged @ and ignores a caret that does not match the edit', () => {
    const closed = new Set([0]);
    expect(remapClosedMentionStarts('@ada', '@bob', closed, null)).toBe(closed);
    const stayed = new Set([1]);
    expect(remapClosedMentionStarts('a@b', 'x@b', stayed, 1)).toBe(stayed);
    expect(remapClosedMentionStarts('@a @b', '@b', new Set([0, 3]), 9)).toEqual(new Set([0]));
    expect(remapClosedMentionStarts('@a @b', '@b', new Set([0]), -1)).toEqual(new Set([0]));
    expect(remapClosedMentionStarts('ab@c', 'ab@cX', new Set([0, 2]), 5)).toEqual(new Set([2]));
    expect(remapClosedMentionStarts('@ab', '@abY', new Set([0, 5]), 4)).toEqual(new Set([0]));
  });
});
