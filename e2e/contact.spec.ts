import { expect, test } from '@playwright/test';

const E2E_ACCOUNT = {
  id: 'acc_e2e',
  linkingKey: `02${'a'.repeat(62)}`,
  role: 'basis' as const,
  name: 'Ada',
  lightningAddress: 'alice@walletofsatoshi.com',
  lightningAddressVerified: false,
  forumLawsDismissed: false,
  createdAt: 1_700_000_000,
  rulesAgreedAt: 1_700_000_001,
  viewKey: 'a'.repeat(64),
};

async function seedSignedIn(page: import('@playwright/test').Page): Promise<void> {
  await page.addInitScript(() => {
    localStorage.setItem('21gifts.session', 'sess-e2e');
  });
  await page.route(/\/me$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(E2E_ACCOUNT),
    });
  });
}

test('contact page shows the lead and composer', async ({ page }) => {
  await seedSignedIn(page);
  await page.goto('/contact');
  await expect(page.getByRole('heading', { name: 'Contact' })).toBeVisible();
  await expect(
    page.getByText(
      'Write to 21.gifts here — there is no email address. This is the only way to reach us.',
    ),
  ).toBeVisible();
  await expect(page.getByRole('link', { name: 'Living room rules' })).toHaveAttribute(
    'href',
    '/rules',
  );
  await expect(page.getByLabel('Your message')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Send' })).toBeVisible();
});

test('contact empty send shows Enter a message', async ({ page }) => {
  await seedSignedIn(page);
  await page.goto('/contact');
  await page.getByRole('button', { name: 'Send' }).click();
  await expect(page.getByText('Enter a message')).toBeVisible();
});

test('contact success shows Received — thank you. We read every message here in the app.', async ({
  page,
}) => {
  await seedSignedIn(page);
  await page.route(/\/contact\/submit$/, async (route) => {
    if (route.request().method() !== 'POST') {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'c1',
        name: 'Ada',
        text: 'Hello team',
        createdAt: '2026-08-28T12:00:00.000Z',
      }),
    });
  });
  await page.goto('/contact');
  await page.getByLabel('Your message').fill('Hello team');
  await page.getByRole('button', { name: 'Send' }).click();
  await expect(
    page.getByText('Received — thank you. We read every message here in the app.'),
  ).toBeVisible();
  await expect(page.getByLabel('Your message')).toHaveCount(0);
});
