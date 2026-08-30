import { expect, test } from '@playwright/test';

test('donate page explains send-help via the forum', async ({ page }) => {
  await page.goto('/donate');
  await expect(page.getByRole('heading', { name: 'Send help' })).toBeVisible();
  await expect(page.getByText(/Pick a message in the forum/)).toBeVisible();
  await expect(page.getByRole('link', { name: 'Open the forum' })).toHaveAttribute(
    'href',
    '/welcome',
  );
});

test('landing Send help goes to /donate', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('link', { name: 'Send help' })).toHaveAttribute('href', '/donate');
});
