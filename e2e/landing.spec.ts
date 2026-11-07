import { expect, test, type Page, type Route } from '@playwright/test';
import { getCatalog } from '../src/lib/messages';

/**
 * Marks this document so a document load can be detected.
 *
 * @param page - Page whose current document is marked.
 */
async function markDocument(page: Page): Promise<void> {
  await page.evaluate(() => {
    (window as unknown as { e2eDocument?: string }).e2eDocument = 'same';
  });
}

/**
 * Reads the document mark after navigation.
 *
 * @param page - Page whose current document is inspected.
 * @returns The mark, or null after a document load.
 */
async function sameDocument(page: Page): Promise<string | null> {
  return page.evaluate(() => (window as unknown as { e2eDocument?: string }).e2eDocument ?? null);
}

test('landing shows the 21.gifts wordmark', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('link', { name: '21.gifts' }).first()).toBeVisible();
  await expect(page.getByRole('heading', { name: /Help people.*with Bitcoin/i })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Send help' })).toHaveAttribute('href', '/en/donate');
  await expect(page.locator('main').getByText('How it works', { exact: true })).toBeVisible();
  const bitcoinMarks = page.locator('main img[src="/bitcoin-symbol.svg"]');
  await expect(bitcoinMarks).toHaveCount(5);
  for (let index = 0; index < 5; index += 1) {
    const bitcoinMark = bitcoinMarks.nth(index);
    await expect(bitcoinMark).toHaveAttribute('aria-hidden', 'true');
    await expect(bitcoinMark).toBeVisible();
  }
  await expect
    .poll(() =>
      bitcoinMarks.evaluateAll((images) =>
        images.every(
          (image) => image instanceof HTMLImageElement && image.complete && image.naturalWidth > 0,
        ),
      ),
    )
    .toBe(true);
  await expect(page.getByRole('spinbutton')).toHaveCount(0);
});

test('opening a second FAQ question closes the first', async ({ page }) => {
  await page.goto('/');
  const questions = page.locator('#faq details');
  await questions.nth(0).locator('summary').click();
  await questions.nth(1).locator('summary').click();
  await expect(questions.nth(0)).toHaveJSProperty('open', false);
});

test('Function: MarketingHeader — the root info page shows no back arrow, the other marketing pages keep it', async ({
  page,
}) => {
  await page.goto('/about');
  const header = page.locator('header');
  await expect(header.getByRole('link', { name: 'Back to the forum' })).toHaveCount(1);
  await header.getByRole('link', { name: '21.gifts', exact: true }).click();
  await expect(page).toHaveURL(/\/en$/);
  await expect(page.getByRole('heading', { name: /Help people.*with Bitcoin/i })).toBeVisible();
  await expect(header.getByRole('link', { name: 'Back', exact: true })).toHaveCount(0);
  await expect(header.getByRole('link', { name: 'Back to the forum' })).toHaveCount(0);
  await expect(header.getByRole('button', { name: 'Back' })).toHaveCount(0);
  await page.goto('/');
  await expect(header.getByRole('link', { name: '21.gifts', exact: true })).toBeVisible();
  await expect(header.getByRole('link', { name: /^Back/ })).toHaveCount(0);
});

test('landing shows the project donate address', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: '21.gifts also needs support' })).toBeVisible();
  await expect(page.getByRole('link', { name: '21gifts@21.gifts' })).toHaveAttribute(
    'href',
    'lightning:21gifts@21.gifts',
  );
});

test('Function: projectDonateAddress — the landing donate link is the platform account on this host', async ({
  page,
}) => {
  await page.goto('/');
  const project = page.locator('#project');
  await expect(project.getByRole('link', { name: '21gifts@21.gifts' })).toHaveAttribute(
    'href',
    'lightning:21gifts@21.gifts',
  );
});

test('Function: getPlatformUsername — the build platform username names the donate address', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.locator('#project').getByRole('link', { name: /^21gifts@/ })).toBeVisible();
});

