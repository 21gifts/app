import { expect, test } from '@playwright/test';

test('handbook page renders the heading', async ({ page }) => {
  await page.goto('/handbook');
  await expect(page.getByRole('heading', { name: 'Handbook' }).first()).toBeVisible();
});

test('copy link flashes Copied on a handbook heading', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/handbook');
  const button = page.getByRole('button', { name: 'Copy link to Handbook' });
  await expect(button).toBeVisible();
  await button.click();
  await expect(button).toHaveAttribute('data-copied', 'true');
});

test('handbook screens heading is Screens', async ({ page }) => {
  await page.goto('/handbook/screens');
  await expect(page.getByRole('heading', { name: 'Screens' }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Mobile' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Dark' })).toBeVisible();
});

test('handbook functions heading is Functions', async ({ page }) => {
  await page.goto('/handbook/functions');
  await expect(page.getByRole('heading', { name: 'Functions' }).first()).toBeVisible();
});

test('handbook endpoints heading is Endpoints', async ({ page }) => {
  await page.goto('/handbook/endpoints');
  await expect(page.getByRole('heading', { name: 'Endpoints' }).first()).toBeVisible();
});
