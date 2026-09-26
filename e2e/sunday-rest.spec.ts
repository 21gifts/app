import { expect, test } from '@playwright/test';

const ACCOUNT = {
  id: 'acc_e2e',
  linkingKey: null,
  role: 'basis',
  name: 'Ada',
  location: null,
  lightningAddress: 'alice@walletofsatoshi.com',
  lightningAddressVerified: false,
  forumLawsDismissed: true,
  createdAt: 1,
  rulesAgreedAt: 1_700_000_001,
  viewKey: 'a'.repeat(64),
  aboutMe: null,
  setup: null,
  missing: [],
};

async function mockForum(page: import('@playwright/test').Page): Promise<void> {
  await page.route(/\/me$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(ACCOUNT),
    });
  });
  await page.route(/\/messages(?:\?|$)/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ messages: [] }),
    });
  });
}

test('Function: isLocalSunday — the head script marks the device Sunday', async ({ page }) => {
  await page.addInitScript(() => {
    sessionStorage.setItem('e2e-now', '2026-09-27T12:00:00.000Z');
  });
  await page.goto('/rules');
  await expect(page.locator('html')).toHaveAttribute('data-local-sunday', '1');
});

test('Function: useLocalSunday — Sunday replaces the forum composer', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('21gifts.session', 'sess-e2e');
    sessionStorage.setItem('e2e-now', '2026-09-27T12:00:00.000Z');
  });
  await mockForum(page);
  await page.goto('/welcome');
  await expect(page.getByText('Writing is paused on Sunday.').first()).toBeVisible();
});

test('Function: SundayWritingGate — the message field is not shown on Sunday', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('21gifts.session', 'sess-e2e');
    sessionStorage.setItem('e2e-now', '2026-09-27T12:00:00.000Z');
  });
  await mockForum(page);
  await page.goto('/welcome');
  await expect(page.getByRole('textbox', { name: 'Your message' })).toHaveCount(0);
});

test('Function: deviceTimeZoneHeader — a weekday still shows the composer', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('21gifts.session', 'sess-e2e');
    sessionStorage.setItem('e2e-now', '2026-01-07T12:00:00.000Z');
  });
  await mockForum(page);
  await page.goto('/welcome');
  await expect(page.getByRole('textbox', { name: 'Your message' })).toBeVisible();
  await expect(page.getByText('Writing is paused on Sunday.')).toHaveCount(0);
});