test('Happyland follows the giving journey and hides unverified claims', async ({ page }) => {
  await page.goto('/');
  const sections = page.locator('main > section');
  await expect(sections.nth(1)).toHaveAttribute('id', 'shops');
  await expect(sections.nth(2)).toHaveAttribute('id', 'how');
  await expect(sections.nth(4)).toHaveAttribute('id', 'why');
  await expect(sections.nth(5)).toHaveAttribute('id', 'happyland');
  await expect(page.locator('#shops')).toBeVisible();
  await expect(page.locator('#how')).toBeVisible();
  await expect(page.locator('#happyland')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Happyland in Tondo' })).toBeVisible();
  await expect(page.getByRole('link', { name: /Happyland · Tondo/ })).toHaveAttribute(
    'href',
    '#happyland',
  );
  await expect(page.getByRole('heading', { name: '21.gifts on the ground' })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'What your gift makes possible' })).toHaveCount(0);
});

function isPublicMapApi(url: URL): boolean {
  const api =
    url.hostname === 'api.opencryptopay.io' || url.hostname === 'dev-api.opencryptopay.io';
  return api && (url.pathname === '/map/filters' || url.pathname === '/map/places');
}

function shopFilters(): Record<string, unknown> {
  return {
    activities: ['daily', 'within7Days', 'within30Days', 'olderThan30Days', 'none'],
    countries: ['CH', 'KE', 'PH'],
    shopNames: ['Mini', 'SPAR'],
    techProviders: [
      {
        name: '21.gifts',
        blockchains: ['Bitcoin'],
        assets: ['BTC'],
        pairs: [{ blockchain: 'Bitcoin', asset: 'BTC' }],
      },
      {
        name: 'DFX.swiss',
        blockchains: ['Liquid'],
        assets: ['L-BTC'],
        pairs: [{ blockchain: 'Liquid', asset: 'L-BTC' }],
      },
    ],
  };
}

/** Four 21.gifts shops that differ, plus one hidden DFX desk. */
function shopPlaces(): Record<string, unknown> {
  return {
    places: [
      {
        id: `npub1${'q'.repeat(58)}`,
        name: 'Sample',
        shopName: 'SPAR',
        country: 'PH',
        activity: 'daily',
        category: 'shopping',
        street: 'Nairobi road',
        lat: -1.29,
        lon: 36.82,
        techProvider: '21.gifts',
        coverPhoto: { url: 'https://api.opencryptopay.io/map/photos/sample.jpg' },
        supports: [{ blockchain: 'Bitcoin', asset: 'BTC' }],
      },
      {
        name: 'North',
        shopName: null,
        country: 'PH',
        activity: 'within7Days',
        category: 'cafe',
        street: 'Manila north',
        lat: 14.6203,
        lon: 120.958,
        techProvider: '21.gifts',
        supports: [{ blockchain: 'Tron', asset: 'USDT' }],
      },
      {
        name: 'Mid',
        shopName: null,
        country: 'PH',
        activity: 'within30Days',
        category: 'grocery',
        street: 'Manila mid',
        lat: 14.62035,
        lon: 120.95805,
        techProvider: '21.gifts',
        supports: [{ blockchain: 'Bitcoin', asset: 'BTC' }],
      },
      {
        name: 'South',
        shopName: null,
        country: 'KE',
        activity: 'none',
        category: 'cafe',
        street: 'Manila south',
        lat: 14.6204,
        lon: 120.9581,
        techProvider: '21.gifts',
        supports: [{ blockchain: 'Lightning', asset: 'BTC' }],
      },
      {
        name: 'Other desk',
        techProvider: 'DFX.swiss',
        id: 'dfx-hidden',
        country: 'PH',
        activity: 'daily',
        lat: 14.7,
        lon: 121.1,
      },
    ],
  };
}

