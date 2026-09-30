import { expect, test } from '@playwright/test';
import { getCatalog } from '../src/lib/messages';

test('landing shows the 21.gifts wordmark', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('link', { name: '21.gifts' }).first()).toBeVisible();
  await expect(page.getByRole('heading', { name: /Help people.*with Bitcoin/i })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Donate Bitcoin' })).toHaveAttribute(
    'href',
    '/en/donate',
  );
  await expect(page.locator('main').getByText('How it works', { exact: true })).toBeVisible();
  const bitcoinMarks = page.locator('main img[src="/bitcoin-symbol.svg"]');
  await expect(bitcoinMarks).toHaveCount(5);
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

test('landing shows the project donate address', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Want to support 21.gifts?' })).toBeVisible();
  await expect(page.getByRole('link', { name: '21gifts@walletofsatoshi.com' })).toHaveAttribute(
    'href',
    'lightning:21gifts@walletofsatoshi.com',
  );
});

test('Happyland follows the giving journey and keeps unverified claims out', async ({ page }) => {
  await page.goto('/');
  const sections = page.locator('main > section');
  await expect(sections.nth(1)).toHaveAttribute('id', 'how');
  await expect(sections.nth(3)).toHaveAttribute('id', 'why');
  await expect(sections.nth(4)).toHaveAttribute('id', 'happyland');
  await expect(page.getByRole('heading', { name: 'Happyland in Tondo' })).toBeVisible();
  await expect(page.getByRole('link', { name: /Happyland · Tondo/ })).toHaveAttribute(
    'href',
    '#happyland',
  );
  await expect(page.getByRole('heading', { name: '21.gifts on the ground' })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'What your gift makes possible' })).toHaveCount(0);
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
  for (const photo of ['food-stall', 'main-street', 'home', 'household']) {
    expect((await page.request.get(`/happyland/${photo}.webp`)).status()).toBe(200);
  }
  const galleryImages = section.locator('figure img');
  const frames = await galleryImages.evaluateAll((images) =>
    images.slice(1).map((image) => ({ width: image.clientWidth, height: image.clientHeight })),
  );
  expect(frames).toHaveLength(3);
  expect(new Set(frames.map(({ height }) => height)).size).toBe(1);
  await expect(section.locator('article')).toHaveCount(3);
  for (const title of [
    'Making a living from discarded things',
    'One room for everyday life',
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
  test(`Happyland navigation returns from About to the photo essay at ${width}px`, async ({
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
