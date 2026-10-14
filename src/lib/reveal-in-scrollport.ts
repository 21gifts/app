/**
 * Attribute on the scrollport while a reveal follows a moving target (a fold easing open) frame by
 * frame. Code that reacts to the visitor's scrolling (the wallet footer's slim/full progress, the
 * forum's scroll memory) skips scroll events while it is set; the scroll that places the page at
 * the end of the move comes without it.
 */
export const SCROLL_FOLLOW_ATTR = 'data-scroll-follow';

/**
 * Keeps a target visible inside the application's single active scrollport.
 *
 * @param scroller - The one active scrollport.
 * @param target - Field or form to reveal. A target taller than the scroller is aligned to the bottom edge minus 12px. Otherwise only a top or bottom overflow is corrected by that same margin.
 * @returns void. Writes `scrollTop` on `scroller` only. Does not call `scrollIntoView` and does not scroll the document.
 */
export function revealInScrollport(scroller: HTMLElement, target: HTMLElement): void {
  const margin = 12;
  const scrollerRect = scroller.getBoundingClientRect();
  const targetRect = target.getBoundingClientRect();

  if (targetRect.height > scrollerRect.height - margin * 2) {
    scroller.scrollTop += targetRect.bottom - (scrollerRect.bottom - margin);
    return;
  }

  if (targetRect.bottom > scrollerRect.bottom - margin) {
    scroller.scrollTop += targetRect.bottom - (scrollerRect.bottom - margin);
  } else if (targetRect.top < scrollerRect.top + margin) {
    scroller.scrollTop -= scrollerRect.top + margin - targetRect.top;
  }
}
