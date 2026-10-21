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
    // Slides may only stick out of the window to the left or right.
    const slide = node.closest('[data-scroll-x]') !== null && !node.hasAttribute('data-scroll-x');
    const rect = node.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) {
      continue;
    }
    const overflowX = rect.left < -1 || rect.right > window.innerWidth + 1;
    const horizontal = overflowX && (!slide || getComputedStyle(node).position === 'fixed');
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
