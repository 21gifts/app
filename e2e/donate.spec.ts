import { expect, test } from '@playwright/test';

test('donate page renders the gift form', async ({ page }) => {
  await page.goto('/donate');
  await expect(page.getByRole('heading', { name: 'Send a gift', level: 1 })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Create invoice' })).toBeVisible();
});
