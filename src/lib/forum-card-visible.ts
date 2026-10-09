/**
 * True when a forum note card sits fully inside the AppShell scrollport.
 *
 * @param card - Card border box in viewport coordinates.
 * @param root - Scrollport border box in viewport coordinates.
 * @param epsilonPx - Inclusive slack in CSS pixels (default 1).
 * @returns False for a zero-size card, a card taller than the root by more
 * than `epsilonPx`, or a card whose edges sit more than `epsilonPx` past the
 * root.
 */
export function isForumCardFullyVisible(
  card: Pick<DOMRectReadOnly, 'top' | 'bottom' | 'left' | 'right' | 'width' | 'height'>,
  root: Pick<DOMRectReadOnly, 'top' | 'bottom' | 'left' | 'right' | 'width' | 'height'>,
  epsilonPx = 1,
): boolean {
  if (!(card.width > 0) || !(card.height > 0)) {
    return false;
  }
  if (!(card.height <= root.height + epsilonPx)) {
    return false;
  }
  return (
    card.top >= root.top - epsilonPx &&
    card.bottom <= root.bottom + epsilonPx &&
    card.left >= root.left - epsilonPx &&
    card.right <= root.right + epsilonPx
  );
}
