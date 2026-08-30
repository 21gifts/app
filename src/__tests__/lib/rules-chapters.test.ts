import { describe, expect, it } from 'vitest';
import { RULES_CHAPTER_IDS } from '@/lib/rules-chapters';

describe('RULES_CHAPTER_IDS', () => {
  it('lists the nine chapters in document order', () => {
    expect(RULES_CHAPTER_IDS).toEqual([
      'lead',
      'law1',
      'law2',
      'law3',
      'wanted',
      'allowed',
      'ratherNot',
      'forbidden',
      'house',
    ]);
    expect(RULES_CHAPTER_IDS).toHaveLength(9);
  });
});
