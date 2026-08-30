/** Viewport × theme combo ids used by visual baselines. */
export const HANDBOOK_COMBOS = [
  'desktop-light',
  'desktop-dark',
  'mobile-light',
  'mobile-dark',
] as const;

/** One combo id (`desktop-light`, …). */
export type HandbookComboId = (typeof HANDBOOK_COMBOS)[number];

/** One handbook image topic (screen variant or function clip). */
export type HandbookTopic = {
  /** Stable id for the topic picker. */
  id: string;
  /** Visible label. */
  label: string;
  /** Playwright visual stem (`screen-root`, `function-GET`, …). */
  visual: string;
  /** Combo ids that have a baseline PNG. */
  combos: HandbookComboId[];
};

/**
 * Public URL for one topic combo image.
 *
 * @param topic - Topic row.
 * @param combo - Combo id that exists on `topic.combos`.
 * @returns Path under `/handbook-images/`.
 */
export function topicImageSrc(topic: HandbookTopic, combo: HandbookComboId): string {
  return `/handbook-images/${topic.visual}-${combo}.png`;
}

/**
 * Viewport half of a combo id.
 *
 * @param combo - Combo id.
 * @returns `desktop` or `mobile`.
 */
export function comboViewport(combo: HandbookComboId): 'desktop' | 'mobile' {
  return combo.startsWith('mobile') ? 'mobile' : 'desktop';
}

/**
 * Theme half of a combo id.
 *
 * @param combo - Combo id.
 * @returns `light` or `dark`.
 */
export function comboTheme(combo: HandbookComboId): 'light' | 'dark' {
  return combo.endsWith('dark') ? 'dark' : 'light';
}

/**
 * Build a combo id from viewport and theme.
 *
 * @param viewport - Desktop or mobile.
 * @param theme - Light or dark.
 * @returns Combo id.
 */
export function makeCombo(
  viewport: 'desktop' | 'mobile',
  theme: 'light' | 'dark',
): HandbookComboId {
  return `${viewport}-${theme}`;
}

/**
 * First combo to show for a topic (desktop-light when present).
 *
 * @param combos - Existing combo ids.
 * @returns A combo from `combos`, or `null` when the list is empty.
 */
export function defaultCombo(combos: HandbookComboId[]): HandbookComboId | null {
  if (combos.includes('desktop-light')) {
    return 'desktop-light';
  }
  return combos[0] ?? null;
}
