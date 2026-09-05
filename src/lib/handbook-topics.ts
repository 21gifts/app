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
  /** Stable topic id (`${route}:${variant}`). */
  id: string;
  /** Visible label. */
  label: string;
  /**
   * English description of what the baseline shows (from `screens.md`;
   * handbook-body catalog exception).
   */
  description: string;
  /** Playwright visual stem (`screen-root`, `function-GET`, …). */
  visual: string;
  /** Combo ids that have a baseline PNG. */
  combos: HandbookComboId[];
};

/**
 * Hyphenated hash fragment for a screen path.
 *
 * `/` becomes `root`; other paths drop the leading `/` and replace remaining
 * `/` with `-`.
 *
 * @param path - Route (`/`, `/setup/rules`, …).
 * @returns `root`, `setup-rules`, …
 */
export function pathAnchor(path: string): string {
  if (path === '/' || path === '') {
    return 'root';
  }
  return path
    .replace(/^\//, '')
    .replace(/\//g, '-')
    .replace(/[^a-z0-9-]+/gi, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Stable DOM / hash id from a catalog topic id (`${route}:${variant}`).
 *
 * Path `/` becomes `root`; other paths drop the leading `/` and replace
 * remaining `/` with `-`. The variant is the segment after the last `:`.
 *
 * @param id - Catalog topic id (`/:default`, `/welcome:pay-qr`, …).
 * @returns Hyphenated anchor (`root-default`, `welcome-pay-qr`, …).
 */
export function topicAnchor(id: string): string {
  const colon = id.lastIndexOf(':');
  const path = colon < 0 ? id : id.slice(0, colon);
  const variant = colon < 0 ? '' : id.slice(colon + 1);
  const pathPart = pathAnchor(path);
  return variant === '' ? pathPart : `${pathPart}-${variant}`;
}

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
