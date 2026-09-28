/** Keeps a target visible inside the application's single active scrollport. */
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