/** Two 21.gifts shops that do not differ on any filter field. */
function identicalShopPlaces(): Record<string, unknown> {
  return {
    places: [
      {
        id: `npub1${'a'.repeat(58)}`,
        name: 'Ann',
        shopName: null,
        country: 'PH',
        activity: 'daily',
        category: 'shopping',
        street: 'Nairobi road',
        lat: -1.29,
        lon: 36.82,
        techProvider: '21.gifts',
        coverPhoto: { url: 'https://api.opencryptopay.io/map/photos/ann.jpg' },
        supports: [{ blockchain: 'Bitcoin', asset: 'BTC' }],
      },
      {
        name: 'Bea',
        shopName: null,
        country: 'PH',
        activity: 'daily',
        category: 'shopping',
        street: 'Manila north',
        lat: 14.6203,
        lon: 120.958,
        techProvider: '21.gifts',
        supports: [{ blockchain: 'Bitcoin', asset: 'BTC' }],
      },
    ],
  };
}

async function fulfillShopKind(route: Route, kind: 'varied' | 'identical'): Promise<void> {
  const path = new URL(route.request().url()).pathname;
  const body =
    path === '/map/filters'
      ? shopFilters()
      : kind === 'identical'
        ? identicalShopPlaces()
        : shopPlaces();
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
}

/**
 * Serves the public map and a decodable cover photo.
 *
 * @param page - Page whose requests are stubbed.
 */
async function stubPublicMap(page: Page): Promise<void> {
  await page.route(
    (url) => isPublicMapApi(url),
    (route) => fulfillShopKind(route, 'varied'),
  );
  await page.route(
    (url) =>
      url.origin === 'https://api.opencryptopay.io' && url.pathname.startsWith('/map/photos/'),
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'image/png',
        body: Buffer.from(
          'iVBORw0KGgoAAAANSUhEUgAAAAgAAAAFCAYAAAB4ka1VAAAAH0lEQVR4AWP8+unNfwY8gImBAGBiIACYGAgAJgYCAABwvQPcvej1igAAAABJRU5ErkJggg==',
          'base64',
        ),
      });
    },
  );
}

async function stubIdenticalMap(page: Page): Promise<void> {
  await page.route(
    (url) => isPublicMapApi(url),
    (route) => fulfillShopKind(route, 'identical'),
  );
}

async function expectFirstCells(page: Page, names: readonly string[]): Promise<void> {
  await expect(page.locator('#shops tbody tr td:first-child')).toHaveText([...names]);
}

