import { expect, test } from '@playwright/test';

const LISTED_NPUB = `npub1${'2'.repeat(58)}`;
const GONE_NPUB = `npub1${'3'.repeat(58)}`;
const UNAVAILABLE_NPUB = `npub1${'4'.repeat(58)}`;
const NO_PAYMENT_NPUB = `npub1${'5'.repeat(58)}`;
const UNKNOWN_NPUB = `npub1${'6'.repeat(58)}`;
const KNOWN_HEX = 'a'.repeat(64);

test('e2e:check dynamic path token for /[npub]', async ({ page }) => {
  await page.goto('/[npub]');
});

test('Function: ShopPage renders the public shop identity', async ({ page }) => {
  await page.goto(`/${LISTED_NPUB}`);
  await expect(page.getByRole('heading', { name: 'Cafe Luna' })).toBeVisible();
  await expect(page.getByText('Coffee, gifts, and moonlight.')).toBeVisible();
  await expect(page.getByText('Moon Street 21')).toBeVisible();
  await expect(page.getByText('8001 Zurich')).toBeVisible();
  await expect(page.getByText('luna@21.gifts')).toBeVisible();
  await expect(page.getByText(LISTED_NPUB)).toBeVisible();
  await expect(page.getByRole('link', { name: 'View forum note' })).toHaveAttribute(
    'href',
    '/messages/11111111-1111-4111-8111-111111111111',
  );
  await expect(page.getByRole('img', { name: 'Open CryptoPay QR code' })).toBeVisible();
  await expect(page.getByTestId('shop-map')).toHaveCount(0);
});

test('Function: ShopScreen omits payment and NIP-05 when the api returns null', async ({
  page,
}) => {
  await page.goto(`/${NO_PAYMENT_NPUB}`);
  await expect(page.getByRole('heading', { name: 'Quiet Shop' })).toBeVisible();
  await expect(page.getByRole('img', { name: 'Open CryptoPay QR code' })).toHaveCount(0);
  await expect(page.getByText('Verified Nostr address')).toHaveCount(0);
});

test('Function: NpubCopyButton copies the shop npub', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto(`/${LISTED_NPUB}`);
  await page.getByRole('button', { name: 'Copy' }).click();
  await expect(page.getByRole('button', { name: 'Copied' })).toBeVisible();
});

test('Function: GoogleMapCanvas draws only the public shop marker when a key exists', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const host = window as Window & { google?: unknown; shopMarkerCount?: number };
    host.shopMarkerCount = 0;
    class MapShim {
      setCenter(): void {}
    }
    class MarkerShim {
      constructor() {
        host.shopMarkerCount = (host.shopMarkerCount ?? 0) + 1;
      }
    }
    host.google = {
      maps: { Map: MapShim, Marker: MarkerShim },
    };
  });
  await page.route('**/maps/key', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ key: 'e2e' }),
    });
  });
  await page.goto(`/${LISTED_NPUB}`);
  await expect(page.getByTestId('shop-map')).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(() => (window as Window & { shopMarkerCount?: number }).shopMarkerCount),
    )
    .toBe(1);
});

test('hex shop identity redirects permanently to the canonical npub', async ({ request }) => {
  const response = await request.get(`/${KNOWN_HEX}`, { maxRedirects: 0 });
  expect(response.status()).toBe(308);
  expect(response.headers()['location']).toBe(`/${LISTED_NPUB}`);
});

test('unknown shop and invalid root segment use the existing not-found page', async ({ page }) => {
  for (const path of [`/${UNKNOWN_NPUB}`, '/not-an-npub']) {
    const response = await page.goto(path);
    expect(response?.status()).toBe(404);
    await expect(page.getByRole('heading', { name: '404' })).toBeVisible();
    await expect(page.getByText('This page does not exist.')).toBeVisible();
  }
});

test('unlisted shop says it existed without revealing a name', async ({ page }) => {
  await page.goto(`/${GONE_NPUB}`);
  await expect(page.getByRole('heading', { name: 'This shop is no longer listed.' })).toBeVisible();
  await expect(page.getByText('Cafe Luna')).toHaveCount(0);
});

test('unavailable shop shows the shared error and retry control', async ({ page }) => {
  await page.goto(`/${UNAVAILABLE_NPUB}`);
  await expect(
    page.getByRole('alert').filter({ hasText: 'Could not load messages. Please try again.' }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
});
