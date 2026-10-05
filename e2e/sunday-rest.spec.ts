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
  await expect(
    page.getByText('Writing is paused until Monday at 08:00, your local time.').first(),
  ).toBeVisible();
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
  await expect(
    page.getByText('Writing is paused until Monday at 08:00, your local time.'),
  ).toHaveCount(0);
});

for (const zone of ['Asia/Manila', 'Europe/Zurich', 'Pacific/Honolulu']) {
  test.describe(`Monday in ${zone}`, () => {
    test.use({ timezoneId: zone });
    test('keeps the composer closed at 07:59 and reopens it at 08:00 in an open tab', async ({
      page,
    }) => {
      const instants: Record<string, string> = {
        'Asia/Manila': '2026-10-04T23:59:59.000Z',
        'Europe/Zurich': '2026-10-05T05:59:59.000Z',
        'Pacific/Honolulu': '2026-10-05T17:59:59.000Z',
      };
      await page.clock.install({ time: new Date(instants[zone]!) });
      await page.addInitScript((instant) => {
        localStorage.setItem('21gifts.session', 'sess-e2e');
        sessionStorage.setItem('e2e-now', instant);
      }, instants[zone]!);
      await mockForum(page);
      await page.goto('/welcome');
      await expect(page.locator('html')).toHaveAttribute('data-local-sunday', '1');
      await expect(page.getByRole('textbox', { name: 'Your message' })).toHaveCount(0);
      await page.evaluate(
        (instant) => sessionStorage.setItem('e2e-now', instant),
        new Date(Date.parse(instants[zone]!) + 1_000).toISOString(),
      );
      await page.clock.runFor(1_000);
      await expect(page.locator('html')).toHaveAttribute('data-local-sunday', '0');
      await expect(page.getByRole('textbox', { name: 'Your message' })).toBeVisible();
    });
  });
}
