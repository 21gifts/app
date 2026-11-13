/** What the Tab key can reach inside a modal dialog. */
const FOCUSABLE = 'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])';

/**
 * Keeps Tab and Shift+Tab inside an open modal, so the keyboard never reaches the inert page
 * behind it. Focus outside the panel moves to its first control; with no control, the panel keeps
 * it.
 *
 * @param event - The Tab keydown.
 * @param panel - The modal dialog panel.
 */
export function keepTabInside(event: KeyboardEvent, panel: HTMLElement): void {
  const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (item) => !item.hasAttribute('disabled') && item.closest('[inert]') === null,
  );
  const active = document.activeElement;
  const first = items[0];
  const last = items[items.length - 1];
  if (first === undefined || last === undefined) {
    event.preventDefault();
    panel.focus({ preventScroll: true });
    return;
  }
  if (!(active instanceof Node) || !panel.contains(active)) {
    event.preventDefault();
    first.focus({ preventScroll: true });
    return;
  }
  if (event.shiftKey && (active === first || active === panel)) {
    event.preventDefault();
    last.focus({ preventScroll: true });
  } else if (!event.shiftKey && active === last) {
    event.preventDefault();
    first.focus({ preventScroll: true });
  }
}
