import { describe, expect, it } from 'vitest';
import {
  comboTheme,
  comboViewport,
  defaultCombo,
  HANDBOOK_COMBOS,
  makeCombo,
  topicAnchor,
  topicImageSrc,
  type HandbookTopic,
} from '@/lib/handbook-topics';

const topic: HandbookTopic = {
  id: 'root:default',
  label: '/ default',
  description: 'Desktop/wide layout without the hamburger.',
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

  it('builds stable topic anchors from catalog ids', () => {
    expect(topicAnchor('/:default')).toBe('root-default');
    expect(topicAnchor('/welcome:pay-qr')).toBe('welcome-pay-qr');
    expect(topicAnchor('/handbook/screens:dark')).toBe('handbook-screens-dark');
    expect(topicAnchor('no-colon')).toBe('no-colon');
  });
});