test('Function: HomeShops lists a published shop and hides other providers', async ({ page }) => {
  await stubPublicMap(page);
  await page.goto('/');
  await expect(page.locator('section#shops')).toBeVisible();
  await expect(
    page.getByRole('heading', {
      name: 'These shops accept Bitcoin through 21.gifts',
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Table' }).click();
  await expect(page.getByRole('columnheader', { name: 'Country' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Tech provider' })).toHaveCount(0);
  await expect(page.getByRole('cell', { name: 'Other desk', exact: true })).toHaveCount(0);
  const sample = page.getByRole('link', { name: 'Sample', exact: true });
  await expect(sample).toHaveAttribute('href', `/npub1${'q'.repeat(58)}`);
  await expect(sample).not.toHaveAttribute('href', /opencryptopay\.io/);
  await page.getByRole('combobox', { name: 'Activity', exact: true }).click();
  await page.getByRole('option', { name: 'Monthly', exact: true }).click();
  await expect(page.getByRole('cell', { name: 'Sample', exact: true })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'South', exact: true })).toHaveCount(0);
});

test('Function: HomeShops stops after a filters HTTP error', async ({ page }) => {
  let placesRequests = 0;
  await page.route(
    (url) => isPublicMapApi(url),
    async (route) => {
      const path = new URL(route.request().url()).pathname;
      if (path === '/map/filters') {
        await route.fulfill({ status: 500, contentType: 'application/json', body: '{}' });
        return;
      }
      placesRequests += 1;
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{"places":[]}' });
    },
  );
  await page.goto('/');
  await expect(page.getByText(getCatalog('en')['map.error'])).toBeVisible();
  expect(placesRequests).toBe(0);
});

test('Function: HomeShops opens the table when the map script fails', async ({ page }) => {
  await stubPublicMap(page);
  await page.route('https://unpkg.com/maplibre-gl@5.6.1/dist/maplibre-gl.js', (route) =>
    route.abort(),
  );
  await page.goto('/');
  await expect(page.getByText(getCatalog('en')['map.error'])).toBeVisible();
  await expect(page.getByRole('button', { name: 'Table' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('columnheader', { name: 'Country' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Tech provider' })).toHaveCount(0);
});

test('Function: HomeShops rejects an array places body without showing empty', async ({ page }) => {
  await page.route(
    (url) => isPublicMapApi(url),
    async (route) => {
      const path = new URL(route.request().url()).pathname;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(path === '/map/filters' ? shopFilters() : []),
      });
    },
  );
  await page.goto('/');
  await expect(page.getByText(getCatalog('en')['map.error'])).toBeVisible();
  await expect(page.getByText(getCatalog('en')['homeShops.empty'])).toHaveCount(0);
});

test('Function: HomeShops hides filters and help when no shops are published', async ({ page }) => {
  const filters = shopFilters();
  delete filters['activities'];
  await page.route(
    (url) => isPublicMapApi(url),
    async (route) => {
      const path = new URL(route.request().url()).pathname;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(path === '/map/filters' ? filters : { places: [] }),
      });
    },
  );
  await page.goto('/');
  await expect(page.getByText(getCatalog('en')['homeShops.empty'])).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'Activity', exact: true })).toHaveCount(0);
  await expect(page.getByRole('combobox', { name: 'Country', exact: true })).toHaveCount(0);
  await expect(page.getByRole('combobox', { name: 'Name', exact: true })).toHaveCount(0);
  await expect(page.getByRole('combobox', { name: 'Blockchain', exact: true })).toHaveCount(0);
  await expect(page.getByRole('combobox', { name: 'Asset', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'What the activity words mean' })).toHaveCount(0);
  await expect(page.locator('.shop-legend')).toHaveCount(0);
});

test('Function: HomeShops shows activity from the shops when filters omit it', async ({ page }) => {
  await page.route(
    (url) => isPublicMapApi(url),
    async (route) => {
      const path = new URL(route.request().url()).pathname;
      const filters = shopFilters();
      delete filters['activities'];
      const body = path === '/map/filters' ? filters : shopPlaces();
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(body),
      });
    },
  );
  await page.goto('/');
  await page.getByRole('combobox', { name: 'Activity', exact: true }).click();
  await expect(page.getByRole('option', { name: 'Daily', exact: true })).toBeVisible();
  await expect(page.getByRole('option', { name: 'Idle', exact: true })).toHaveCount(0);
});

test('Function: FilterMenu opens the blockchain list', async ({ page }) => {
  await stubPublicMap(page);
  await page.goto('/');
  await page.getByRole('combobox', { name: 'Blockchain', exact: true }).click();
  await expect(page.getByRole('option', { name: 'Bitcoin' })).toBeVisible();
});

test('Function: FilterMenu shows the chosen value on a 320px phone', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 780 });
  await stubPublicMap(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'Table', exact: true }).click();
  const country = page.getByRole('combobox', { name: 'Country', exact: true });
  await country.click();
  await page.getByRole('option', { name: 'Philippines', exact: true }).click();
  await expect(country).toHaveAttribute('aria-expanded', 'false');
  await expect(country).toHaveAttribute('data-value', 'PH');
  const value = country.locator('[data-shop-value]');
  await expect(value).toHaveText('Philippines');
  await expect(value).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await expect
    .poll(() => value.evaluate((node) => node.getBoundingClientRect().width))
    .toBeGreaterThanOrEqual(60);
  await expect
    .poll(() => value.evaluate((node) => node.scrollWidth - node.clientWidth))
    .toBeLessThanOrEqual(1);
});

test('Function: MenuScroll shows the blockchain rows', async ({ page }) => {
  await stubPublicMap(page);
  await page.goto('/');
  await page.getByRole('combobox', { name: 'Blockchain', exact: true }).click();
  const list = page.getByRole('listbox', { name: 'Blockchain' });
  await expect(list.getByRole('option', { name: 'All', exact: true })).toBeVisible();
  await expect(list.getByRole('option', { name: 'Bitcoin', exact: true })).toBeVisible();
});

