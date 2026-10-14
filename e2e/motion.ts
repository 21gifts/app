import { expect, type Page } from '@playwright/test';

/**
 * Boxes of `src/components/Motion.tsx` that are still moving: a fold that is opening or closing,
 * a view that is fading out before a swap, and a height that is gliding.
 */
const MOVING =
  '[data-collapse="opening"], [data-collapse="closed"], [data-swap][inert], [data-auto-height][data-gliding]';

/**
 * Waits until every fold, swap and height glide on the page has settled. Their last steps run on
 * timers, which a screenshot's `animations: 'disabled'` does not finish, and a box measured while
 * one of them moves is not where it comes to rest.
 *
 * @param page - Page under test.
 */
export async function motionSettled(page: Page): Promise<void> {
  await expect
    .poll(() => page.evaluate((selector) => document.querySelector(selector) === null, MOVING))
    .toBe(true);
}
