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