test('Function: FilterOption selects Bitcoin', async ({ page }) => {
  await stubPublicMap(page);
  await page.goto('/');
  const filter = page.getByRole('combobox', { name: 'Blockchain', exact: true });
  await filter.click();
  await page.getByRole('option', { name: 'Bitcoin', exact: true }).click();
  await expect(filter).toContainText('Bitcoin');
  await expect(page.getByRole('listbox', { name: 'Blockchain' })).toHaveCount(0);
});

test('Function: HomeShops shows only filters and options the shops distinguish', async ({
  page,
}) => {
  await stubPublicMap(page);
  await page.goto('/');
  await expect(page.getByRole('combobox', { name: 'Country', exact: true })).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'Name', exact: true })).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'Blockchain', exact: true })).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'Asset', exact: true })).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'Activity', exact: true })).toBeVisible();
  await page.getByRole('combobox', { name: 'Country', exact: true }).click();
  await expect(page.getByRole('listbox', { name: 'Country' }).getByRole('option')).toHaveText([
    'All',
    'Kenya',
    'Philippines',
  ]);
  await page.keyboard.press('Escape');
  await page.getByRole('combobox', { name: 'Name', exact: true }).click();
  await expect(page.getByRole('listbox', { name: 'Name' }).getByRole('option')).toHaveText([
    'All',
    'SPAR',
    'others',
  ]);
  await page.keyboard.press('Escape');
  await page.getByRole('combobox', { name: 'Blockchain', exact: true }).click();
  await expect(page.getByRole('listbox', { name: 'Blockchain' }).getByRole('option')).toHaveText([
    'All',
    'Bitcoin',
    'Lightning',
    'Tron',
  ]);
  await page.keyboard.press('Escape');
  await page.getByRole('combobox', { name: 'Asset', exact: true }).click();
  await expect(page.getByRole('listbox', { name: 'Asset' }).getByRole('option')).toHaveText([
    'All',
    'BTC',
    'USDT',
  ]);
  await page.keyboard.press('Escape');
  await page.getByRole('combobox', { name: 'Activity', exact: true }).click();
  await expect(page.getByRole('listbox', { name: 'Activity' }).getByRole('option')).toHaveText([
    'All',
    'Daily',
    'Weekly',
    'Monthly',
    'None',
  ]);
  await page.keyboard.press('Escape');
  await page.getByRole('combobox', { name: 'Blockchain', exact: true }).click();
  await page.getByRole('option', { name: 'Bitcoin', exact: true }).click();
  await page.getByRole('combobox', { name: 'Asset', exact: true }).click();
  await expect(page.getByRole('listbox', { name: 'Asset' }).getByRole('option')).toHaveText([
    'All',
    'BTC',
  ]);
});

