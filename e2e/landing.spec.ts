import { expect, test } from '@playwright/test';

test('landing shows the 21.gifts wordmark', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('link', { name: '21.gifts' }).first()).toBeVisible();
  await expect(page.getByRole('heading', { name: /Direct human-to-human gifts/i })).toBeVisible();
});

test('legal page is reachable', async ({ page }) => {
  await page.goto('/legal');
  await expect(page.getByRole('heading', { name: 'Legal Notice' })).toBeVisible();
});
