import { describe, expect, it } from 'vitest';
import { activeMention } from '@/lib/mention-caret';

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
