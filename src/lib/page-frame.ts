/**
 * Edges and anchor used to place one popover inside the app frame.
 */
export type FrameBoxInput = {
  frameLeft: number;
  frameRight: number;
  frameTop: number;
  frameBottom: number;
  anchorLeft: number;
  anchorTop: number;
  anchorBottom: number;
  gap: number;
  preferredWidth: number;
  inset: number;
  viewportHeight: number;
};

export type PlacedFrameBox = {
  left: number;
  width: number;
  maxHeight: number;
  top: number | null;
  bottom: number | null;
};

/**
 * Place one popover inside the app frame.
 *
 * @param input - Frame edges, anchor, gap, preferred width, inset, and viewport height, in pixels.
 * @returns The pixel box with maxHeight and exactly one of top or bottom, or null when the frame
 *   cannot hold a box.
 */
export function fitBoxInFrame(input: FrameBoxInput): PlacedFrameBox | null {
  const availableWidth = input.frameRight - input.frameLeft - input.inset * 2;
  const availableHeight = input.frameBottom - input.frameTop - input.inset * 2;
  if (!(availableWidth > 0) || !(availableHeight > 0) || !(input.preferredWidth > 0)) {
    return null;
  }
  const width = Math.min(input.preferredWidth, availableWidth);
  const minLeft = input.frameLeft + input.inset;
  const maxLeft = input.frameRight - input.inset - width;
  const left = Math.min(Math.max(input.anchorLeft, minLeft), maxLeft);
  const topEdge = Math.max(input.anchorBottom + input.gap, input.frameTop + input.inset);
  const spaceBelow = input.frameBottom - input.inset - topEdge;
  const panelBottom = Math.min(input.anchorTop - input.gap, input.frameBottom - input.inset);
  const spaceAbove = panelBottom - (input.frameTop + input.inset);
  const MIN = 280;
  if (spaceBelow >= MIN && spaceBelow >= spaceAbove) {
    return { left, width, maxHeight: spaceBelow, top: topEdge, bottom: null };
  }
  if (spaceAbove >= MIN) {
    return {
      left,
      width,
      maxHeight: spaceAbove,
      top: null,
      bottom: input.viewportHeight - panelBottom,
    };
  }
  return {
    left,
    width,
    maxHeight: availableHeight,
    top: input.frameTop + input.inset,
    bottom: null,
  };
}

/**
 * Problems with the live document. Empty means the page stays in the window.
 *
 * @returns Sideways-scroll and stick-out messages for boxes that leave the window horizontally or
 *   vertically. Empty when the page stays in the window.
 */
export function pageFrameProblems(): string[] {
  const problems: string[] = [];
  const root = document.documentElement;
  if (root.scrollWidth > root.clientWidth + 1) {
    problems.push('document scrolls sideways');
  }
  const active = document.querySelector('[data-scrollport][data-scroll-active]');
  if (active instanceof HTMLElement && active.scrollWidth > active.clientWidth + 1) {
    problems.push('page scrolls sideways');
  }

  function labelFor(node: Element): string {
    const tag = node.tagName.toLowerCase();
    if (node.id !== '') {
      return `${tag}#${node.id}`;
    }
    // SVG className is an object. A string check avoids throwing and skips those tokens.
    const raw: unknown =
      node instanceof SVGElement || node instanceof HTMLElement ? node.className : '';
    if (typeof raw === 'string') {
      const tokens = raw
        .split(/\s+/)
        .filter((token) => token !== '')
        .slice(0, 3);
      if (tokens.length > 0) {
        return `${tag}.${tokens.join('.')}`;
      }
    }
    return tag;
  }

  const stickOut: string[] = [];
  for (const node of document.body.querySelectorAll('*')) {
    // Slides inside the row may sit outside the window. The row element itself is checked.
    if (node.closest('[data-scroll-x]') !== null && !node.hasAttribute('data-scroll-x')) {
      continue;
    }
    const rect = node.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) {
      continue;
    }
    const horizontal = rect.left < -1 || rect.right > window.innerWidth + 1;
    const verticalOverflow = rect.top < -1 || rect.bottom > window.innerHeight + 1;
    if (!horizontal && !verticalOverflow) {
      continue;
    }
    const label = labelFor(node);
    if (horizontal) {
      stickOut.push(
        `sticks out: ${label} left=${Math.round(rect.left)} right=${Math.round(rect.right)}`,
      );
    }
    if (verticalOverflow) {
      const scrollport = node.parentElement!.closest('[data-scrollport]');
      const excused = scrollport !== null && getComputedStyle(node).position !== 'fixed';
      if (!excused) {
        stickOut.push(
          `sticks out: ${label} top=${Math.round(rect.top)} bottom=${Math.round(rect.bottom)}`,
        );
      }
    }
  }

  const shown = stickOut.length;
  for (const line of stickOut.slice(0, 5)) {
    problems.push(line);
  }
  if (shown > 5) {
    problems.push(`${shown - 5} more boxes stick out`);
  }
  return problems;
}
