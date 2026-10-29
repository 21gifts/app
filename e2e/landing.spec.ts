import { expect, test, type Page, type Route } from '@playwright/test';
import { getCatalog } from '../src/lib/messages';

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
  await header.getByRole('link', { name: '21.gifts' }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('heading', { name: /Direct human-to-human gifts/i })).toBeVisible();
  await expect(header.getByRole('link', { name: 'Back', exact: true })).toHaveCount(0);
  await expect(header.getByRole('link', { name: 'Back to the forum' })).toHaveCount(0);
  await expect(header.getByRole('button', { name: 'Back' })).toHaveCount(0);
  await page.goto('/');
  await expect(header.getByRole('link', { name: '21.gifts' })).toBeVisible();
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

test('Happyland follows the giving journey and keeps unverified claims out', async ({ page }) => {
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
  await page.getByRole('combobox', { name: 'Activity', exact: true }).click();
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
  await expect(page.getByText(getCatalog('en')['map.error'])).toBeVisible();
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
  await page.getByRole('combobox', { name: 'Activity', exact: true }).click();
  const activityMenu = page.getByRole('listbox');
  await expect(activityMenu.getByRole('option')).toHaveCount(1);
  await expect(activityMenu.getByRole('option', { name: 'All', exact: true })).toBeVisible();
});

test('Function: FilterMenu opens the blockchain list', async ({ page }) => {
  await stubPublicMap(page);
  await page.goto('/');
  await page.getByRole('combobox', { name: 'Blockchain', exact: true }).click();
  await expect(page.getByRole('option', { name: 'Bitcoin' })).toBeVisible();
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
