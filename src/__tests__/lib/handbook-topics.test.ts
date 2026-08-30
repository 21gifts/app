import { describe, expect, it } from 'vitest';
import {
  comboTheme,
  comboViewport,
  defaultCombo,
  HANDBOOK_COMBOS,
  makeCombo,
  topicImageSrc,
  type HandbookTopic,
} from '@/lib/handbook-topics';

const topic: HandbookTopic = {
  id: 'root:default',
  label: '/ default',
  visual: 'screen-root',
  combos: [...HANDBOOK_COMBOS],
};

describe('handbook-topics', () => {
  it('builds image src and combo parts', () => {
    expect(topicImageSrc(topic, 'desktop-light')).toBe(
      '/handbook-images/screen-root-desktop-light.png',
    );
    expect(comboViewport('mobile-dark')).toBe('mobile');
    expect(comboViewport('desktop-light')).toBe('desktop');
    expect(comboTheme('mobile-dark')).toBe('dark');
    expect(comboTheme('desktop-light')).toBe('light');
    expect(makeCombo('mobile', 'dark')).toBe('mobile-dark');
  });

  it('prefers desktop-light then the first combo', () => {
    expect(defaultCombo([...HANDBOOK_COMBOS])).toBe('desktop-light');
    expect(defaultCombo(['mobile-dark'])).toBe('mobile-dark');
    expect(defaultCombo([])).toBeNull();
  });
});
