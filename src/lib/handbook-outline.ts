import { pathAnchor, topicAnchor, type HandbookTopic } from '@/lib/handbook-topics';

/** One variant leaf in the screens outline. */
export type HandbookOutlineTopic = {
  /** Topic catalog id. */
  topic: HandbookTopic;
  /** Hash id for the figure (`topicAnchor`). */
  id: string;
  /** Short variant label (`default`, `pay-qr`, …). */
  label: string;
};

/** One screen (subchapter) under a chapter. */
export type HandbookOutlineScreen = {
  /** Hash id (`screen-setup-rules`). */
  id: string;
  /** Full route (`/setup/rules`). */
  path: string;
  /** Visible heading (the route). */
  label: string;
  /** Variants in catalog order. */
  topics: HandbookOutlineTopic[];
};

/** One chapter (first path segment). */
export type HandbookOutlineChapter = {
  /** Hash id (`chapter-setup`). */
  id: string;
  /** Chapter label (`/setup`, `/`, …). */
  label: string;
  /** Screens in catalog order. */
  screens: HandbookOutlineScreen[];
};

/**
 * Route half of a catalog topic id (`${route}:${variant}`).
 *
 * @param id - Catalog topic id.
 * @returns The path before the last `:`, `/` when that slice is empty
 *   (`:variant`), or the whole id when there is no colon.
 */
export function topicPath(id: string): string {
  const colon = id.lastIndexOf(':');
  const path = colon < 0 ? id : id.slice(0, colon);
  return path === '' ? '/' : path;
}

/**
 * Variant half of a catalog topic id.
 *
 * @param id - Catalog topic id.
 * @returns The segment after the last `:`, or an empty string.
 */
export function topicVariant(id: string): string {
  const colon = id.lastIndexOf(':');
  return colon < 0 ? '' : id.slice(colon + 1);
}

/**
 * Chapter key for a screen path: first segment (`/setup/rules` → `/setup`).
 * `/` stays `/`.
 *
 * @param path - Screen route.
 * @returns Chapter label used as the h2.
 */
export function screenChapter(path: string): string {
  if (path === '/' || path === '') {
    return '/';
  }
  const stripped = path.replace(/^\//, '');
  const first = stripped.split('/')[0];
  /* v8 ignore next 3 — split of a non-empty path always yields a first segment */
  if (first === undefined) {
    return path.startsWith('/') ? '/' : path;
  }
  return path.startsWith('/') ? `/${first}` : first;
}

/**
 * Next index when stepping through a flat slide list with the arrow keys.
 *
 * `null` current means the gallery is closed: Right opens the first slide,
 * Left opens the last. Empty lists stay at 0.
 *
 * @param length - Number of slides.
 * @param current - Current index, or `null` when closed.
 * @param direction - `1` (Right) or `-1` (Left).
 * @returns Index in `0 … length-1`, or `0` when `length` is 0.
 */
export function nextOutlineIndex(
  length: number,
  current: number | null,
  direction: 1 | -1,
): number {
  if (length <= 0) {
    return 0;
  }
  if (current === null) {
    return direction === 1 ? 0 : length - 1;
  }
  return (current + direction + length) % length;
}

/**
 * Group topics into chapter → screen → variant, preserving catalog order.
 * Topics with empty `combos` are omitted.
 *
 * @param topics - Screen-variant topics.
 * @returns Nested outline; empty when nothing remains.
 */
export function buildHandbookOutline(topics: readonly HandbookTopic[]): HandbookOutlineChapter[] {
  const chapters: HandbookOutlineChapter[] = [];
  const chapterByLabel = new Map<string, HandbookOutlineChapter>();
  const screenByPath = new Map<string, HandbookOutlineScreen>();

  for (const topic of topics) {
    if (topic.combos.length === 0) {
      continue;
    }
    const path = topicPath(topic.id);
    const variant = topicVariant(topic.id);
    const chapterLabel = screenChapter(path);
    let chapter = chapterByLabel.get(chapterLabel);
    if (chapter === undefined) {
      chapter = {
        id: `chapter-${pathAnchor(chapterLabel)}`,
        label: chapterLabel,
        screens: [],
      };
      chapterByLabel.set(chapterLabel, chapter);
      chapters.push(chapter);
    }
    let screen = screenByPath.get(path);
    if (screen === undefined) {
      screen = {
        id: `screen-${pathAnchor(path)}`,
        path,
        label: path,
        topics: [],
      };
      screenByPath.set(path, screen);
      chapter.screens.push(screen);
    }
    screen.topics.push({
      topic,
      id: topicAnchor(topic.id),
      label: variant === '' ? topic.label : variant,
    });
  }
  return chapters;
}
