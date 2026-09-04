import { describe, expect, it } from 'vitest';
import {
  buildHandbookOutline,
  nextOutlineIndex,
  screenChapter,
  topicPath,
  topicVariant,
} from '@/lib/handbook-outline';
import { HANDBOOK_COMBOS, type HandbookTopic } from '@/lib/handbook-topics';

function topic(id: string, combos: HandbookTopic['combos'] = [...HANDBOOK_COMBOS]): HandbookTopic {
  return {
    id,
    label: id,
    description: `${id} description`,
    visual: 'screen-x',
    combos,
  };
}

describe('handbook-outline', () => {
  it('splits catalog ids into path and variant', () => {
    expect(topicPath('/welcome:pay-qr')).toBe('/welcome');
    expect(topicVariant('/welcome:pay-qr')).toBe('pay-qr');
    expect(topicPath('no-colon')).toBe('no-colon');
    expect(topicVariant('no-colon')).toBe('');
  });

  it('uses the first path segment as the chapter', () => {
    expect(screenChapter('/')).toBe('/');
    expect(screenChapter('')).toBe('/');
    expect(screenChapter('/setup/rules')).toBe('/setup');
    expect(screenChapter('/handbook/screens')).toBe('/handbook');
    expect(screenChapter('/welcome')).toBe('/welcome');
    expect(screenChapter('welcome')).toBe('welcome');
  });

  it('nests chapter → screen → variant in catalog order and skips empty combos', () => {
    const outline = buildHandbookOutline([
      topic('/setup/name:default'),
      topic('empty', []),
      topic('/setup/rules:law1'),
      topic('/:default'),
      topic('/handbook/screens:dark'),
    ]);
    expect(outline.map((chapter) => chapter.label)).toEqual(['/setup', '/', '/handbook']);
    expect(outline[0]?.id).toBe('chapter-setup');
    expect(outline[0]?.screens.map((screen) => screen.path)).toEqual([
      '/setup/name',
      '/setup/rules',
    ]);
    expect(outline[0]?.screens[1]?.id).toBe('screen-setup-rules');
    expect(outline[0]?.screens[1]?.topics.map((leaf) => leaf.label)).toEqual(['law1']);
    expect(outline[0]?.screens[1]?.topics[0]?.id).toBe('setup-rules-law1');
    expect(outline[1]?.id).toBe('chapter-root');
    expect(outline[1]?.screens[0]?.id).toBe('screen-root');
    expect(outline[2]?.screens[0]?.topics[0]?.id).toBe('handbook-screens-dark');
  });

  it('steps through a closed or wrapping slide list', () => {
    expect(nextOutlineIndex(0, null, 1)).toBe(0);
    expect(nextOutlineIndex(3, null, 1)).toBe(0);
    expect(nextOutlineIndex(3, null, -1)).toBe(2);
    expect(nextOutlineIndex(3, 0, -1)).toBe(2);
    expect(nextOutlineIndex(3, 2, 1)).toBe(0);
    expect(nextOutlineIndex(3, 1, 1)).toBe(2);
  });
});