test('Function: HomeShops hides filters that do not split the shops', async ({ page }) => {
  await stubIdenticalMap(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'Table' }).click();
  await expect(page.getByRole('cell', { name: 'Ann', exact: true })).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'Country', exact: true })).toHaveCount(0);
  await expect(page.getByRole('combobox', { name: 'Name', exact: true })).toHaveCount(0);
  await expect(page.getByRole('combobox', { name: 'Blockchain', exact: true })).toHaveCount(0);
  await expect(page.getByRole('combobox', { name: 'Asset', exact: true })).toHaveCount(0);
  await expect(page.getByRole('combobox', { name: 'Activity', exact: true })).toHaveCount(0);
  await expect(page.getByRole('columnheader', { name: 'Name' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Location' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Activity' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Country' })).toHaveCount(0);
  await expect(page.getByRole('columnheader', { name: 'Shop' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'What the activity words mean' })).toBeVisible();
});

test('Function: HomeShops sorts each column in both directions', async ({ page }) => {
  await stubPublicMap(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'Table' }).click();
  await expectFirstCells(page, ['Mid', 'North', 'Sample', 'South']);
  await page.getByRole('button', { name: 'Name', exact: true }).click();
  await expectFirstCells(page, ['South', 'Sample', 'North', 'Mid']);
  await page.getByRole('button', { name: 'Location', exact: true }).click();
  await expectFirstCells(page, ['Mid', 'North', 'South', 'Sample']);
  await page.getByRole('button', { name: 'Location', exact: true }).click();
  await expectFirstCells(page, ['Sample', 'South', 'North', 'Mid']);
  await page.getByRole('button', { name: 'Country', exact: true }).click();
  await expectFirstCells(page, ['South', 'Mid', 'North', 'Sample']);
  await page.getByRole('button', { name: 'Country', exact: true }).click();
  await expectFirstCells(page, ['Mid', 'North', 'Sample', 'South']);
  await page.getByRole('button', { name: 'Shop', exact: true }).click();
  await expectFirstCells(page, ['Mid', 'North', 'South', 'Sample']);
  await page.getByRole('button', { name: 'Shop', exact: true }).click();
  await expectFirstCells(page, ['Sample', 'Mid', 'North', 'South']);
  await page.getByRole('button', { name: 'Activity', exact: true }).click();
  await expectFirstCells(page, ['Sample', 'North', 'Mid', 'South']);
  await page.getByRole('button', { name: 'Activity', exact: true }).click();
  await expectFirstCells(page, ['South', 'Mid', 'North', 'Sample']);
  await page.getByRole('button', { name: 'Name', exact: true }).click();
  await expectFirstCells(page, ['Mid', 'North', 'Sample', 'South']);
  await page.getByRole('button', { name: 'Location', exact: true }).click();
  await page.getByRole('button', { name: 'Location', exact: true }).click();
  await page.getByRole('combobox', { name: 'Country', exact: true }).click();
  await page.getByRole('option', { name: 'Philippines', exact: true }).click();
  await expectFirstCells(page, ['Sample', 'North', 'Mid']);
});

test('Function: HomeShops clusters overlapping pins and opens them', async ({ page }) => {
  await stubPublicMap(page);
  await page.goto('/');
  const cluster = page.getByRole('button', { name: '3 shops' });
  await expect(cluster).toBeVisible({ timeout: 20_000 });
  const pins = page.locator('#shop-places-map .shop-place-marker:not(.is-clustered)');
  await expect(pins).toHaveCount(1);
  await cluster.click();
  await expect(pins).toHaveCount(4, { timeout: 20_000 });
  await expect(cluster).toHaveCount(0);
});

test('Function: HomeShops popup shows a photo when present and categories when they differ', async ({
  page,
}) => {
  await stubPublicMap(page);
  await page.goto('/');
  const lone = page.locator('#shop-places-map .shop-place-marker:not(.is-clustered)');
  await expect(lone).toHaveCount(1, { timeout: 20_000 });
  await page.getByRole('button', { name: 'Sample, Daily' }).click();
  await expect(page.locator('.shop-popup-photo')).toBeVisible();
  await expect
    .poll(() =>
      page.locator('.shop-popup-photo').evaluate((node) => {
        const image = node as HTMLImageElement;
        return image.complete && image.naturalWidth > 0;
      }),
    )
    .toBe(true);
  await expect(page.locator('.shop-popup-category')).toHaveText('shopping');
  await page.getByRole('button', { name: 'Close popup' }).click();
  await expect(page.locator('.shop-popup-card')).toHaveCount(0);
  await page.getByRole('button', { name: '3 shops' }).click();
  await page.getByRole('button', { name: 'North, Weekly' }).click();
  await expect(page.locator('.shop-popup-photo')).toHaveCount(0);
  await expect(page.locator('.shop-popup-category')).toHaveText('cafe');
  await expect(page.locator('.shop-popup-name')).toHaveText('North');
});

test('Function: HomeShops popup name link opens the shop without a document load', async ({
  page,
}) => {
  await stubPublicMap(page);
  await page.goto('/');
  const sample = page.getByRole('button', { name: 'Sample, Daily' });
  await expect(sample).toBeVisible({ timeout: 20_000 });
  await sample.click();
  const link = page.locator('.shop-popup-name');
  const shopPath = `/npub1${'q'.repeat(58)}`;
  await expect(link).toHaveAttribute('href', shopPath);
  await markDocument(page);
  await link.click();
  await expect(page).toHaveURL(new RegExp(`${shopPath}$`));
  expect(await sameDocument(page)).toBe('same');
});

