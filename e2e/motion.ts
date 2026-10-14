import { expect, type Page } from '@playwright/test';

/**
 * Boxes of `src/components/Motion.tsx` that are still moving: a fold that is opening or closing,
 * a view that is fading out before a swap, and a height that is gliding.
 */
const MOVING =
  '[data-collapse="opening"], [data-collapse="closed"], [data-swap][inert], [data-auto-height][data-gliding]';

/** Quiet time that has to pass with nothing moving, in ms (waited from the test, not the page). */
const QUIET_MS = 100;

/**
 * Waits until every fold, swap and height glide on the page has settled. Their last steps run on
 * timers, which a screenshot's `animations: 'disabled'` does not finish, and a box measured while
 * one of them moves is not where it comes to rest. The page has to stay quiet over a short pause
 * too: a move that starts a moment after the last action (a sheet that opens once its data has
 * arrived) is caught instead of passing unseen. The pause runs in the test, so a paused page clock
 * does not hold it.
 *
 * @param page - Page under test.
 */
export async function motionSettled(page: Page): Promise<void> {
  const quiet = (): Promise<boolean> =>
    page.evaluate((selector) => document.querySelector(selector) === null, MOVING);
  for (;;) {
    await expect.poll(quiet).toBe(true);
    await page.waitForTimeout(QUIET_MS);
    if (await quiet()) {
      return;
    }
  }
}
