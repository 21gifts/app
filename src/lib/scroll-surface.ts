/** Overflow values that create a scrollport. `hidden` and `clip` do not. */
const SCROLLING_OVERFLOW = new Set(['auto', 'scroll', 'overlay']);

const stack: HTMLElement[] = [];

/**
 * Whether a computed overflow value can scroll.
 *
 * @param value - `overflow-x` or `overflow-y` from computed style.
 * @returns True for `auto`, `scroll`, and the legacy `overlay` value.
 */
function isScrollingOverflow(value: string): boolean {
  return SCROLLING_OVERFLOW.has(value);
}

/**
 * Grow a textarea to its text so the field itself never scrolls.
 *
 * @param el - The field to size.
 * @returns Nothing.
 */
function fitTextarea(el: HTMLTextAreaElement): void {
  el.style.setProperty('overflow', 'hidden', 'important');
  // An empty field already fits. Forcing a pixel height shifts the composer.
  if (!el.value.includes('\n') && el.scrollHeight <= el.clientHeight + 4) {
    return;
  }
  el.style.height = 'auto';
  el.style.height = `${el.scrollHeight}px`;
}

/**
 * The scrollport that is allowed to scroll right now.
 *
 * @returns The newest bound element, or `null` when none is bound.
 */
function activeScrollport(): HTMLElement | null {
  return stack.at(-1) ?? null;
}

/**
 * Leave exactly one scrollport unlocked and force every other scrolling
 * element to clip. Textareas grow to their text instead of scrolling.
 *
 * @returns Nothing.
 */
export function syncScrollSurfaces(): void {
  const active = activeScrollport();
  const ports = document.querySelectorAll('[data-scrollport]');
  for (const node of ports) {
    if (!(node instanceof HTMLElement)) {
      continue;
    }
    if (node === active) {
      node.removeAttribute('data-scroll-locked');
    } else {
      node.setAttribute('data-scroll-locked', '');
    }
  }
  const nodes = document.body.querySelectorAll('*');
  for (const node of nodes) {
    if (!(node instanceof HTMLElement)) {
      continue;
    }
    if (node instanceof HTMLTextAreaElement) {
      fitTextarea(node);
      continue;
    }
    if (
      node instanceof HTMLInputElement ||
      node instanceof HTMLSelectElement ||
      node instanceof HTMLOptionElement
    ) {
      continue;
    }
    if (node === active) {
      continue;
    }
    const computed = getComputedStyle(node);
    const scrolling =
      isScrollingOverflow(computed.overflowY) ||
      isScrollingOverflow(computed.overflowX) ||
      isScrollingOverflow(node.style.overflow) ||
      isScrollingOverflow(node.style.overflowX) ||
      isScrollingOverflow(node.style.overflowY);
    if (!scrolling) {
      continue;
    }
    node.style.setProperty('overflow', 'hidden', 'important');
  }
}

/**
 * Make `el` the active scrollport. A second bind of the same element does
 * not stack it twice.
 *
 * @param el - The scrollport element that just mounted.
 * @returns Nothing.
 */
export function bindScrollport(el: HTMLElement): void {
  if (!stack.includes(el)) {
    stack.push(el);
  }
  syncScrollSurfaces();
}

/**
 * Drop `el` from the active stack. The previous scrollport starts scrolling
 * again. Releasing an element that is not bound is a no-op.
 *
 * @param el - The scrollport element that unmounted.
 * @returns Nothing.
 */
export function releaseScrollport(el: HTMLElement): void {
  const index = stack.lastIndexOf(el);
  if (index >= 0) {
    stack.splice(index, 1);
  }
  syncScrollSurfaces();
}