test('Function: HomeShops hides the category chip when every shop shares it', async ({ page }) => {
  await stubIdenticalMap(page);
  await page.goto('/');
  const ann = page.getByRole('button', { name: 'Ann, Daily' });
  await expect(ann).toBeVisible({ timeout: 20_000 });
  await ann.click();
  await expect(page.locator('.shop-popup-photo')).toBeVisible();
  await expect(page.locator('.shop-popup-category')).toHaveCount(0);
  await page.getByRole('button', { name: 'Close popup' }).click();
  await page.getByRole('button', { name: 'Bea, Daily' }).click();
  await expect(page.locator('.shop-popup-photo')).toHaveCount(0);
  await expect(page.locator('.shop-popup-category')).toHaveCount(0);
});

test('Function: HomeShops anchors the help panel inside the viewport', async ({ page }) => {
  await stubPublicMap(page);
  await page.goto('/');
  const help = page.getByRole('button', { name: 'What the activity words mean' });
  await help.scrollIntoViewIfNeeded();
  await help.click();
  const panel = page.locator('[data-shops-help-panel]');
  await expect(panel).toBeVisible();
  await expect
    .poll(async () => {
      const box = await panel.boundingBox();
      const viewport = page.viewportSize();
      if (box === null || viewport === null) return false;
      const right = box.x + box.width;
      const bottom = box.y + box.height;
      return box.x >= 16 && box.y >= 16 && right <= viewport.width && bottom <= viewport.height;
    })
    .toBe(true);
});

test('Function: HomeShops keeps an open filter list inside a narrow window', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await stubPublicMap(page);
  await page.goto('/');
  const country = page.getByRole('combobox', { name: 'Country', exact: true });
  await country.scrollIntoViewIfNeeded();
  await country.click();
  const listbox = page.getByRole('listbox', { name: 'Country' });
  await expect(listbox).toBeVisible();
  await expect
    .poll(async () => {
      const box = await listbox.boundingBox();
      if (box === null) return false;
      const right = box.x + box.width;
      const bottom = box.y + box.height;
      return box.x >= 0 && box.y >= 0 && right <= 390 && box.width <= 358 && bottom <= 844;
    })
    .toBe(true);
});

test('Function: HomeShops keeps a pinned filter list inside a short window', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 180 });
  await stubPublicMap(page);
  await page.goto('/');
  const country = page.getByRole('combobox', { name: 'Country', exact: true });
  await country.scrollIntoViewIfNeeded();
  await country.click();
  const listbox = page.getByRole('listbox', { name: 'Country' });
  await expect(listbox).toHaveCSS('position', 'fixed');
  await expect
    .poll(async () => {
      const box = await listbox.boundingBox();
      if (box === null) return false;
      return box.x >= 0 && box.y >= 0 && box.x + box.width <= 390 && box.y + box.height <= 180;
    })
    .toBe(true);
});

test('legal page is reachable', async ({ page }) => {
  await page.goto('/legal');
  await expect(page.getByRole('heading', { name: 'Legal Notice' })).toBeVisible();
});

test('about page is reachable', async ({ page }) => {
  await page.goto('/about');
  await expect(page.getByRole('heading', { name: 'What 21.gifts stands for' })).toBeVisible();
});

test('landing mobile nav opens the section links', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Menu' }).click();
  await expect(page.getByLabel('Primary').getByRole('link', { name: 'Handbook' })).toBeVisible();
  await expect(page.getByLabel('Primary').getByRole('link', { name: 'Log in' })).toBeVisible();
});

for (const locale of ['en', 'de', 'es', 'fil'] as const) {
  test(`Function: HappylandSection renders the ${locale} place portrait without overflow`, async ({
    page,
    context,
  }) => {
    await context.addCookies([{ name: 'locale', value: locale, url: 'http://localhost:3000' }]);
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');
    const section = page.locator('#happyland');
    await expect(section.getByRole('heading', { level: 2 })).toContainText('Happyland');
    await expect(section.locator('article')).toHaveCount(3);
    await expect(section.locator('img')).toHaveCount(4);
    await expect(section.locator('figcaption').first()).toContainText('Happyland');
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
  });
}

