import { expect, test, type Page } from '@playwright/test';

const E2E_ACCOUNT = {
  id: 'acc_e2e',
  linkingKey: `02${'a'.repeat(62)}`,
  role: 'basis' as const,
  name: 'Ada',
  location: null,
  lightningAddress: 'alice@walletofsatoshi.com',
  lightningAddressVerified: false,
  forumLawsDismissed: false,
  createdAt: 1_700_000_000,
  rulesAgreedAt: 1_700_000_001,
  viewKey: 'a'.repeat(64),
  aboutMe: null,
  setup: null,
  missing: [],
};

async function seedSignedIn(page: Page): Promise<void> {
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
  await page.route(/\/maps\/key$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ key: null }),
    });
  });
}

test('Function: proxyMessagesPlacesGet — GET /forum/messages/places without bearer is 401', async ({
  request,
}) => {
  expect((await request.get('/forum/messages/places')).status()).toBe(401);
  expect((await request.get('/maps/key')).status()).toBe(200);
});

test('Function: MapPage — map loading', async ({ page }) => {
  await seedSignedIn(page);
  let release: () => void = () => undefined;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(/\/forum\/messages\/places$/, async (route) => {
    await held;
    await route.abort();
  });
  await page.goto('/map');
  await expect(page.locator('p.text-center', { hasText: 'Loading…' })).toBeVisible();
  release();
});

test('Function: MapPage — heading is visible', async ({ page }) => {
  await seedSignedIn(page);
  await page.route(/\/forum\/messages\/places$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ places: [] }),
    });
  });
  await page.goto('/map');
  await expect(page.getByRole('heading', { name: 'Map' })).toBeVisible();
});

test('Function: fetchPlaces — the map lists a pin', async ({ page }) => {
  await seedSignedIn(page);
  await page.route(/\/forum\/messages\/places$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        places: [
          {
            id: 'm-pin',
            name: 'Ada',
            createdAt: '2026-08-28T12:00:00.000Z',
            lat: 14.6,
            lng: 120.98,
            label: 'Happyland',
          },
        ],
      }),
    });
  });
  await page.goto('/map');
  await expect(page.getByRole('link', { name: 'Ada · Happyland' })).toBeVisible();
});

test('Function: PlacesMapScreen — lists a pin', async ({ page }) => {
  await seedSignedIn(page);
  await page.route(/\/forum\/messages\/places$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        places: [
          {
            id: 'm-pin',
            name: 'Ada',
            createdAt: '2026-08-28T12:00:00.000Z',
            lat: 14.6,
            lng: 120.98,
            label: 'Happyland',
          },
        ],
      }),
    });
  });
  await page.goto('/map');
  await expect(page.getByRole('link', { name: 'Ada · Happyland' })).toBeVisible();
});

test('Function: PlaceField — add a place is on the shop composer', async ({ page }) => {
  await seedSignedIn(page);
  await page.route(/\/messages(?:\?|$)/, async (route) => {
    if (route.request().method() !== 'GET') {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ messages: [] }),
    });
  });
  await page.goto('/shops');
  await expect(page.getByRole('button', { name: 'Add a place' })).toBeVisible();
});
