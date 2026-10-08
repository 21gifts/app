import { expect, test } from '@playwright/test';

test('rules page shows the living-room rules and CTAs', async ({ page }) => {
  await page.goto('/rules');
  await expect(page.getByRole('heading', { name: 'Living room rules', level: 1 })).toBeVisible();
  await expect(page.getByText('Only free donations')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Only free donations' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Donors come first' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Contact stays in the app' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Contact 21.gifts' })).toHaveAttribute(
    'href',
    '/contact',
  );
  await expect(page.getByRole('link', { name: 'Back to the forum' })).toHaveCount(1);
  await expect(page.getByRole('link', { name: 'Back to the forum' })).toHaveAttribute(
    'href',
    '/welcome',
  );
  await expect(page.getByRole('link', { name: '21.gifts', exact: true })).toHaveAttribute(
    'href',
    '/',
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
        location: null,
        lightningAddress: null,
        lightningAddressVerified: false,
        forumLawsDismissed: false,
        createdAt: 1,
        rulesAgreedAt: 1_700_000_001,
        viewKey: 'a'.repeat(64),
        aboutMe: null,
        setup: null,
        missing: [],
      }),
    });
  });
  await page.route(/\/messages(?:\?|$)/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ messages: [] }),
    });
  });
  await page.goto('/welcome');
  await expect(
    page.getByText(
      '21.gifts is a donation platform: gifts are free, and nobody pays for a promise.',
    ),
  ).toBeVisible();
  await expect(
    page.getByText('Donors are rare — no begging, no drama, no pressure.'),
  ).toBeVisible();
  await expect(page.getByRole('link', { name: 'Living room rules' })).toHaveAttribute(
    'href',
    '/rules',
  );
  await expect(page.getByRole('link', { name: 'Contact' })).toHaveAttribute('href', '/contact');
  await expect(page.getByRole('button', { name: 'Dismiss' })).toBeVisible();
});

test('welcome forum laws card centres its text and keeps the X in the top-right inset', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
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
        location: null,
        lightningAddress: null,
        lightningAddressVerified: false,
        forumLawsDismissed: false,
        createdAt: 1,
        rulesAgreedAt: 1_700_000_001,
        viewKey: 'a'.repeat(64),
        aboutMe: null,
        setup: null,
        missing: [],
      }),
    });
  });
  await page.route(/\/messages(?:\?|$)/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ messages: [] }),
    });
  });
  await page.goto('/welcome');
  const card = page.locator('[data-laws-card]');
  const text = page.getByText(
    '21.gifts is a donation platform: gifts are free, and nobody pays for a promise.',
  );
  const dismiss = card.getByRole('button', { name: 'Dismiss' });
  await expect(text).toBeVisible();
  await expect(dismiss).toBeVisible();
  const cardBox = await card.boundingBox();
  const textBox = await text.boundingBox();
  const xBox = await dismiss.boundingBox();
  if (cardBox === null || textBox === null || xBox === null) {
    throw new Error('laws card is not laid out');
  }
  const cardCentre = cardBox.x + cardBox.width / 2;
  const textCentre = textBox.x + textBox.width / 2;
  expect(Math.abs(textCentre - cardCentre)).toBeLessThanOrEqual(1);
  const top = xBox.y - cardBox.y;
  const right = cardBox.x + cardBox.width - (xBox.x + xBox.width);
  expect(top).toBeGreaterThanOrEqual(12);
  expect(top).toBeLessThanOrEqual(14);
  expect(right).toBeGreaterThanOrEqual(12);
  expect(right).toBeLessThanOrEqual(14);
  // The 24px X has a 44px hit area around its centre; no text may sit under it.
  const hitLeft = xBox.x + xBox.width / 2 - 22;
  expect(hitLeft).toBeGreaterThanOrEqual(textBox.x + textBox.width);
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
        location: null,
        lightningAddress: null,
        lightningAddressVerified: false,
        forumLawsDismissed: false,
        createdAt: 1,
        rulesAgreedAt: 1_700_000_001,
        viewKey: 'a'.repeat(64),
        aboutMe: null,
        setup: null,
        missing: [],
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
        location: null,
        lightningAddress: null,
        lightningAddressVerified: false,
        forumLawsDismissed: true,
        createdAt: 1,
        rulesAgreedAt: 1_700_000_001,
        viewKey: 'a'.repeat(64),
        aboutMe: null,
        setup: null,
        missing: [],
      }),
    });
  });
  await page.route(/\/messages(?:\?|$)/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ messages: [] }),
    });
  });
  await page.goto('/welcome');
  await page.getByRole('button', { name: 'Dismiss' }).click();
  await expect(
    page.getByText(
      '21.gifts is a donation platform: gifts are free, and nobody pays for a promise.',
    ),
  ).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Dismiss' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Living room rules' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Contact' })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Welcome, Ada' })).toBeVisible();
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
        location: null,
        lightningAddress: null,
        lightningAddressVerified: false,
        forumLawsDismissed: true,
        createdAt: 1,
        rulesAgreedAt: 1_700_000_001,
        viewKey: 'a'.repeat(64),
        aboutMe: null,
        setup: null,
        missing: [],
      }),
    });
  });
  await page.route(/\/messages(?:\?|$)/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ messages: [] }),
    });
  });
  await page.goto('/welcome');
  await expect(
    page.getByText(
      '21.gifts is a donation platform: gifts are free, and nobody pays for a promise.',
    ),
  ).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Dismiss' })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Welcome, Ada' })).toBeVisible();
});