test('Happyland uses the original people photographs with equal gallery frames', async ({
  page,
}) => {
  await page.goto('/');
  const section = page.locator('#happyland');
  await expect(section.locator('img')).toHaveCount(4);
  const photos = ['food-stall', 'main-street', 'home', 'household'] as const;
  for (const photo of photos) {
    expect((await page.request.get(`/happyland/${photo}.webp`)).status()).toBe(200);
  }
  const sources = await section
    .locator('img')
    .evaluateAll((images) =>
      images.map((image) => decodeURIComponent((image as HTMLImageElement).currentSrc)),
    );
  expect(sources).toHaveLength(4);
  for (const [index, photo] of photos.entries()) {
    expect(sources[index] ?? '').toContain(`/happyland/${photo}.webp`);
  }
  const galleryImages = section.locator('figure img');
  const expectEqualFourByThree = async (): Promise<void> => {
    const frames = await galleryImages.evaluateAll((images) =>
      images.slice(1).map((image) => ({ width: image.clientWidth, height: image.clientHeight })),
    );
    expect(frames).toHaveLength(3);
    expect(new Set(frames.map(({ width }) => width)).size).toBe(1);
    expect(new Set(frames.map(({ height }) => height)).size).toBe(1);
    for (const frame of frames) {
      expect(Math.abs(frame.width / frame.height - 4 / 3)).toBeLessThanOrEqual(0.02);
    }
  };
  await expectEqualFourByThree();
  await page.setViewportSize({ width: 375, height: 812 });
  await expectEqualFourByThree();
  await expect(section.locator('article')).toHaveCount(3);
  for (const title of [
    'What others throw away',
    'Living in a cramped space',
    'Paths through the neighborhood',
  ]) {
    await expect(section.getByRole('heading', { name: title, exact: true })).toBeVisible();
  }
});

for (const locale of ['en', 'de', 'es', 'fil'] as const) {
  for (const width of [375, 768, 1024, 1280]) {
    test(`Function: MarketingHeader opens Happyland in ${locale} at ${width}px`, async ({
      page,
      context,
    }) => {
      await context.addCookies([{ name: 'locale', value: locale, url: 'http://localhost:3000' }]);
      await page.setViewportSize({ width, height: 812 });
      await page.goto('/');
      const menu = page.getByRole('button', {
        name: getCatalog(locale)['aria.menu'],
        exact: true,
        includeHidden: true,
      });
      if (await menu.isVisible()) await menu.click();
      const nav = page.locator('header nav');
      const happyland = nav.getByRole('link', { name: 'Happyland', exact: true });
      await expect(nav.getByRole('link').nth(0)).toHaveAttribute('href', `/${locale}#how`);
      await expect(nav.getByRole('link').nth(1)).toHaveText('Happyland');
      await expect(happyland).toHaveAttribute('href', `/${locale}#happyland`);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      await happyland.click();
      await expect(page).toHaveURL(new RegExp(`/${locale}#happyland$`));
      await expect(page.locator('#happyland-title')).toBeInViewport();
      await expect(menu).toHaveAttribute('aria-expanded', 'false');
      await expect
        .poll(async () => {
          const heading = await page.locator('#happyland-title').boundingBox();
          const header = await page.locator('header').boundingBox();
          return heading !== null && header !== null && heading.y >= header.y + header.height;
        })
        .toBe(true);
    });
  }
}

for (const width of [375, 1280]) {
  test(`Happyland navigation returns from About to the Happyland section at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 812 });
    await page.goto('/about');
    const menu = page.getByRole('button', { name: 'Menu', exact: true, includeHidden: true });
    if (await menu.isVisible()) await menu.click();
    await page.locator('header nav').getByRole('link', { name: 'Happyland', exact: true }).click();
    await expect(page).toHaveURL(/\/en#happyland$/);
    await expect(page.locator('#happyland-title')).toBeInViewport();
    await expect(
      page.getByRole('button', { name: 'Menu', exact: true, includeHidden: true }),
    ).toHaveAttribute('aria-expanded', 'false');
  });
}
