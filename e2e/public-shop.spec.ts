import { expect, test } from '@playwright/test';
import { ogDescriptionText } from '../src/lib/public-message-og';
import { resolveShopPhotoUrl } from '../src/lib/shop-photo-url';

const LISTED_NPUB = `npub1${'2'.repeat(58)}`;
const GONE_NPUB = `npub1${'3'.repeat(58)}`;
const UNAVAILABLE_NPUB = `npub1${'4'.repeat(58)}`;
const NO_PAYMENT_NPUB = `npub1${'5'.repeat(58)}`;
const UNKNOWN_NPUB = `npub1${'6'.repeat(58)}`;
const GALLERY_NPUB = `npub1${'7'.repeat(58)}`;
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
  await expect(
    page
      .getByRole('heading', { name: 'Verified Nostr address' })
      .locator('xpath=..')
      .getByText('luna@21.gifts'),
  ).toBeVisible();
  await expect(page.getByText(LISTED_NPUB)).toBeVisible();
  await expect(page.getByRole('link', { name: 'View forum note' })).toHaveAttribute(
    'href',
    '/messages/11111111-1111-4111-8111-111111111111',
  );
  await expect(page.getByRole('img', { name: 'Open CryptoPay QR code' })).toBeVisible();
  await expect(page.getByTestId('shop-map')).toHaveCount(0);
});

test('ShopScreen gallery: two photos show dots and the second dot selects photo 2', async ({
  page,
}) => {
  await page.goto(`/${GALLERY_NPUB}`);
  await expect(page.getByRole('heading', { name: 'Twin Gallery' })).toBeVisible();
  const stills = page.getByRole('img', { name: 'Photo from Twin Gallery' });
  await expect(stills).toHaveCount(2);
  await expect(stills.nth(0)).toHaveAttribute('src', /\/e2e\/shop-photos\/one\.jpg$/);
  await expect(stills.nth(1)).toHaveAttribute('src', /\/e2e\/shop-photos\/two\.jpg$/);
  const first = page.getByRole('button', { name: 'Photo 1 of 2' });
  const second = page.getByRole('button', { name: 'Photo 2 of 2' });
  await expect(first).toHaveAttribute('aria-current', 'true');
  await expect(second).not.toHaveAttribute('aria-current', 'true');
  await expect(page.getByText('1/2')).toBeVisible();
  await second.click();
  await expect(second).toHaveAttribute('aria-current', 'true');
  await expect(first).not.toHaveAttribute('aria-current', 'true');
  await expect(page.getByText('2/2')).toBeVisible();
  await expect
    .poll(() =>
      page
        .locator('[data-scroll-x]')
        .first()
        .evaluate((node) => Math.abs(node.scrollWidth - node.clientWidth - node.scrollLeft) < 1),
    )
    .toBe(true);
});

test('ShopScreen shows the payment address under the heading with the logo QR', async ({
  page,
}) => {
  await page.goto(`/${LISTED_NPUB}`);
  const payment = page.getByRole('heading', { name: '21.gifts address' }).locator('xpath=..');
  await expect(payment.getByText('luna@21.gifts')).toBeVisible();
  await expect(payment.getByRole('img', { name: 'Open CryptoPay QR code' })).toBeVisible();
  await expect(payment.locator('svg image')).toHaveCount(1);
});

test('Function: ogDescriptionText — shop HTML carries the public-note description rules', async ({
  request,
}) => {
  const html = await (await request.get(`/${LISTED_NPUB}`)).text();
  expect(html).toContain('<meta property="og:description" content="Coffee, gifts, and moonlight."');
  expect(html).toContain(
    '<meta name="twitter:description" content="Coffee, gifts, and moonlight."',
  );
  expect(ogDescriptionText(' ', 'Cafe Luna')).toBe('Cafe Luna on 21.gifts');
  expect(ogDescriptionText('x'.repeat(301), 'Cafe Luna')).toBe(`${'x'.repeat(299)}…`);
});

test('Function: generateMetadata — shop HTML carries the shop title, canonical URL and photo', async ({
  page,
}) => {
  await page.goto(`/${LISTED_NPUB}`);
  await expect(page).toHaveTitle('Cafe Luna');
  await expect(page.locator('meta[property="og:title"]')).toHaveAttribute('content', 'Cafe Luna');
  await expect(page.locator('meta[name="twitter:title"]')).toHaveAttribute('content', 'Cafe Luna');
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    'href',
    `https://21.gifts/${LISTED_NPUB}`,
  );
  await expect(page.locator('meta[property="og:url"]')).toHaveAttribute(
    'content',
    `https://21.gifts/${LISTED_NPUB}`,
  );
  // The first shop photo is the share image.
  const photo = /\/messages\/11111111-1111-4111-8111-111111111111\/photo\.jpg$/;
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', photo);
  await expect(page.locator('meta[name="twitter:image"]')).toHaveAttribute('content', photo);
  // A shop the page cannot show keeps the root metadata.
  await page.goto(`/${GONE_NPUB}`);
  await expect(page).toHaveTitle('Help people with Bitcoin | 21.gifts');
  await expect(page.locator('link[rel="canonical"]')).toHaveCount(0);
});

