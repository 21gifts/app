import { expect, test } from '@playwright/test';

test('handbook page renders the heading', async ({ page }) => {
  await page.goto('/handbook');
  await expect(page.getByRole('heading', { name: 'Handbook' }).first()).toBeVisible();
});
