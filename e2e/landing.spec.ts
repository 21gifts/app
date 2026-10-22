import { expect, test, type Page, type Route } from '@playwright/test';
import { getCatalog } from '../src/lib/messages';

test('landing shows the 21.gifts wordmark', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('link', { name: '21.gifts' }).first()).toBeVisible();
  await expect(page.getByRole('heading', { name: /Direct human-to-human gifts/i })).toBeVisible();
});

test('landing shows the project donate address', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Donate to this project' })).toBeVisible();
  await expect(page.getByRole('link', { name: '21gifts@walletofsatoshi.com' })).toHaveAttribute(
    'href',
    'lightning:21gifts@walletofsatoshi.com',
  );
});

test('Happyland follows how it works and hides unverified claims', async ({ page }) => {
  await page.goto('/');
  const sections = page.locator('main > section');
  await expect(sections.nth(1)).toHaveAttribute('id', 'shops');
  await expect(sections.nth(2)).toHaveAttribute('id', 'how');
  await expect(sections.nth(3)).toHaveAttribute('id', 'happyland');
  await expect(
    page.getByRole('heading', { name: 'Happyland – a glimpse of life in Manila' }),
  ).toBeVisible();
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
    countries: ['PH'],
    shopNames: ['SPAR'],
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

function shopPlaces(): Record<string, unknown> {
  return {
    places: [
      {
        id: `npub1${'q'.repeat(58)}`,
        name: 'Sample',
        shopName: 'SPAR',
        country: 'PH',
        activity: 'daily',
        lat: 14.6,
        lon: 121.0,
        techProvider: '21.gifts',
      },
      {
        id: `npub1${'i'.repeat(58)}`,
        name: 'Idle shop',
        shopName: 'SPAR',
        country: 'PH',
        activity: 'olderThan30Days',
        lat: 14.5,
        lon: 121.1,
        techProvider: '21.gifts',
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

async function fulfillShopRoute(route: Route): Promise<void> {
  const path = new URL(route.request().url()).pathname;
  const body = path === '/map/filters' ? shopFilters() : shopPlaces();
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
}

async function stubPublicMap(page: Page): Promise<void> {
  await page.route((url) => isPublicMapApi(url), fulfillShopRoute);
}

test('Function: HomeShops lists a published shop and hides other providers', async ({ page }) => {
  await stubPublicMap(page);
  await page.goto('/');
  await expect(page.locator('section#shops')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Shops', exact: true })).toBeVisible();
  await expect(page.locator('#shops').getByText('Sample', { exact: true })).toHaveCount(1);
  await expect(page.locator('#shops').getByText('Other desk', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Table' }).click();
  await expect(page.getByRole('columnheader', { name: 'Tech provider' })).toBeVisible();
  const sample = page.getByRole('link', { name: 'Sample', exact: true });
  await expect(sample).toHaveAttribute('href', `/npub1${'q'.repeat(58)}`);
  await expect(sample).not.toHaveAttribute('href', /opencryptopay\.io/);
  await page.getByRole('button', { name: 'Activity', exact: true }).click();
  await page.getByRole('option', { name: 'Monthly', exact: true }).click();
  await expect(page.getByRole('cell', { name: 'Sample', exact: true })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Idle shop', exact: true })).toHaveCount(0);
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
  await expect(page.getByText(getCatalog('en')['homeShops.error'])).toBeVisible();
  expect(placesRequests).toBe(0);
});

test('Function: HomeShops opens the table when the map script fails', async ({ page }) => {
  await stubPublicMap(page);
  await page.route('https://unpkg.com/maplibre-gl@5.6.1/dist/maplibre-gl.js', (route) =>
    route.abort(),
  );
  await page.goto('/');
  await expect(page.getByText(getCatalog('en')['homeShops.error'])).toBeVisible();
  await expect(page.getByRole('button', { name: 'Table' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('columnheader', { name: 'Tech provider' })).toBeVisible();
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
  await expect(page.getByText(getCatalog('en')['homeShops.error'])).toBeVisible();
  await expect(page.getByText(getCatalog('en')['homeShops.empty'])).toHaveCount(0);
});

test('Function: HomeShops leaves only All when activities are missing', async ({ page }) => {
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
  await page.getByRole('button', { name: 'Activity', exact: true }).click();
  const activityMenu = page.getByRole('listbox');
  await expect(activityMenu.getByRole('option')).toHaveCount(1);
  await expect(activityMenu.getByRole('option', { name: 'All', exact: true })).toBeVisible();
});

test('legal page is reachable', async ({ page }) => {
  await page.goto('/legal');
  await expect(page.getByRole('heading', { name: 'Legal Notice' })).toBeVisible();
});

test('about page is reachable', async ({ page }) => {
  await page.goto('/about');
  await expect(page.getByRole('heading', { name: 'Three convictions' })).toBeVisible();
});

test('landing mobile nav opens the section links', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Menu' }).click();
  await expect(page.getByLabel('Primary').getByRole('link', { name: 'Handbook' })).toBeVisible();
  await expect(page.getByLabel('Primary').getByRole('link', { name: 'Log in' })).toBeVisible();
});

for (const locale of ['en', 'de', 'es', 'fil'] as const) {
  test(`Function: HappylandSection renders the complete ${locale} essay without overflow`, async ({
    page,
    context,
  }) => {
    await context.addCookies([{ name: 'locale', value: locale, url: 'http://localhost:3000' }]);
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');
    const section = page.locator('#happyland');
    await expect(section.getByRole('heading', { level: 2 })).toContainText('Happyland');
    await expect(section.locator('figure')).toHaveCount(8);
    await expect(section.locator('figcaption', { hasText: /^Pagpag$/ })).toHaveCount(1);
    await expect
      .poll(() =>
        section
          .getByRole('img')
          .evaluateAll((images) =>
            images.every(
              (image) =>
                image instanceof HTMLImageElement && image.complete && image.naturalWidth > 0,
            ),
          ),
      )
      .toBe(true);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
  });
}

test('Function: HappylandPhoto preserves photographs and displays descriptive captions', async ({
  page,
}) => {
  await page.goto('/');
  const figures = page.locator('#happyland figure');
  await expect(figures).toHaveCount(8);
  for (const figure of await figures.all()) {
    const image = figure.getByRole('img');
    await expect(image).toHaveAttribute('alt', /.+/);
    await expect(image).toHaveAttribute('src', /^\/happyland\/.+\.webp$/);
    await expect(figure.locator('figcaption')).not.toBeEmpty();
    await expect
      .poll(() =>
        image.evaluate(
          (element) =>
            element instanceof HTMLImageElement && element.complete && element.naturalWidth > 0,
        ),
      )
      .toBe(true);
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
      await expect(nav.getByRole('link').nth(0)).toHaveAttribute('href', '/#how');
      await expect(nav.getByRole('link').nth(1)).toHaveText('Happyland');
      await expect(happyland).toHaveAttribute('href', '/#happyland');
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      await happyland.click();
      await expect(page).toHaveURL(/\/#happyland$/);
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
  test(`Happyland navigation returns from About to the photo essay at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 812 });
    await page.goto('/about');
    const menu = page.getByRole('button', { name: 'Menu', exact: true, includeHidden: true });
    if (await menu.isVisible()) await menu.click();
    await page.locator('header nav').getByRole('link', { name: 'Happyland', exact: true }).click();
    await expect(page).toHaveURL(/\/#happyland$/);
    await expect(page.locator('#happyland-title')).toBeInViewport();
    await expect(
      page.getByRole('button', { name: 'Menu', exact: true, includeHidden: true }),
    ).toHaveAttribute('aria-expanded', 'false');
  });
}
