/**
 * Length of a reveal, a fold, and a height glide, in ms (`duration-280` on `Collapse`,
 * `AutoHeight` and the shell footer's fold).
 */
export const MOTION_EASE_MS = 280;

/** Length of the fade out and of the fade in of a `Swap`, in ms (`duration-180` there). */
export const MOTION_SWAP_FADE_MS = 180;

/** Extra wait after a CSS move before the fallback timer settles the box, in ms. */
const SETTLE_SLACK_MS = 40;

/**
 * Longest time from the start of an opening, a fold, or a height glide until the box has settled,
 * in ms: it stops clipping, or a folded `Collapse` unmounts. A move settles when its CSS
 * transition ends; this timer is the fallback for a transition that never runs.
 */
export const MOTION_FOLD_MS = MOTION_EASE_MS + SETTLE_SLACK_MS;

/**
 * Event a `Collapse` that has eased open, or an `AutoHeight` that has glided to its new height,
 * sends from its box (it bubbles). It comes before the box reports itself settled, so code that
 * places the page by the final layout (a reveal in the scrollport) runs first.
 */
export const MOTION_SETTLE_EVENT = '21gifts:motion-settle';

/**
 * Sends {@link MOTION_SETTLE_EVENT} from `el`.
 *
 * @param el - Box whose move has ended.
 */
export function announceSettle(el: HTMLElement): void {
  el.dispatchEvent(new Event(MOTION_SETTLE_EVENT, { bubbles: true }));
}

/**
 * Calls `done` once, when `el`'s own transition of `property` ends or after `fallbackMs`, whichever
 * comes first. The end of the transition counts first because the browser runs transitions on its
 * own clock, also while a page's timers are held (a paused test clock, a throttled tab).
 *
 * @param el - Element whose transition settles the move.
 * @param property - CSS property of that transition, as `transitionend` names it.
 * @param fallbackMs - Wait before settling without a transition end.
 * @param done - Settles the move.
 * @returns Cancels the wait without calling `done`.
 */
export function afterTransition(
  el: HTMLElement,
  property: string,
  fallbackMs: number,
  done: () => void,
): () => void {
  const onEnd = (event: TransitionEvent): void => {
    // Transitions of the content bubble up here too; only this box's own move counts.
    if (event.target === el && event.propertyName === property) {
      stop();
      done();
    }
  };
  const timer = window.setTimeout(() => {
    stop();
    done();
  }, fallbackMs);
  el.addEventListener('transitionend', onEnd);
  function stop(): void {
    window.clearTimeout(timer);
    el.removeEventListener('transitionend', onEnd);
  }
  return stop;
}

/**
 * Whether the visitor asked for reduced motion. The global CSS rule already makes every
 * transition instant; the motion timers read this so they do not wait for a move that never runs.
 *
 * @returns True when `prefers-reduced-motion: reduce` matches.
 */
export function prefersReducedMotion(): boolean {
  return (
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}
