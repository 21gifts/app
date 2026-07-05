import { expect, test } from '@playwright/test';

test('login page renders the wallet sign-in action', async ({ page }) => {
  await page.goto('/login');
  await expect(
    page.getByRole('button', { name: 'Log in with your Lightning wallet' }),
  ).toBeVisible();
});