test('Function: fetchMapsKey — a blank key keeps the shop map hidden', async ({ page }) => {
  let asked = 0;
  await page.route('**/maps/key', async (route) => {
    asked += 1;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ key: '   ' }),
    });
  });
  await page.goto(`/${LISTED_NPUB}`);
  await expect(page.getByRole('heading', { name: 'Cafe Luna' })).toBeVisible();
  await expect.poll(() => asked).toBeGreaterThan(0);
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

test('Function: loadGoogleMaps — the shop map adds one weekly Maps script', async ({ page }) => {
  let scripts = 0;
  await page.route('**/maps/key', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ key: 'e2e' }),
    });
  });
  await page.route('https://maps.googleapis.com/maps/api/js*', async (route) => {
    scripts += 1;
    await route.fulfill({
      status: 200,
      contentType: 'text/javascript',
      body: [
        'window.shopMarkerCount = 0;',
        'window.google = { maps: {',
        '  Map: class { setCenter() {} },',
        '  Marker: class { constructor() { window.shopMarkerCount += 1; } },',
        '} };',
      ].join('\n'),
    });
  });
  await page.goto(`/${LISTED_NPUB}`);
  await expect(page.getByTestId('shop-map')).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(() => (window as Window & { shopMarkerCount?: number }).shopMarkerCount),
    )
    .toBe(1);
  const script = page.locator('script[data-gmaps="weekly"]');
  await expect(script).toHaveCount(1);
  await expect(script).toHaveAttribute(
    'src',
    'https://maps.googleapis.com/maps/api/js?key=e2e&v=weekly',
  );
  expect(scripts).toBe(1);
});

test('Function: resolveShopPhotoUrl — a relative shop photo becomes an api URL and a non-http one is dropped', async ({
  page,
}) => {
  expect(resolveShopPhotoUrl('/e2e/shop-photos/one.jpg', 'http://127.0.0.1:3001')).toBe(
    'http://127.0.0.1:3001/e2e/shop-photos/one.jpg',
  );
  expect(resolveShopPhotoUrl('javascript:alert(1)', 'http://127.0.0.1:3001')).toBeNull();
  await page.goto(`/${GALLERY_NPUB}`);
  const stills = page.getByRole('img', { name: 'Photo from Twin Gallery' });
  await expect(stills).toHaveCount(2);
  await expect(stills.nth(0)).toHaveAttribute(
    'src',
    'http://127.0.0.1:3001/e2e/shop-photos/one.jpg',
  );
  await expect(stills.nth(1)).toHaveAttribute(
    'src',
    'http://127.0.0.1:3001/e2e/shop-photos/two.jpg',
  );
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
    'content',
    'http://127.0.0.1:3001/e2e/shop-photos/one.jpg',
  );
});

test('Function: onGoogleMapsAuthFailure — a rejected key removes the shop map frame', async ({
  page,
}) => {
  await page.route('**/maps/key', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ key: 'rejected' }),
    });
  });
  await page.route('https://maps.googleapis.com/maps/api/js*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'text/javascript',
      body: [
        'window.google = { maps: {',
        '  Map: class { constructor(el) { el.textContent = "dialog"; } setCenter() {} },',
        '  Marker: class {},',
        '} };',
      ].join('\n'),
    });
  });
  await page.goto(`/${LISTED_NPUB}`);
  const frame = page.getByTestId('shop-map');
  await expect(frame).toBeVisible();
  await expect(frame).toHaveText('dialog');
  // Google reports the rejected key through the one hook the loader owns.
  await page.evaluate(() => {
    (window as Window & { gm_authFailure?: () => void }).gm_authFailure?.();
  });
  await expect(frame).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Cafe Luna' })).toBeVisible();
  await expect(page.getByText('Moon Street 21')).toBeVisible();
});

test('Function: GoogleMapCanvas — a failed map script removes the shop map frame', async ({
  page,
}) => {
  let scripts = 0;
  await page.route('**/maps/key', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ key: 'e2e' }),
    });
  });
  await page.route('https://maps.googleapis.com/maps/api/js*', async (route) => {
    scripts += 1;
    await route.abort();
  });
  await page.goto(`/${LISTED_NPUB}`);
  await expect(page.getByRole('heading', { name: 'Cafe Luna' })).toBeVisible();
  await expect.poll(() => scripts).toBe(1);
  await expect(page.getByTestId('shop-map')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Address', exact: true })).toBeVisible();
  await expect(page.getByText('Moon Street 21')).toBeVisible();
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

test('unavailable shop shows the shop error and retry control', async ({ page }) => {
  await page.goto(`/${UNAVAILABLE_NPUB}`);
  await expect(
    page.getByRole('alert').filter({ hasText: 'Could not load this shop. Please try again.' }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
});
