import { expect, test } from '@playwright/test';

test('rules page shows living-room laws and CTAs', async ({ page }) => {
  await page.goto('/rules');
  await expect(page.getByRole('heading', { name: 'Living room rules', level: 1 })).toBeVisible();
  await expect(page.getByText('Only free donations')).toBeVisible();
  await expect(page.getByRole('heading', { name: '1. Only free donations' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '2. Donors come first' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '3. Contact stays in the app' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Contact 21.gifts' })).toHaveAttribute(
    'href',
    '/contact',
  );
  await expect(page.getByRole('link', { name: 'Back to the forum' })).toHaveAttribute(
    'href',
    '/welcome',
  );
});

test('welcome forum shows the two laws and links to rules and contact', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('21gifts.session', 'sess-e2e');
  });
  await page.route(/\/me$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'acc_e2e',
        linkingKey: null,
        role: 'basis',
        name: 'Ada',
        lightningAddress: 'alice@walletofsatoshi.com',
        lightningAddressVerified: false,
        forumLawsDismissed: false,
        createdAt: 1,
        rulesAgreedAt: 1_700_000_001,
      }),
    });
  });
  await page.route(/\/messages$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ messages: [] }),
    });
  });
  await page.goto('/welcome');
  await expect(
    page.getByText('This is a donation platform. Only free gifts — never pay for a promise.'),
  ).toBeVisible();
  await expect(
    page.getByText('Donors are scarce. No begging, no drama, no pressure.'),
  ).toBeVisible();
  await expect(page.getByRole('link', { name: 'Living room rules' })).toHaveAttribute(
    'href',
    '/rules',
  );
  await expect(page.getByRole('link', { name: 'Contact' })).toHaveAttribute('href', '/contact');
  await expect(page.getByRole('button', { name: 'Dismiss' })).toBeVisible();
});

test('welcome forum dismiss hides the living-room laws hint', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('21gifts.session', 'sess-e2e');
  });
  await page.route(/\/me$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'acc_e2e',
        linkingKey: null,
        role: 'basis',
        name: 'Ada',
        lightningAddress: 'alice@walletofsatoshi.com',
        lightningAddressVerified: false,
        forumLawsDismissed: false,
        createdAt: 1,
      }),
    });
  });
  await page.route(/\/me\/forum-laws-dismissed$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'acc_e2e',
        linkingKey: null,
        role: 'basis',
        name: 'Ada',
        lightningAddress: 'alice@walletofsatoshi.com',
        lightningAddressVerified: false,
        forumLawsDismissed: true,
        createdAt: 1,
      }),
    });
  });
  await page.route(/\/messages$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ messages: [] }),
    });
  });
  await page.goto('/welcome');
  await page.getByRole('button', { name: 'Dismiss' }).click();
  await expect(
    page.getByText('This is a donation platform. Only free gifts — never pay for a promise.'),
  ).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Dismiss' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Living room rules' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Contact' })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Forum' })).toBeVisible();
});

test('welcome forum hides laws when already dismissed on the account', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('21gifts.session', 'sess-e2e');
  });
  await page.route(/\/me$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'acc_e2e',
        linkingKey: null,
        role: 'basis',
        name: 'Ada',
        lightningAddress: 'alice@walletofsatoshi.com',
        lightningAddressVerified: false,
        forumLawsDismissed: true,
        createdAt: 1,
      }),
    });
  });
  await page.route(/\/messages$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ messages: [] }),
    });
  });
  await page.goto('/welcome');
  await expect(
    page.getByText('This is a donation platform. Only free gifts — never pay for a promise.'),
  ).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Dismiss' })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Forum' })).toBeVisible();
});
