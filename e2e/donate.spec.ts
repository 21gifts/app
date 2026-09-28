import { expect, test } from '@playwright/test';

test('donate page explains how to give via the forum', async ({ page }) => {
  await page.goto('/donate');
  await expect(page.getByRole('heading', { name: 'Give Bitcoin to someone' })).toBeVisible();
  await expect(page.getByText(/Read the reactions beneath it/)).toBeVisible();
  await expect(page.getByRole('link', { name: 'Open the forum' })).toHaveAttribute(
    'href',
    '/welcome',
  );
});

test('landing Give Bitcoin goes to the localized donate URL', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('link', { name: 'Give Bitcoin' })).toHaveAttribute(
    'href',
    '/en/donate',
  );
});
