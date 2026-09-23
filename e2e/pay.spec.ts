import { expect, test } from '@playwright/test';

test('pay link without a lightning query stays on the page', async ({ page }) => {
  await page.goto('/pl');
  await expect(page.getByText('This payment link is not valid.')).toBeVisible();
});
